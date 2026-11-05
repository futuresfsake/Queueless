# Queueless

> Wait anywhere. Get called when it's your turn.

Multi-tenant, real-time queue and appointment system for clinics and barangay health centers in the Philippines. Built as a portfolio project; correctness under concurrency is the focus.

**Status:** In development (MVP target: Nov 14, 2026). Nothing below is claimed until measured — see the validation table.

<!-- CI badge, live demo link, and demo GIF go here once available -->

## Features (MVP)
- Multi-tenant with PostgreSQL row-level security
- Walk-in tickets and slot booking (web)
- Live staff queue screen, TV "Now Serving" display, patient ticket page
- Concurrency-safe "Call next" (`FOR UPDATE SKIP LOCKED`) with idempotency keys
- Append-only event log
- Roles: Super Admin, Clinic Admin, Staff, guest Patient

Post-MVP: two-way SMS (outbox), multi-stage visits, wait-time estimates, simulator.

## Architecture
See [docs/tech/TRD-HLD.md](docs/tech/TRD-HLD.md) (diagram to be copied here).

## Stack
React + Vite + TypeScript, Tailwind, shadcn/ui · NestJS · Prisma · PostgreSQL 16 · Socket.IO · Zod · Jest, Testcontainers, k6 · Docker Compose, GitHub Actions

## Quick start
_TBD — `docker compose up` once scaffolded._

## Design decisions
- [ADR-001 Tenancy via RLS](docs/decisions/ADR-001-tenancy-via-rls.md)
- [ADR-002 Event log](docs/decisions/ADR-002-event-log.md)
- [ADR-003 Row locking](docs/decisions/ADR-003-concurrency-locking.md)
- [ADR-004 Idempotency keys](docs/decisions/ADR-004-idempotency-keys.md)
- [ADR-005 No Redis in MVP](docs/decisions/ADR-005-no-redis-in-mvp.md)

## Validation
| What | How | Result |
|---|---|---|
| No double-booking | k6: 200 concurrent requests, 1 slot | TBD |
| No skipped/duplicate calls | 3 simultaneous call-next | TBD |
| Crash recovery | API restarted mid-run | TBD |
| Latency | k6 | TBD |
| Wait-time estimates | Simulated patients | TBD |
| Usability | 5 testers, 3 tasks | TBD |

Details: [docs/testing/validation-results.md](docs/testing/validation-results.md)

**Not yet validated:** real clinic workflows and patient behavior.
**In a pilot I would measure:** actual waits vs. estimates, no-show rate, SMS delivery rate.

## Privacy
Collects only a name/nickname and optional phone number, with logged consent. Never symptoms or diagnoses. Phone numbers are deleted after 30 days. See [security-privacy](docs/tech/security-privacy.md).

## Limitations
- Single API instance (no Redis adapter yet)
- No real clinic validation yet
- SMS not implemented in MVP

## Docs
Start at [docs/INDEX.md](docs/INDEX.md).
