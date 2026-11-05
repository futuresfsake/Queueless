# ADR-004: Idempotency keys stored in Postgres

Status: Accepted · Date: 2026-11-05

## Context
Staff double-tap, networks retry, and users on weak signal resend requests. A repeated "Call next" must never skip a patient.

## Decision
Queue-changing endpoints require an `Idempotency-Key` header. Within the request's transaction we insert `(tenant_id, key)` with `IN_PROGRESS` (`ON CONFLICT DO NOTHING`).
- Inserted → perform the action, store response, mark `COMPLETED`.
- Conflict + `COMPLETED` + same `request_hash` → return stored response, no effect.
- Conflict + different `request_hash` → `422 IDEMPOTENCY_KEY_REUSED`.
- Conflict + `IN_PROGRESS` → `409 REQUEST_IN_PROGRESS` (concurrent duplicate).
The client generates a key per user action and reuses it on retry. Keys expire after 24h.

## Alternatives
- **Redis store:** faster, but adds infra and loses atomicity with the queue change.
- **No keys, rely on state guards:** guards prevent invalid transitions but not "call next twice" (two valid calls).

## Consequences
+ Atomic with the queue change (same transaction → no gap where effect happened but key wasn't saved).
− Extra write per request; periodic cleanup job.
