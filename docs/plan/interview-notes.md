# Interview Notes (Dec 1–7)

Status: Final v1.0 · Last updated: 2026-11-05

Use this to defend the design. Every answer must be backed by something in the repo. Never state a number that is not in `validation-results.md`.

## 60-second pitch
"Queueless is a multi-tenant clinic queue system. Queue systems are common, so I focused on how it's built: correctness under concurrent clicks and crashes, designed for basic phones, and validated honestly. Tenants are isolated by Postgres row-level security, 'Call next' is safe for simultaneous staff, and every change is in an append-only event log."

## Likely questions
| Question | Answer (where to point) |
|---|---|
| Why RLS instead of `WHERE tenant_id`? | A forgotten filter would leak data; RLS enforces in the DB, fails closed, tested with a non-owner role. ADR-001 |
| What is the catch with RLS? | Table owners bypass it (hence FORCE + non-owner app role); pooled connections (hence transaction-local `set_config`); logins/guest links need narrow lookup policies |
| How do three staff not call the same patient? | `SELECT … FOR UPDATE SKIP LOCKED`; k6/integration test. ADR-003 |
| What if the staff double-taps? | Idempotency key stored in the same transaction as the effect. ADR-004 |
| Why an event log? | Audit, analytics, rebuild/verify state (replay test). ADR-002 |
| Why no Redis at first? | Nothing in the MVP needed it; added with the SMS worker. ADR-005 |
| How do you avoid lost SMS? | Outbox row in the same transaction; worker retries; honest note on the at-least-once window. sms-outbox-design.md |
| What's wrong with your wait estimates? | Listed weaknesses; compared against a naive baseline; simulated only. wait-time-estimation.md |
| What did you not validate? | Real clinic workflows and patient behavior. State it first. |
| What would you do with a real pilot? | Measure actual wait vs. estimate, no-show rate, SMS delivery rate |
| Privacy? | Name + optional phone only, consent logged, phone purged after 30 days |
| What went wrong during the build? | Fill in honestly after building (e.g. RLS gotchas) |

## "Since I applied" list (fill with what really shipped)
- [ ] SMS outbox + two-way SMS
- [ ] Multi-stage visits
- [ ] Wait-time estimates + accuracy (labeled simulated)
- [ ] Simulator + demo button
- [ ] Chaos tests
- [ ] Usability test (5 testers)

## Dec 1–7 checklist
- [ ] README updated with only real results
- [ ] Demo link and accounts verified working
- [ ] Re-run CI and k6; refresh the validation table
- [ ] Rehearse the demo (2–3 min) and the 60-second pitch
- [ ] Prepare 3 stories: hardest bug, a decision you reversed, something you cut and why
