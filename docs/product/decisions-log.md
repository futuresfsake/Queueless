# Decisions Log (Product Owner Confirmations)

Status: Final v1.0 · Last updated: 2026-11-05

Every previously open question is resolved here. These are the defaults the project builds against. Changing one requires a new ADR or a dated edit to this log. Anything marked **Gate** has a date by which it is re-checked against real information.

| ID | Question | Decision | Why | Affects |
|---|---|---|---|---|
| D-1 | Redis in MVP? | **No.** Single API server, in-memory Socket.IO and throttling. Redis + BullMQ arrive with SMS (post-MVP). | No MVP feature needs it; saves infra time | ADR-005 |
| D-2 | `call-next` on empty queue | **`409 QUEUE_EMPTY`** with the standard error body | Client can show a clear message; consistent error shape | api.md, US-10 |
| D-3 | Is SKIPPED recoverable? | **Final.** No recall in v1. | Keeps the state machine and INV-2 simple | state-machine.md |
| D-4 | Hosting | **Railway** (API + Postgres), **Vercel** (web). Fallback: Render. **Gate: Nov 8** deploy hello-world with DB and WebSockets. | One platform for API+DB; supports WebSockets | runbook, R4 |
| D-5 | Package manager / layout | **pnpm** workspaces: `apps/api`, `apps/web`, `packages/shared` | Already scaffolded | conventions.md |
| D-6 | Ticket number format | `PREFIX-NNN` (3-digit zero-padded, grows past 999), resets daily per service point on the clinic-local date (`Asia/Manila`) | Short, readable, SMS-friendly | schema.md |
| D-7 | Auth | Email + password, JWT access token, 8 h expiry, **no refresh tokens** in MVP | Smallest safe thing for a demo | security-privacy.md |
| D-8 | Phone number | **Optional** in MVP web flow; **required** for SMS flows (post-MVP) | Web patients can watch the page; SMS needs a number | PRD, US-5 |
| D-9 | What the patient sees | MVP: **people ahead (count)**. Time estimate only post-MVP, and only once measured. | Never show an unmeasured estimate | US-6 |
| D-10 | Booked vs walk-in order | **FIFO by ticket sequence** for both in MVP. Slot time is informational. Slot-priority ordering is post-MVP. | Avoids fairness/edge-case scope | US-8 |
| D-11 | Consent text | Single versioned text, `text_version = "v1"`, shown before ticket issue; stored in `consents` | Auditable | security-privacy.md |
| D-12 | No-show handling | **Manual** in MVP. Auto no-show after 10 min (configurable per tenant) is post-MVP. | Job infrastructure comes with BullMQ | state-machine.md |
| D-13 | shadcn/ui | Initialized at the start of M4 when the first real component is needed | No dead setup | implementation-plan.md |
| D-14 | Idempotency | Client generates a UUID per user action and reuses it on retry; server keeps keys 24 h | Standard pattern | ADR-004 |
| D-15 | Socket payloads | Sockets are **hints** (`servicePointId`, `version`); clients refetch the snapshot | Correct by construction; simple | TRD-HLD.md |
| D-16 | Language | English UI/SMS in MVP; strings kept in one file so Filipino/Cebuano can be added post-MVP | Time | PRD |
| D-17 | Super Admin creation | Seeded by script only; no public sign-up | Security | seed script |
| D-18 | Phone purge (INV-9) | Daily job via `@nestjs/schedule` (P1 in MVP; if cut, documented as a limitation) | Privacy promise | US-25 |
| D-19 | Time source | **All code reads time through an injectable `Clock` service** from day one | Lets the simulator run a 4-hour day in ~2 minutes with a virtual clock; makes tests deterministic | conventions.md, simulator-spec.md |
| D-20 | SMS gateway | httpSMS on an Android phone + prepaid SIM as primary **if** inbound webhook works; Semaphore as outbound-only fallback. **Gate: Nov 15** verify inbound before building on it. | Context doc told us to check inbound first | sms-outbox-design.md |
| D-21 | Wait-time method | Weighted moving average of last 10 service durations per service point, divided by active staff; accuracy = mean absolute error in minutes, labeled simulated vs real | Matches context doc | wait-time-estimation.md |
| D-22 | Quality gate | CI (lint, typecheck, test, build) required green on `main`; k6 concurrency tests run in CI from M6 | Proof is the product | test-plan.md |
| D-23 | Demo data | Seeded demo tenant `demo-clinic`; simulated data always labeled **SIMULATED** in UI and README | Honesty rule | validation-results.md |
| D-24 | Submission scope freeze | **No new features after Nov 13.** Nov 14 = submit only. | Deadline safety | milestones.md |

## Confirmation
All decisions above are treated as approved by the product owner as of 2026-11-05 unless edited in this file with a later date.
