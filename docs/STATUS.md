# Status

Last updated: 2026-11-06

Update this at the end of every work session. Latest session log: [sessions/2026-11-05.md](sessions/2026-11-05.md) (uses the old milestone numbering; see mapping in [milestones](plan/milestones.md)).

## Documentation
**Complete (v1.2).** Milestones restructured on 2026-11-06 so M0 is the foundation (see [CHANGELOG](CHANGELOG.md), D-32). All open questions are resolved in [decisions-log](product/decisions-log.md) (D-1..D-32). Edit a doc only with a dated change or a new ADR.

## Current milestone
**M0 Foundation** — F1 Docs done, F2 Scaffold done, F4 Database done (local, CI run pending push), F3 Platform & third-party (Railway/Vercel/k6/branch protection) partly done, F5 Auth next, F6 Hello-world deploy to do.

## Done
- F1: docs v1.1 + v1.2 restructure
- F2: pnpm workspace; `packages/shared` (Zod); `apps/api` (NestJS, `GET /api/v1/health`, 1 Jest test); `apps/web` (React + Vite + Tailwind v4, TanStack Query); `docker-compose.yml` (Postgres 16); GitHub Actions CI
- F4 done: `TenantPrisma`, `Clock`, `/health` DB check; Testcontainers harness; integration tests T-1, T-2, T-3, T-12, T-19 plus an RLS-enabled-on-every-table check (13 tests). Verified they fail when the app connects as superuser. 6 unit tests pass. Not yet run in GitHub Actions.

## Next
1. F3 (rest): Railway + Vercel accounts/projects, k6, branch protection, SMS lead-time items
2. F5: auth (JWT, RolesGuard, login throttle), tenants/users/service-points CRUD, Super Admin seed
3. F6: hello-world deploy (Railway + Vercel) with app role and WebSocket echo
4. Then M1 Queue core (Nov 8) per [milestones](plan/milestones.md)

## Blockers
- ~~Docker not running~~ — resolved 2026-11-06: Postgres 16 up on host port 5434; migrations applied locally.
- Railway and Vercel accounts: not yet confirmed to exist.

## Decision gates
- End of Nov 7 (hard stop Nov 8 morning): M0 F6 hello-world deploy with DB and WebSockets (D-4, D-32)
- Nov 13: feature freeze (D-24)
- Nov 15: verify SMS gateway inbound (D-20)

## Days left to Nov 14
8 (Nov 13 is buffer; Nov 14 is submission only)
