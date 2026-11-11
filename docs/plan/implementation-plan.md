# Implementation Plan

Status: Final v1.2 · Last updated: 2026-11-06

Ordered tasks per milestone. Check boxes as done; keep in sync with [milestones](milestones.md).

## M0 Foundation (Nov 5–7)

### F1 Docs — done
- [x] Full documentation set v1.1

### F2 Scaffold — done
- [x] pnpm workspace: `apps/api`, `apps/web`, `packages/shared`
- [x] `docker-compose.yml` (postgres:16) and `.env.example`
- [x] NestJS app with `/health`
- [x] Vite + React + Tailwind + TanStack Query boots
- [x] ESLint + Prettier + tsconfig strict
- [x] GitHub Actions: install, lint, build, test
- [x] Fill "Commands" section in the contributor guide
- [x] `/health` also checks the DB (done in F4)

### F3 Platform & third-party setup
- [x] Start Docker Desktop; `docker compose up -d postgres` healthy (host port 5434; image postgres:16-alpine)
- [x] Copy `.env.example` → `.env` (local dev placeholders; `.env` is git-ignored). Real secrets only in Railway/GitHub secret stores
- [ ] Railway: account, project, Postgres plugin, API service linked to the GitHub repo
- [ ] Vercel: account, project linked to `apps/web`
- [ ] GitHub: Actions secrets for deploy (if needed), branch protection requiring CI green on `main`
- [ ] Install k6 locally (`k6 version`)
- [ ] Start SMS lead-time items (prepaid SIM, Android phone for httpSMS, Semaphore account) — used post-MVP only (D-20, gate Nov 15)
- [ ] Write the chosen versions/accounts (no secrets) in the runbook

### F4 Database
- [x] Apply `init` then `rls_and_constraints` migrations as `queueless_owner` (via `scripts/provision-roles.sql` first) — applied cleanly, no SQL changes needed
- [x] `ALTER ROLE queueless_app PASSWORD ...` (local placeholder)
- [x] Verify the app connection: `rolsuper = false`, `rolbypassrls = false` (local; repeat on Railway in F6)
- [x] `TenantPrisma` (`run`, `runAsSuperAdmin`, `runForLogin`, `runForTicketToken`): one transaction, transaction-local `set_config`, tenant id validated as UUID
- [x] Injectable `Clock` (`SystemClock`, `FakeClock`, `localDate` for Asia/Manila)
- [x] `/health` checks the DB (via Prisma)
- [x] Testcontainers setup (real Postgres 16, provisioned like prod, app role; `pnpm --filter @queueless/api test:int`; CI step added)
- [x] **Test T-1:** tenant A cannot read/write tenant B (INV-7)
- [x] **Test T-2:** unset tenant returns no rows; writes rejected; no leak across pooled transactions
- [x] **Tests T-3, T-12:** app role is non-owner, no BYPASSRLS; every table RLS-forced; `queue_events` is append-only

### F5 Auth & tenancy
- [x] Auth module: login, JWT (8 h), `AuthGuard` + `RolesGuard` (default deny), `@Roles()`, `@Public()`; user re-checked every request (D-34)
- [x] Login throttle: 5 failures / 15 min per email + 20 per IP (D-28, D-35)
- [x] Tenants / users / service-points CRUD (Zod schemas in `packages/shared`)
- [x] Super Admin seed script (`seed:super-admin`, credentials from env, D-17). Demo tenant seed is M3
- [x] RBAC tests per role (T-17, T-25, US-1..US-4, US-21): 32 integration tests

### F6 Hello-world deploy (D-4 gate)
- [x] (prepared + rehearsed locally) Migration runner `migrate.js`: provision -> migrate as owner -> set app password -> A-6 guard
- [ ] Run it on Railway Postgres (first deploy, see runbook)
- [x] (prepared) Dockerfile, `railway.toml`, `apps/web/vercel.json`, `VITE_API_URL`, CORS via `CORS_ORIGINS`, non-root container
- [ ] Deploy API (connects as `queueless_app`) and web (Vercel); CORS set
- [x] (prepared) Socket.IO echo gateway + web WebSocket check; verified against the production container with the allowed origin
- [ ] WebSocket echo works from the Vercel origin
- [ ] `/health` green on the live URL; `rolsuper`/`rolbypassrls` false/false on the deployed connection
- [ ] If role creation or WebSockets fail: apply R4/R9 fallback (owner-run `scripts/provision-roles.sql`, or switch to Render)

