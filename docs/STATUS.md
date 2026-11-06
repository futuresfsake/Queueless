# Status

Last updated: 2026-11-06

Update this at the end of every work session. Latest session log: [sessions/2026-11-05.md](sessions/2026-11-05.md) (uses the old milestone numbering; see mapping in [milestones](plan/milestones.md)).

## Documentation
**Complete (v1.2).** Milestones restructured on 2026-11-06 so M0 is the foundation (see [CHANGELOG](CHANGELOG.md), D-32). All open questions are resolved in [decisions-log](product/decisions-log.md) (D-1..D-32). Edit a doc only with a dated change or a new ADR.

## Current milestone
**M0 Foundation** — F1 Docs done, F2 Scaffold done (CI green on `6d01092`), F3 Platform & third-party **next**, F4 Database, F5 Auth, F6 Hello-world deploy still to do.

## Done
- F1: docs v1.1 + v1.2 restructure
- F2: pnpm workspace; `packages/shared` (Zod); `apps/api` (NestJS, `GET /api/v1/health`, 1 Jest test); `apps/web` (React + Vite + Tailwind v4, TanStack Query); `docker-compose.yml` (Postgres 16); GitHub Actions CI
- Part of F4 written but unverified: Prisma 6 schema and the init + hand-written RLS migrations. `prisma validate`/`generate` pass. **The SQL has never been executed against a database.**

## Next
1. F3: start Docker Desktop, `.env`, Railway + Vercel accounts/projects, k6, branch protection, SMS lead-time items
2. F4: apply both migrations, fix SQL errors, `TenantPrisma.run()`, `Clock`, Testcontainers, tests T-1..T-3
3. F5: auth (JWT, RolesGuard, login throttle), tenants/users/service-points CRUD, Super Admin seed
4. F6: hello-world deploy (Railway + Vercel) with app role and WebSocket echo
5. Then M1 Queue core (Nov 8) per [milestones](plan/milestones.md)

## Blockers
- Docker daemon not running on this machine (needed for `docker compose up` and Testcontainers). Local PostgreSQL 17 exists but its password is unknown to the assistant.
- Railway and Vercel accounts: not yet confirmed to exist.

## Decision gates
- End of Nov 7 (hard stop Nov 8 morning): M0 F6 hello-world deploy with DB and WebSockets (D-4, D-32)
- Nov 13: feature freeze (D-24)
- Nov 15: verify SMS gateway inbound (D-20)

## Days left to Nov 14
8 (Nov 13 is buffer; Nov 14 is submission only)
