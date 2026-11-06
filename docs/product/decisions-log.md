# Decisions Log (Product Owner Confirmations)

Status: Final v1.1 · Last updated: 2026-11-05

Every previously open question is resolved here. These are the defaults the project builds against. Changing one requires a new ADR or a dated edit to this log. Anything marked **Gate** has a date by which it is re-checked against real information.

| ID | Question | Decision | Why | Affects |
|---|---|---|---|---|
| D-1 | Redis in MVP? | **No.** Single API server, in-memory Socket.IO and throttling. Redis + BullMQ arrive with SMS (post-MVP). | No MVP feature needs it; saves infra time | ADR-005 |
| D-2 | `call-next` on empty queue | **`409 QUEUE_EMPTY`** with the standard error body | Client can show a clear message; consistent error shape | api.md, US-10 |
| D-3 | Is SKIPPED recoverable? | **Final.** No recall in v1. | Keeps the state machine and INV-2 simple | state-machine.md |
| D-4 | Hosting | **Railway** (API + Postgres), **Vercel** (web). Fallback: Render. **Gate: end of Nov 7 (hard stop Nov 8 morning)**, moved up from Nov 8 by D-32: deploy hello-world with DB and WebSockets. | One platform for API+DB; supports WebSockets | runbook, R4 |
| D-5 | Package manager / layout | **pnpm** workspaces: `apps/api`, `apps/web`, `packages/shared` | Already scaffolded | conventions.md |
| D-6 | Ticket number format | `PREFIX-NNN` (3-digit zero-padded, grows past 999), resets daily per service point on the clinic-local date (`Asia/Manila`) | Short, readable, SMS-friendly | schema.md |
| D-7 | Auth | Email + password, JWT access token, 8 h expiry, **no refresh tokens** in MVP | Smallest safe thing for a demo | security-privacy.md |
| D-8 | Phone number | **Optional** in MVP web flow; **required** for SMS flows (post-MVP) | Web patients can watch the page; SMS needs a number | PRD, US-5 |
| D-9 | What the patient sees | MVP: **people ahead (count)**. Time estimate only post-MVP, and only once measured. | Never show an unmeasured estimate | US-6 |
| D-10 | Booked vs walk-in order | **FIFO by ticket sequence** for both in MVP. Slot time is informational. Slot-priority ordering is post-MVP. | Avoids fairness/edge-case scope | US-8 |
| D-11 | Consent text | Single versioned text, `text_version = "v1"`, shown before ticket issue; stored in `consents` | Auditable | security-privacy.md |
| D-12 | No-show handling | **Manual** in MVP. Auto no-show after 10 min (configurable per tenant) is post-MVP. | Job infrastructure comes with BullMQ | state-machine.md |
| D-13 | shadcn/ui | Initialized at the start of M2 (was M4 before the v1.2 renumbering) when the first real component is needed | No dead setup | implementation-plan.md |
| D-14 | Idempotency | Client generates a UUID per user action and reuses it on retry; server keeps keys 24 h | Standard pattern | ADR-004 |
| D-15 | Socket payloads | Sockets are **hints** (`servicePointId`, `version`); clients refetch the snapshot | Correct by construction; simple | TRD-HLD.md |
| D-16 | Language | English UI/SMS in MVP with all strings in one catalog (no hard-coded text). Post-MVP (US-34): add **Cebuano** and Filipino for the patient page and SMS templates; the product owner (a Cebu native) reviews all translations before release. Do not ship machine-only translations. | Cebu is the home context; patients on basic phones read their own language best | PRD, US-34 |
| D-17 | Super Admin creation | Seeded by script only; no public sign-up | Security | seed script |
| D-18 | Phone purge (INV-9) | Daily job via `@nestjs/schedule` (P1 in MVP; if cut, documented as a limitation) | Privacy promise | US-25 |
| D-19 | Time source | **All code reads time through an injectable `Clock` service** from day one | Lets the simulator run a 4-hour day in ~2 minutes with a virtual clock; makes tests deterministic | conventions.md, simulator-spec.md |
| D-20 | SMS gateway | httpSMS on an Android phone + prepaid SIM as primary **if** inbound webhook works; Semaphore as outbound-only fallback. **Gate: Nov 15** verify inbound before building on it. | Context doc told us to check inbound first | sms-outbox-design.md |
| D-21 | Wait-time method | Weighted moving average of last 10 service durations per service point, divided by active staff; accuracy = mean absolute error in minutes, labeled simulated vs real | Matches context doc | wait-time-estimation.md |
| D-22 | Quality gate | CI (lint, typecheck, test, build) required green on `main`; k6 concurrency tests run in CI from M4 (was M6 before the v1.2 renumbering) | Proof is the product | test-plan.md |
| D-23 | Demo data | Seeded demo tenant `demo-clinic`; simulated data always labeled **SIMULATED** in UI and README | Honesty rule | validation-results.md |
| D-24 | Submission scope freeze | **No new features after Nov 13.** Nov 14 = submit only. | Deadline safety | milestones.md |

## Confirmation
All decisions above are treated as approved by the product owner as of 2026-11-05 unless edited in this file with a later date.

## Added in v1.1 (2026-11-05, senior review)
| ID | Question | Decision | Why | Affects |
|---|---|---|---|---|
| D-25 | Priority lanes | Post-MVP (US-35): lane = REGULAR/PRIORITY only, **category never stored**; priority-first with starvation guard; advisory lock serializes the policy decision when lanes are enabled | PH-specific, ethical data minimization, interesting concurrency trade-off | priority-lanes.md |
| D-26 | Invariant auditor | **In MVP (P1)**: read-only SQL checks A-1..A-8, on demand + nightly + CI. Cut rule: CLI + CI only. | Turns "provable correctness" from a claim into something runnable | invariant-auditor.md |
| D-27 | Retention | Clear **name and phone** after 30 days (was phone only) | Matches the data-minimization promise | INV-9, schema.md |
| D-28 | Abuse protection | Queue cap `max_waiting` = 200 default, per-IP join cap 10/hour, login throttle 5 failures/15 min, guest token expires 24 h after final state | Public endpoints and login need basic protection even in MVP | security-privacy.md, US-36 |
| D-29 | Cancelling a booked ticket | Releases slot capacity in the same transaction under the slot lock | Otherwise capacity leaks | schema.md, T-23 |
| D-30 | Idempotency semantics | Only successful results stored; errors roll back; no IN_PROGRESS state | Reflects what the database can actually observe | ADR-004 |
| D-31 | Estimate ranges | ±25 % (labeled assumption) until ≥ 50 scored tickets, then ± measured MAE | No invented precision | wait-time-estimation.md |

## Added in v1.2 (2026-11-06, milestone restructure)
| ID | Question | Decision | Why | Affects |
|---|---|---|---|---|
| D-32 | What is M0? | **M0 = Foundation**: docs, scaffold, platform/third-party setup, database, auth, and a deployed hello-world (phases F1..F6). Old M1/M2 fold into M0; M3..M8 become M1..M6. Hello-world deploy gate (D-4) moves from Nov 8 to end of Nov 7. | The riskiest unknowns (role provisioning on managed Postgres, RLS never executed, WebSockets on host, accounts) should fail early, before feature work depends on them | milestones.md, implementation-plan.md |
