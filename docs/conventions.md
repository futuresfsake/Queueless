# Conventions

Status: Draft · Last updated: 2026-11-05

## Repo layout (target)
```
Queueless/
├─ apps/
│  ├─ api/          # NestJS + Prisma
│  └─ web/          # React + Vite (staff, TV, patient)
├─ packages/
│  └─ shared/       # Zod schemas + shared types
├─ k6/              # load/concurrency tests
├─ simulator/       # post-MVP
├─ docs/
├─ docker-compose.yml
└─ .github/workflows/ci.yml
```
Package manager: pnpm workspaces.

## Git
- Branch: `main` is always deployable. Feature branches: `feat/<story-id>-short-name`, `fix/...`, `docs/...`.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`). Reference IDs: `feat(queue): call-next with SKIP LOCKED (US-10, INV-3)`.
- Small commits. One concern per commit.

## Code
- TypeScript strict. No `any` without a comment explaining why.
- Validation: Zod schemas in `packages/shared`, used by both API and web.
- API errors share one shape: `{ "error": { "code": "TICKET_NOT_WAITING", "message": "...", "details": {} } }`.
- Every queue-changing endpoint requires an `Idempotency-Key` header.
- All tenant-scoped DB access goes through `TenantPrisma.run(tenantId, fn)` (opens a transaction and sets `app.tenant_id`). Never use the bare Prisma client for tenant data.
- Raw SQL (locks, RLS, constraints) lives in Prisma migrations or `apps/api/src/db/sql/`, with a comment explaining why.
- Times stored as UTC `timestamptz`. Display in `Asia/Manila`.
- Queue dates (ticket number reset per day) use the clinic's local date (`Asia/Manila`).

## Naming
- DB: `snake_case` tables (plural), columns. Enums `UPPER_SNAKE`.
- Code: `camelCase` vars, `PascalCase` classes/components, `kebab-case` files.
- Event types: `TICKET_ISSUED`, `CALLED`, `STARTED`, `SERVED`, `SKIPPED`, `NO_SHOW`, `CANCELLED`, `TRANSFERRED`.

## Tests
- Unit: Jest, next to the file (`*.spec.ts`).
- Integration: Jest + Testcontainers (real Postgres, real RLS, non-owner role). Folder `apps/api/test/`.
- E2E: Playwright (post-core, if time).
- Concurrency: k6 in `k6/`.
- Test names cite IDs: `it('US-18 / INV-3: three concurrent call-next return three different tickets')`.

## Docs
- Update docs in the same change as the code. Update `docs/STATUS.md` at the end of each session.
- Each doc has a status and date at the top.
