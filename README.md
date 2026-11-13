# Queueless

> Wait anywhere. Get called when it's your turn.

A multi-tenant, real-time queue and appointment system for clinics and barangay health centers in the Philippines. A portfolio project, built by one person. The focus is correctness under concurrency, and being honest about what has and has not been proven.

**Status (2026-11-13):** the MVP is built, tested, and deployed as a free-tier demo (link below). Everything in the results table below was measured on a developer laptop, not on the deployed demo. What is missing or unverified is listed in [docs/KNOWN-GAPS.md](docs/KNOWN-GAPS.md); please read it before judging the project.

## Try it live
**https://queueless-x2wz.onrender.com**

The demo runs on free tiers (Render for the app, Neon for PostgreSQL). **If nobody has used it for a while it sleeps, so the first load can take about a minute.**

| Who | Where | Login |
|---|---|---|
| Patient (no account) | [Join or book a place](https://queueless-x2wz.onrender.com/c/demo-clinic) | none |
| TV display | [General Consult board](https://queueless-x2wz.onrender.com/tv/demo-clinic/general) | none |
| Staff | [Sign in](https://queueless-x2wz.onrender.com/login) | `staff@demo-clinic.example` / `EuUyRHWb6PEEwFRV` |
| Clinic Admin | [Sign in](https://queueless-x2wz.onrender.com/login), then `/admin` | `admin@demo-clinic.example` / `EuUyRHWb6PEEwFRV` |

These are **shared demo accounts** for a clinic called "Demo Health Center". All data in it is made up; please do not enter real names, phone numbers or health information. Anyone can use these accounts, so the data may be changed or reset at any time. A good first try: open the TV board in one tab, join the queue as a patient in a second, then sign in as staff in a third and press **Call next**.

<!-- CI badge and demo GIF go here once they exist. -->

## What works today
- **Multi-tenant** data isolation with PostgreSQL row-level security (the API connects as a non-owner role). Tests check that one clinic cannot read or change another's data.
- **Staff queue screen** (`/staff`): waiting, called and serving lists, **Call next** (button or Space), start, complete, no-show, skip, cancel, walk-in registration with consent. Updates live.
- **Patient pages, no account needed:** join the queue or book a slot today (`/c/:clinic`), then a live ticket page (`/t/:token`) showing people ahead, now serving, and cancel.
- **TV display** (`/tv/:clinic/:service-point`): "Now serving" and next numbers. Numbers only, never names.
- **Clinic Admin setup** (`/admin`): service points, staff accounts, booking slots.
- **Concurrency safety:** `Call next` uses `FOR UPDATE SKIP LOCKED`; slot booking takes a row lock; every queue-changing action carries an idempotency key stored in the same transaction as the change.
- **Append-only event log:** the ticket status can be rebuilt from the events.
- **Invariant auditor:** eight read-only SQL checks (A-1 to A-8) run from a command line. Each check is also tested to fail on deliberately corrupted data.
- **Privacy:** only a name or nickname and an optional phone number are collected, consent is logged, and a purge job clears name and phone 30 days after the ticket was issued. Symptoms and diagnoses are never collected.
- **Roles:** Super Admin, Clinic Admin, Staff, and guest Patient (by private ticket link).

## Results (measured, with conditions)
Where and how these were measured: one developer laptop (Windows 11), API in dev mode on the same machine, PostgreSQL 16 in Docker on the same machine, k6 in Docker, one client IP, a small data set, and the per-IP rate limit raised for the race test. These show correctness under concurrency; they are **not** a production capacity claim. Not run in CI, not run against a deployed instance. Date: 2026-11-12.

| What | How | Result |
|---|---|---|
| No double-booking | k6: 200 concurrent bookings of the last place in one slot | 1 booked, 199 `SLOT_FULL`, 0 other responses; slot count exactly 1 |
| No duplicate or skipped calls | k6: 3 desks calling 90 tickets at once | 90 distinct tickets, none left waiting, 0 errors |
| Call-next latency | same run | p95 20.9 ms, median 16.7 ms, max 26.7 ms (90 calls, light load) |
| Integrity checks A-1..A-8 | auditor after the k6 runs | all pass; each check also proven to fail on corrupted data |
| Automated tests | Jest unit + Testcontainers integration (real Postgres) | 18 unit and 112 integration tests pass locally; CI passed on the last checked commit |
| Browser behaviour | one scripted headless-Chromium pass (not in the repo) | 17 of 17 checks: login, join, live updates, Space to call, reconnect banner after stopping and restarting the API, admin create |
| Crash recovery under load | API restarted mid-run | **not measured** |
| Wait-time estimates, simulated day | simulator | **not built** |
| Usability | 5 testers | **not done** |

Details and caveats: [docs/testing/validation-results.md](docs/testing/validation-results.md).

## Limitations (please read)
- **The live demo is a free-tier deployment.** It sleeps when idle (first load can take about a minute), runs one instance, and has had only a light manual check since it was deployed. The demo accounts are shared and their password is published here on purpose, so treat everything in the demo as public and fake.
- **No SMS.** Patients are told only through the live web page. There is no notification if the page is closed.
- **Single API server.** Rate limits and login throttling are in memory; real-time uses one Socket.IO server with no Redis adapter.
- **Booking is today only, and booked patients queue in order of arrival.** Slot time is informational; a booking does not guarantee a call at that time.
- **Browser coverage is thin.** One scripted pass in Chromium. No Firefox, Safari, real phone, accessibility or slow-network testing. No end-to-end tests in CI.
- **k6 and the auditor are not in CI yet.** They were run by hand.
- **Auditor scope.** It checks that what the system recorded is internally consistent. It cannot know about a patient who walked away. "The integrity checks pass" is the claim, not "the system is proven correct".
- **The ticket link is the patient's only credential.** Whoever has it can see and cancel that ticket. It is unguessable and expires 24 hours after the ticket finishes.
- **English only.** Strings are in one catalog so Cebuano and Filipino can be added, but no translation exists.
- **No real clinic has used this.** Real workflows and patient behaviour are unvalidated. In a pilot I would measure actual waits, no-show rate and how staff really use the screens.

## Architecture
```
Patient phone / TV / Staff browser (React + Vite)
        |  HTTPS (JSON)              |  WebSocket (Socket.IO: "queue changed" hints only)
        v                            v
              NestJS API  ---- JWT auth, roles, default-deny guards
                  |             per-request transaction sets app.tenant_id
                  v
        PostgreSQL 16 (row-level security, append-only queue_events,
                       row locks, idempotency keys)
```
- Sockets carry no data. After a hint (or a reconnect) the client refetches the snapshot over HTTP, so authorization lives in one place.
- Event log is the source of truth for ticket state; the ticket row is a rebuildable projection.
- More: [docs/tech/TRD-HLD.md](docs/tech/TRD-HLD.md).

## Stack
React + Vite + TypeScript, Tailwind v4, shadcn/ui, TanStack Query, Zustand · NestJS · Prisma · PostgreSQL 16 · Socket.IO · Zod (shared schemas) · Jest, Testcontainers, k6 · Docker, GitHub Actions

## Run it locally
Needs Node 22, pnpm and Docker.

```bash
cp .env.example .env                      # local placeholders; set your own JWT_SECRET
pnpm install
docker compose up -d postgres             # Postgres 16 on host port 5434
pnpm --filter @queueless/shared build
pnpm --filter @queueless/api exec prisma generate
# First time only: the superuser connection creates the owner role. OWNER_PASSWORD must match the
# password inside MIGRATION_DATABASE_URL in your .env. Later runs need neither variable.
PROVISION_DATABASE_URL=postgresql://postgres:postgres@localhost:5434/queueless OWNER_PASSWORD=<owner password> \
  pnpm --filter @queueless/api db:setup   # creates roles, applies migrations
DEMO_PASSWORD=<12+ chars> pnpm --filter @queueless/api seed:demo    # demo clinic, one admin, one staff, slots
pnpm --filter @queueless/api dev          # API on :3000
pnpm --filter @queueless/web dev          # web on :5173
```
Then open `http://localhost:5173/login` (accounts are printed by the seed command; the password is the one you set), `/c/demo-clinic` as a patient, and `/tv/demo-clinic/general` for the TV.

**Honesty note:** these steps were assembled from the scripts and the deployment runbook and from how I run the project day to day. I have not run them from a clean checkout on a fresh machine, so a step may be missing.

Checks: `pnpm lint`, `pnpm test`, `pnpm --filter @queueless/api test:int` (needs Docker), `pnpm --filter @queueless/api audit`. Load tests: [k6/README.md](k6/README.md).

## Design decisions
- [ADR-001 Tenancy via RLS](docs/decisions/ADR-001-tenancy-via-rls.md)
- [ADR-002 Event log](docs/decisions/ADR-002-event-log.md)
- [ADR-003 Row locking](docs/decisions/ADR-003-concurrency-locking.md)
- [ADR-004 Idempotency keys](docs/decisions/ADR-004-idempotency-keys.md)
- [ADR-005 No Redis in MVP](docs/decisions/ADR-005-no-redis-in-mvp.md)
- [All product decisions](docs/product/decisions-log.md) · [Docs changelog](docs/CHANGELOG.md)

## Privacy
Collects only a name or nickname and an optional phone number, with logged consent. Never symptoms or diagnoses. A purge job (hourly, and at start) clears name and phone on tickets older than 30 days; it is tested by calling it directly, and the hourly timer has not been observed running in a live process. See [security-privacy](docs/tech/security-privacy.md).

## Next
k6 and the auditor in CI and against the deployed demo, SMS with an outbox, wait-time estimates, a simulator and chaos tests, then a usability test. See [docs/STATUS.md](docs/STATUS.md).

## Docs
Start at [docs/INDEX.md](docs/INDEX.md). Honest gap list: [docs/KNOWN-GAPS.md](docs/KNOWN-GAPS.md).
