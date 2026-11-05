# SMS & Outbox Design (post-MVP)

Status: Final v1.0 · Last updated: 2026-11-05

Stories: US-26, US-27, US-28. Window: Nov 15–18. Adds Redis + BullMQ (ends ADR-005's scope).

## 1. Goals
- A patient with a basic phone can join, hear when their turn is near, and cancel — by SMS only.
- **No lost and no duplicate texts** (as far as the gateway allows; see §6).

## 2. Gateway (D-20)
- Primary: httpSMS (Android phone + prepaid SIM) — supports inbound via webhook.
- Fallback: Semaphore — **outbound only**.
- **Gate Nov 15:** send and receive one real SMS end to end. If inbound fails, ship outbound-only (web join + SMS notifications) and say so in the README.
- Gateway behind an interface `SmsGateway { send(to, body, dedupeKey): Promise<ProviderResult> }` so providers are swappable and tests use a fake.

## 3. Tables
```
outbox_messages
  id uuid PK, tenant_id uuid, ticket_id uuid NULL,
  to_phone text, body text, template text,
  dedupe_key text NOT NULL,                 -- e.g. "ticket:<id>:NEAR_TURN"
  status enum PENDING | SENDING | SENT | FAILED | DEAD,
  attempts int default 0, next_attempt_at timestamptz,
  provider_message_id text NULL, last_error text NULL,
  created_at, sent_at
  UNIQUE (tenant_id, dedupe_key)            -- same logical message can be enqueued only once

sms_inbound
  id uuid PK, tenant_id uuid NULL, from_phone text, body text,
  provider_message_id text UNIQUE,          -- webhook replays are ignored
  received_at, processed_at NULL, result text NULL
```
Both get RLS like other tenant tables (`sms_inbound.tenant_id` is NULL until the keyword resolves a clinic; the webhook runs under a narrow policy/role path).

## 4. Outbound flow (outbox pattern)
1. In the **same transaction** as the queue change (e.g. a ticket becomes "near turn"), insert an `outbox_messages` row (`PENDING`). If the transaction rolls back, no message exists.
2. A BullMQ worker repeatedly claims due rows: `SELECT ... WHERE status='PENDING' AND next_attempt_at <= now() FOR UPDATE SKIP LOCKED LIMIT n`, sets `SENDING`.
3. Calls the gateway with `dedupe_key`.
4. Success → `SENT` + `provider_message_id`. Failure → `attempts+1`, exponential backoff (30 s, 2 m, 10 m, 1 h), after 5 attempts → `DEAD` (visible to admin).
5. Rows stuck in `SENDING` longer than 2 minutes (worker crash) are returned to `PENDING`.

## 5. Inbound flow
Webhook `POST /sms/inbound/:secret` (shared secret in URL/header; rejects others).
1. Insert `sms_inbound` (dedupe on `provider_message_id`).
2. Parse (case-insensitive, trimmed):
   - `PILA <CLINIC-CODE>` → issue ticket for that clinic's default service point; reply `Your number is A-023. ~8 ahead.` (estimate only if D-21 data exists, else count only). The keyword counts as consent; consent row stored with `text_version = "sms-v1"`.
   - `CANCEL` → cancel the sender's active ticket.
   - `STATUS` → reply with position.
   - Unknown → short help text.
3. Replies go through the outbox like everything else.
4. Per-phone rate limit (Redis): e.g. 5 inbound/min, 20 tickets/day — thresholds are config, tuned later.

## 6. Guarantees and honest limits
- Enqueue is atomic with the state change; `UNIQUE(dedupe_key)` prevents duplicate enqueue.
- Delivery is **at-least-once** at the worker level. A crash between the gateway accepting a message and our DB update can cause one resend. Mitigation: pass `dedupe_key` as the provider's client reference where supported; otherwise this window is documented as a known limitation. Chaos test C-1 measures it; do not claim "zero duplicates" unless measured.
- Delivery success rate is a pilot metric, not claimed.

## 7. Templates (English; strings in one file)
`TICKET_ISSUED`, `NEAR_TURN` (when ≤ 3 ahead), `CALLED`, `CANCELLED`, `HELP`.

## 8. Tests
Fake gateway; outbox row written iff transaction commits; retry/backoff; stuck-`SENDING` recovery; webhook replay ignored; `CANCEL` idempotent; chaos C-1/C-3 (see chaos-test-plan).
