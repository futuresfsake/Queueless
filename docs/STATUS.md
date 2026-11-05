# Status

Last updated: 2026-11-05

Update this at the end of every work session.

## Documentation
**Complete and final (v1.1, senior review applied — see [CHANGELOG](CHANGELOG.md)).** Every doc is marked Final, all open questions are resolved in [decisions-log](product/decisions-log.md) (D-1..D-24), and the plan covers everything through the Dec 1–7 interviews. Edit a doc only with a dated change or a new ADR.

## Current milestone
M2 Data & Auth (in progress). M1 Scaffold done (CI green on `6d01092`).

## Done
- M0 docs, final (v1.1)
- M1: pnpm workspace; `packages/shared` (Zod); `apps/api` (NestJS, `GET /api/v1/health`, 1 Jest test); `apps/web` (React + Vite + Tailwind v4, TanStack Query); `docker-compose.yml` (Postgres 16); GitHub Actions CI
- M2 so far: Prisma 6 schema (now incl. `audit_runs`, `max_waiting`, nullable patient name; idempotency status removed), regenerated initial migration, and hand-written RLS migration (roles, CHECKs, append-only trigger, FORCE RLS, grants). `prisma validate`/`generate` pass. **The SQL has never been executed against a database.**

## Next
1. Start Docker Desktop, apply both migrations, fix SQL errors
2. `TenantPrisma.run()`, injectable `Clock`, auth (JWT, RolesGuard), tenant/user/service-point CRUD
3. Testcontainers; RLS isolation tests T-1..T-3
4. M3 queue core, then M4..M8 per [milestones](plan/milestones.md)

## Blockers
- Docker daemon not running on this machine (needed for `docker compose up` and Testcontainers). Local PostgreSQL 17 exists but its password is unknown to the assistant.

## Decision gates
- Nov 8: deploy hello-world to Railway/Vercel with DB + WebSockets (D-4)
- Nov 13: feature freeze (D-24)
- Nov 15: verify SMS gateway inbound (D-20)

## Days left to Nov 14
9 (Nov 13 is buffer; Nov 14 is submission only)
