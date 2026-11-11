# Status

Last updated: 2026-11-12

Update this at the end of every work session. Latest session log: [sessions/2026-11-05.md](sessions/2026-11-05.md) (uses the old milestone numbering; see mapping in [milestones](plan/milestones.md)).

## Documentation
**Complete (v1.2).** Milestones restructured on 2026-11-06 so M0 is the foundation (see [CHANGELOG](CHANGELOG.md), D-32). All open questions are resolved in [decisions-log](product/decisions-log.md) (D-1..D-32). Edit a doc only with a dated change or a new ADR.

## Current milestone
**M1 Queue core** — backend done and tested (see Done). M0 is **not fully closed**: F6 real deploy (Railway + Vercel) is still waiting on accounts. Note the plan dates are behind: the schedule said M1 on Nov 8, today is Nov 10, so M2 (real-time + staff UI), M3 and M4 (the proof) are all still ahead with 4 working days to the Nov 13 freeze.

## Done
- F1: docs v1.1 + v1.2 restructure
- F2: pnpm workspace; `packages/shared` (Zod); `apps/api` (NestJS, `GET /api/v1/health`, 1 Jest test); `apps/web` (React + Vite + Tailwind v4, TanStack Query); `docker-compose.yml` (Postgres 16); GitHub Actions CI
- F4 done: `TenantPrisma`, `Clock`, `/health` DB check; Testcontainers harness; integration tests T-1, T-2, T-3, T-12, T-19 plus an RLS-enabled-on-every-table check (13 tests). Verified they fail when the app connects as superuser. CI green on `051e78b` (including these integration tests on the runner).
- F5 done: login (JWT 8 h), default-deny `AuthGuard`+`RolesGuard`, per-request user re-check, login throttle, tenants/users/service-points API, Super Admin seed script. Verified: 14 unit + 45 integration tests green; mutation-checked (breaking RolesGuard or the live-user check fails 6 tests); smoke-tested the real API in dev (`pnpm dev`) and the production build (`node dist/main.js`) against the local DB. Found and fixed: `tsx` cannot run NestJS DI (see conventions.md).

- F6 prepared (not deployed): migration runner with A-6 safety guard, Dockerfile (non-root) + `railway.toml`, Socket.IO echo gateway, web hello page (API health + WebSocket check), `vercel.json`, CI builds the image, runbook "First deploy". Rehearsed: image built and run in production mode against an empty DB (provision, migrate, guard, health, WebSocket echo, CORS allow/deny); guard verified to stop the container when `DATABASE_URL` is the owner.

- M1 queue core (API): issue ticket (staff walk-in), `call-next` (`FOR UPDATE SKIP LOCKED`), start/complete/no-show/skip/cancel, append-only events, idempotency (service inside the request transaction), staff queue view. State machine is pure data (`ticket-state-machine.ts`) with a table-driven unit test. Raw SQL is in `apps/api/src/db/sql/queue.sql.ts`. Verified: lint, build, 18 unit and 81 integration tests green (34 new in `queue.int.spec.ts`). Mutation-checked: removing `SKIP LOCKED` (caught only by the deterministic lock-overlap test, not by the parallel-HTTP test), the status guard, or the idempotency claim each fails tests. Not yet committed.

- M2 (2026-11-12): staff real-time channel (JWT handshake, tenant rooms, emit after commit; 5 integration tests) and staff web UI (login, route guard, staff screen, walk-in form, reconnect banner, shadcn/ui). Smoke-tested live through the Vite proxy: login, subscribe, issue ticket, `queue.changed` received. The staff screen was typechecked and built but not yet clicked through in a browser.

## Next
1. Commit M1 (not committed yet; ask-first rule) and push so CI runs the new integration tests
2. M2: Socket.IO rooms with socket auth, emit **after commit** (events are written in the request transaction, so emitting from inside `applyTransition` would announce changes that could still roll back), shadcn/ui init, staff screen with Call next, login page
3. M3 (public ticket page, TV, booking with `FOR UPDATE`, seed) then M4 (k6 + auditor): do not cut M4
4. **You:** Railway + Vercel accounts and `docs/ops/deployment-runbook.md` "First deploy" (F6 gate is overdue; fallback in risks-and-cuts R4/R9)

## Blockers
- ~~Docker not running~~ — resolved 2026-11-06: Postgres 16 up on host port 5434; migrations applied locally.
- Railway and Vercel accounts: not yet confirmed to exist.

## Decision gates
- End of Nov 7 (hard stop Nov 8 morning): M0 F6 hello-world deploy with DB and WebSockets (D-4, D-32)
- Nov 13: feature freeze (D-24)
- Nov 15: verify SMS gateway inbound (D-20)

## Days left to Nov 14
4 to the Nov 13 freeze (Nov 10 to Nov 13); Nov 14 is submission only
