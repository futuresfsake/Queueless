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
- [x] Fill "Commands" section in `CLAUDE.md`
- [ ] `/health` also checks the DB (do in F4 once DB is reachable)

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
- [ ] `TenantPrisma.run()` helper (transaction + `set_config('app.tenant_id', $1, true)`)
- [ ] Injectable `Clock` service (D-19)
- [ ] `/health` checks the DB
- [ ] Testcontainers setup (real Postgres, app role)
- [ ] **Test T-1:** tenant A cannot read/write tenant B (INV-7)
- [ ] **Test T-2:** unset tenant returns no rows
- [ ] **Test T-3:** `queue_events` is append-only (UPDATE/DELETE rejected)

### F5 Auth & tenancy
- [ ] Auth module: login, JWT (8 h), `RolesGuard`, `@Roles()`
- [ ] Login throttle: 5 failures / 15 min (D-28)
- [ ] Tenants / users / service-points CRUD
- [ ] Minimal seed: Super Admin by script only (D-17)
- [ ] RBAC tests per role (Super Admin / Clinic Admin / Staff)

### F6 Hello-world deploy (D-4 gate)
- [ ] Run migrations as owner on Railway Postgres; set app role password
- [ ] Deploy API (connects as `queueless_app`) and web (Vercel); CORS set
- [ ] WebSocket echo works from the Vercel origin
- [ ] `/health` green on the live URL; `rolsuper`/`rolbypassrls` false/false on the deployed connection
- [ ] If role creation or WebSockets fail: apply R4/R9 fallback (owner-run `scripts/provision-roles.sql`, or switch to Render)

## M1 Queue core (Nov 8)
- [ ] `events` service (append event)
- [ ] `idempotency` interceptor + store (no IN_PROGRESS state, ADR-004 v1.1)
- [ ] Issue ticket (counter upsert, consent, token)
- [ ] Transition service with guarded UPDATE and event, one transaction
- [ ] `call-next` with `FOR UPDATE SKIP LOCKED`
- [ ] start / complete / no-show / skip / cancel
- [ ] **Tests:** INV-1, INV-2, INV-3 (parallel Promise.all of 3), INV-4 (replay), INV-6, INV-8

## M2 Real-time + Staff UI (Nov 9)
- [ ] Socket.IO gateway, rooms, auth for sockets
- [ ] Emit after commit
- [ ] shadcn/ui init (D-13)
- [ ] Staff screen: queue lists, Call next (Space shortcut), actions
- [ ] TanStack Query + refetch on reconnect; reconnect banner
- [ ] Login page, route guards

## M3 Patient + TV + Booking (Nov 10)
- [ ] Public endpoints and rate limiting
- [ ] Join queue page, My ticket page (live), cancel
- [ ] TV page
- [ ] Slots CRUD + booking with `FOR UPDATE`; cancellation releases the slot (D-29, T-23)
- [ ] Seed script (demo tenant, accounts, service points, slots)
- [ ] Phone purge job (`@nestjs/schedule`) — P1

## M4 Proof (Nov 11)
- [ ] k6: 200 concurrent bookings, 1 slot → exactly 1 success
- [ ] k6: 3 concurrent call-next → 3 distinct tickets
- [ ] k6: call-next latency p95 (record real numbers only)
- [ ] CI runs Jest + Testcontainers; k6 runs in CI against compose stack
- [ ] Projection rebuild test (replay events == tickets.status)
- [ ] Invariant auditor: `AuditService` (A-1..A-8), `audit_runs`, `/admin/audit`, CLI `pnpm --filter api audit`, CI step after k6 (US-33, T-21) — cut rule: CLI + CI only
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