## M1 Queue core (Nov 8)
- [x] `events` service (append event)
- [x] Idempotency store as a service called inside the request transaction (not an interceptor: the key must commit with the queue change; no IN_PROGRESS state, ADR-004 v1.1)
- [x] Issue ticket (counter upsert, consent, token) — staff walk-in endpoint; public endpoint is M3
- [x] Transition service with guarded UPDATE and event, one transaction
- [x] `call-next` with `FOR UPDATE SKIP LOCKED`
- [x] start / complete / no-show / skip / cancel
- [x] **Tests** (`apps/api/test/queue.int.spec.ts`, `src/queue/ticket-state-machine.spec.ts`): T-4..T-11, T-13, T-14, T-16, T-22, T-24, INV-1, INV-2, INV-3 (incl. deterministic lock-overlap test), INV-4, INV-8. Mutation-checked: dropping `SKIP LOCKED`, the status guard, or the idempotency claim each fails tests.
- [ ] Not in M1 (later milestones): T-12 already done (F4); T-18 purge (P1), T-23 booking/cancel slot release (M3; the slot-release path in `applyTransition` is written but untested until booking exists)

## M2 Real-time + Staff UI (Nov 9)
- [x] Socket.IO gateway, rooms, auth for sockets (`realtime.gateway.ts`: JWT checked in a Socket.IO middleware, room per tenant + service point, signal-only `queue.changed`; tests in `test/realtime.int.spec.ts`)
- [x] Emit after commit (`QueueService.afterCommit`; no emit when the request fails)
- [x] shadcn/ui init (D-13): Button, Input, Label, Card, Badge
- [x] Staff screen (`/staff`): Called / Serving / Waiting lists, Call next (Space), start/complete/no-show/skip/cancel, walk-in form; idempotency key per click
- [x] TanStack Query + refetch on socket (re)connect; reconnect banner
- [x] Login page, route guard by role (UI only; the API enforces permissions)

## M3 Patient + TV + Booking (Nov 10)
- [x] Public endpoints and rate limiting (backend; `test/public.int.spec.ts`)
- [x] Join queue page (`/c/:slug`, with slot booking), My ticket page (`/t/:token`, live, cancel)
- [x] TV page (`/tv/:slug/:code`)
- [x] Slots create/list + booking with `FOR UPDATE`; cancellation releases the slot (D-29, T-23); 25 concurrent bookings of one place -> exactly 1 succeeds (INV-5, Jest; the k6 version is M4)
- [x] Seed script (`pnpm --filter @queueless/api seed:demo`, password from `DEMO_PASSWORD`)
- [ ] Phone purge job (`@nestjs/schedule`) — P1

## M4 Proof (Nov 11)
- [x] k6: 200 concurrent bookings, 1 slot → exactly 1 success (`k6/booking-race.js`, 2026-11-12, local run)
- [x] k6: 3 concurrent call-next → 3 distinct tickets (`k6/call-next.js`, 90 calls, 3 desks)
- [x] k6: call-next latency p95 (record real numbers only) (in validation-results, local run)
- [ ] CI runs Jest + Testcontainers; k6 runs in CI against compose stack
- [ ] Projection rebuild test (replay events == tickets.status)
- [x] Invariant auditor (CLI only, per the cut rule): `AuditService` A-1..A-8 as pure SQL, `pnpm --filter @queueless/api audit` (exit 1 on failure), results stored in `audit_runs`; T-21 in `test/audit.int.spec.ts` (clean data passes; each check fails with its own ID on corrupted data). Not built: `/admin/audit` endpoint and UI; CI step (needs the compose stack, see below)
- [ ] Abuse protection: `max_waiting`, per-IP join cap, guest-token expiry (US-36, T-24..T-26); login throttle already in F5
- [ ] Fill README validation table with real results

## M5 Deploy + README (Nov 12)
- [ ] Deploy the real app over the F6 hello-world (same pipeline, same roles)
- [ ] Seed demo data on production; demo accounts documented
- [ ] Run auditor CLI against production (A-6 posture)
- [ ] README: overview, architecture diagram, setup, design decisions, validation table, limitations, CI badge

## M6 Demo + buffer (Nov 13)
- [ ] Record demo (split screen: staff, TV, phone; kill server on camera; recovery)
- [ ] Fix bugs, polish
- [ ] Final checklist in [test-plan](../testing/test-plan.md)

## Definition of done (every task)
1. Code + tests, citing story/invariant IDs.
2. Lint and tests pass locally and in CI.
3. Docs updated (schema/api/status).
4. Committed with a conventional message.
