# Status

Last updated: 2026-11-06

Update this at the end of every work session. Latest session log: [sessions/2026-11-05.md](sessions/2026-11-05.md) (uses the old milestone numbering; see mapping in [milestones](plan/milestones.md)).

## Documentation
**Complete (v1.2).** Milestones restructured on 2026-11-06 so M0 is the foundation (see [CHANGELOG](CHANGELOG.md), D-32). All open questions are resolved in [decisions-log](product/decisions-log.md) (D-1..D-32). Edit a doc only with a dated change or a new ADR.

## Current milestone
**M0 Foundation** — F1, F2, F4, F5 done. F6 deploy code is ready and rehearsed locally; **waiting on Railway + Vercel accounts** to run the real deploy (F3 rest). Gate: end of Nov 7.

## Done
- F1: docs v1.1 + v1.2 restructure
- F2: pnpm workspace; `packages/shared` (Zod); `apps/api` (NestJS, `GET /api/v1/health`, 1 Jest test); `apps/web` (React + Vite + Tailwind v4, TanStack Query); `docker-compose.yml` (Postgres 16); GitHub Actions CI
- F4 done: `TenantPrisma`, `Clock`, `/health` DB check; Testcontainers harness; integration tests T-1, T-2, T-3, T-12, T-19 plus an RLS-enabled-on-every-table check (13 tests). Verified they fail when the app connects as superuser. CI green on `051e78b` (including these integration tests on the runner).
- F5 done: login (JWT 8 h), default-deny `AuthGuard`+`RolesGuard`, per-request user re-check, login throttle, tenants/users/service-points API, Super Admin seed script. Verified: 14 unit + 45 integration tests green; mutation-checked (breaking RolesGuard or the live-user check fails 6 tests); smoke-tested the real API in dev (`pnpm dev`) and the production build (`node dist/main.js`) against the local DB. Found and fixed: `tsx` cannot run NestJS DI (see conventions.md).

- F6 prepared (not deployed): migration runner with A-6 safety guard, Dockerfile (non-root) + `railway.toml`, Socket.IO echo gateway, web hello page (API health + WebSocket check), `vercel.json`, CI builds the image, runbook "First deploy". Rehearsed: image built and run in production mode against an empty DB (provision, migrate, guard, health, WebSocket echo, CORS allow/deny); guard verified to stop the container when `DATABASE_URL` is the owner.

## Next
1. **You:** create Railway + Vercel accounts and follow `docs/ops/deployment-runbook.md` "First deploy" (or tell me where you get stuck). Then F3 rest: k6, branch protection, SMS lead-time items
2. F6: run the real deploy and tick the gate checklist
3. Then M1 Queue core (Nov 8) per [milestones](plan/milestones.md)

## Blockers
- ~~Docker not running~~ — resolved 2026-11-06: Postgres 16 up on host port 5434; migrations applied locally.
- Railway and Vercel accounts: not yet confirmed to exist.

## Decision gates
- End of Nov 7 (hard stop Nov 8 morning): M0 F6 hello-world deploy with DB and WebSockets (D-4, D-32)
- Nov 13: feature freeze (D-24)
- Nov 15: verify SMS gateway inbound (D-20)

## Days left to Nov 14
8 (Nov 13 is buffer; Nov 14 is submission only)
