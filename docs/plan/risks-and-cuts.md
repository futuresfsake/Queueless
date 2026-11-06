# Risks and Cuts

Status: Final v1.1 · Last updated: 2026-11-05

## Risks
| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | RLS + Prisma pooling gotchas (tenant leaks, owner bypass) | Med | High | Transaction-local `set_config`, non-owner role, FORCE RLS, early integration test (M0 F4) |
| R2 | Idempotency edge cases (in-progress, reuse) | Med | Med | Small state machine (IN_PROGRESS/COMPLETED), tests for replay and concurrent same key |
| R3 | Testcontainers slow/flaky in CI | Med | Med | Reuse a Postgres service container in Actions as fallback |
| R4 | Deployment fights (roles, migrations, websockets) | Med | High | Deploy a hello-world with DB as M0 F6 (end of Nov 7, hard stop Nov 8 morning); don't wait until Nov 12 |
| R5 | Scope creep (SMS, multi-stage, simulator) | High | High | Out of MVP by PRD; STATUS review daily |
| R6 | Frontend polish eats time | High | Med | Use shadcn defaults; three simple screens |
| R7 | Illness/power/internet loss | Low | High | Buffer day Nov 13; commit and push daily |
| R8 | k6 result doesn't match claim | Low | High | Fix bug, not the claim; never report untested numbers |
| R9 | Managed Postgres won't let us create the non-owner role or disallows FORCE RLS behavior we expect | Med | High | Test role provisioning in the M0 F6 hello-world deploy; fallback: provision roles with an owner-run SQL script (`scripts/provision-roles.sql`) or switch host to Render |
| R10 | Auditor query bugs give false confidence | Med | Med | Test every check against deliberately corrupted data (T-21); wording: "checks pass", never "proven correct" |

## Cut order (if behind) — cut from the top first
1. Slot booking UI (keep API + k6 test) — US-8 UI part
2. US-14 Skip, US-25 purge job (document as limitation), auditor UI/nightly job (keep CLI + CI step)
3. TV page polish (plain list is fine)
4. Super Admin UI (seed tenants via script)
5. Clinic Admin UI for staff/service points (seed via script)
6. Playwright E2E (never planned for MVP)

## Never cut
- M0 Foundation (DB applied, RLS proven, auth, hello-world deploy)
- RLS + isolation test
- Concurrency-safe call-next + idempotency + tests
- Event log
- k6 "200 → 1" result
- CI pipeline
- Deployed demo (even if minimal) and README with honest validation table

## Daily check (end of day)
- Are exit criteria for today's milestone met? If not, which cut is triggered?
- Is `main` green and deployable?
- Is `STATUS.md` updated?
