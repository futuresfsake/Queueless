# Implementation Plan

Status: Final v1.0 · Last updated: 2026-11-05

Ordered tasks per milestone. Check boxes as done; keep in sync with [milestones](milestones.md).

## M1 Scaffold (Nov 6)
- [ ] pnpm workspace: `apps/api`, `apps/web`, `packages/shared`
- [ ] `docker-compose.yml`: postgres:16, api, web; `.env.example`
- [ ] NestJS app with `/health` (checks DB)
- [ ] Vite + React + Tailwind + shadcn/ui boots
- [ ] ESLint + Prettier + tsconfig strict
- [ ] GitHub Actions: install, lint, build, (test placeholder)
- [ ] Fill "Commands" section in `CLAUDE.md`

## M2 Data & Auth (Nov 7)
- [ ] Prisma schema from [schema.md](../tech/schema.md)
- [ ] Migration SQL: roles (`queueless_owner`, `queueless_app`), RLS policies, FORCE RLS, CHECK constraints, append-only trigger, grants
- [ ] `TenantPrisma.run()` helper
- [ ] Auth module: login, JWT, `RolesGuard`, `@Roles()`
- [ ] Tenants / users / service-points CRUD
- [ ] Testcontainers setup (real Postgres, app role)
- [ ] **Test:** tenant A cannot read/write tenant B (INV-7)
- [ ] **Test:** unset tenant returns no rows

## M3 Queue core (Nov 8)
- [ ] `events` service (append event)
- [ ] `idempotency` interceptor + store (IN_PROGRESS → COMPLETED)
- [ ] Issue ticket (counter upsert, consent, token)
- [ ] Transition service with guarded UPDATE and event, one transaction
- [ ] `call-next` with `FOR UPDATE SKIP LOCKED`
- [ ] start / complete / no-show / skip / cancel
- [ ] **Tests:** INV-1, INV-2, INV-3 (parallel Promise.all of 3), INV-4 (replay), INV-6, INV-8

## M4 Real-time + Staff UI (Nov 9)
- [ ] Socket.IO gateway, rooms, auth for sockets
- [ ] Emit after commit
- [ ] Staff screen: queue lists, Call next (Space shortcut), actions
- [ ] TanStack Query + refetch on reconnect; reconnect banner
- [ ] Login page, route guards

## M5 Patient + TV + Booking (Nov 10)
- [ ] Public endpoints and rate limiting
- [ ] Join queue page, My ticket page (live), cancel
- [ ] TV page
- [ ] Slots CRUD + booking with `FOR UPDATE`
- [ ] Seed script (demo tenant, accounts, service points, slots)
- [ ] Phone purge job (`@nestjs/schedule`) — P1

## M6 Proof (Nov 11)
- [ ] k6: 200 concurrent bookings, 1 slot → exactly 1 success
- [ ] k6: 3 concurrent call-next → 3 distinct tickets
- [ ] k6: call-next latency p95 (record real numbers only)
- [ ] CI runs Jest + Testcontainers; k6 runs in CI against compose stack
- [ ] Projection rebuild test (replay events == tickets.status)
- [ ] Fill README validation table with real results

## M7 Deploy + README (Nov 12)
- [ ] Deploy API + Postgres (Railway/Render), web (Vercel)
- [ ] Run migrations as owner role; app connects as `queueless_app`
- [ ] Seed demo data; demo accounts documented
- [ ] README: overview, architecture diagram, setup, design decisions, validation table, limitations, CI badge

## M8 Demo + buffer (Nov 13)
- [ ] Record demo (split screen: staff, TV, phone; kill server on camera; recovery)
- [ ] Fix bugs, polish
- [ ] Final checklist in [test-plan](../testing/test-plan.md)

## Definition of done (every task)
1. Code + tests, citing story/invariant IDs.
2. Lint and tests pass locally and in CI.
3. Docs updated (schema/api/status).
4. Committed with a conventional message.
