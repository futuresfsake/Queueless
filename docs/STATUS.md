# Status

Last updated: 2026-11-05

Update this at the end of every work session.

## Current milestone
M1 Scaffold — **done** (CI green on `6d01092`). Next: M2 Data & Auth.

## Done
- M0 docs (see [INDEX](INDEX.md))
- M1: pnpm workspace; `packages/shared` (Zod); `apps/api` (NestJS, `GET /api/v1/health`, 1 Jest test); `apps/web` (React + Vite + Tailwind v4, TanStack Query, shows API health); `docker-compose.yml` (Postgres 16); GitHub Actions CI (lint, test, build) passing

## In progress (M2 Data & Auth)
- Done, **not yet run against a database**: Prisma 6 schema, initial migration, and hand-written RLS migration (roles, CHECKs, append-only trigger, FORCE RLS, grants). `prisma validate` and `prisma generate` pass; the SQL has never been executed.

## Next (M2 Data & Auth)
1. Start Docker Desktop, apply both migrations, fix any SQL errors
2. `TenantPrisma.run()`; auth (JWT, RolesGuard); tenant/user/service-point CRUD
3. Testcontainers setup; RLS isolation tests T-1..T-3 (these are what actually prove the SQL)

## Blockers
- **Docker daemon is not running** on this machine (CLI present, Docker Desktop not started). Needed for `docker compose up` and Testcontainers. A local PostgreSQL 17 service is running, but its superuser password is unknown to the assistant.
- shadcn/ui not initialized yet (add when the first UI components are needed).

## Open decisions
- Redis for MVP: decided **no** (ADR-005).
- `call-next` on empty queue: `409 QUEUE_EMPTY` vs `204` — decide at implementation.
- SKIPPED final for MVP.
- Hosting: Railway vs Render — decide by Nov 8 (deploy hello-world early, R4).

## Days left to Nov 14
9 (Nov 13 is buffer; Nov 14 is submission only)
