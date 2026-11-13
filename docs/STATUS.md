# Status

Last updated: 2026-11-13

Update this at the end of every work session. Latest session log: [sessions/2026-11-05.md](sessions/2026-11-05.md) (uses the old milestone numbering; see mapping in [milestones](plan/milestones.md)).

## Documentation
**Complete (v1.2).** Milestones restructured on 2026-11-06 so M0 is the foundation (see [CHANGELOG](CHANGELOG.md), D-32). All open questions are resolved in [decisions-log](product/decisions-log.md) (D-1..D-32). Edit a doc only with a dated change or a new ADR.

## Current milestone
**Submit.** The MVP is built, tested, and live on Render + Neon (D-37) at https://queueless-x2wz.onrender.com since 2026-11-13. README has the link and the shared demo accounts. Left: a full click-through of the live site, an uptime ping, and the Nov 14 submission. Feature freeze is today (Nov 13, D-24).

## Done
- F1: docs v1.1 + v1.2 restructure
- F2: pnpm workspace; `packages/shared` (Zod); `apps/api` (NestJS, `GET /api/v1/health`, 1 Jest test); `apps/web` (React + Vite + Tailwind v4, TanStack Query); `docker-compose.yml` (Postgres 16); GitHub Actions CI
- F4 done: `TenantPrisma`, `Clock`, `/health` DB check; Testcontainers harness; integration tests T-1, T-2, T-3, T-12, T-19 plus an RLS-enabled-on-every-table check (13 tests). Verified they fail when the app connects as superuser. CI green on `051e78b` (including these integration tests on the runner).
- F5 done: login (JWT 8 h), default-deny `AuthGuard`+`RolesGuard`, per-request user re-check, login throttle, tenants/users/service-points API, Super Admin seed script. Verified: 14 unit + 45 integration tests green; mutation-checked (breaking RolesGuard or the live-user check fails 6 tests); smoke-tested the real API in dev (`pnpm dev`) and the production build (`node dist/main.js`) against the local DB. Found and fixed: `tsx` cannot run NestJS DI (see conventions.md).

- F6 prepared locally, later deployed on Render + Neon instead (D-37; the Railway and Vercel plan was not used): migration runner with A-6 safety guard, Dockerfile (non-root) + `railway.toml`, Socket.IO echo gateway, web hello page (API health + WebSocket check), `vercel.json`, CI builds the image, runbook "First deploy". Rehearsed: image built and run in production mode against an empty DB (provision, migrate, guard, health, WebSocket echo, CORS allow/deny); guard verified to stop the container when `DATABASE_URL` is the owner.

- M1 queue core (API): issue ticket (staff walk-in), `call-next` (`FOR UPDATE SKIP LOCKED`), start/complete/no-show/skip/cancel, append-only events, idempotency (service inside the request transaction), staff queue view. State machine is pure data (`ticket-state-machine.ts`) with a table-driven unit test. Raw SQL is in `apps/api/src/db/sql/queue.sql.ts`. Verified: lint, build, 18 unit and 81 integration tests green (34 new in `queue.int.spec.ts`). Mutation-checked: removing `SKIP LOCKED` (caught only by the deterministic lock-overlap test, not by the parallel-HTTP test), the status guard, or the idempotency claim each fails tests. Not yet committed.

- M2 (2026-11-12): staff real-time channel (JWT handshake, tenant rooms, emit after commit; 5 integration tests) and staff web UI (login, route guard, staff screen, walk-in form, reconnect banner, shadcn/ui). Smoke-tested live through the Vite proxy: login, subscribe, issue ticket, `queue.changed` received. The staff screen was typechecked and built but not yet clicked through in a browser.
- M3a backend (2026-11-12): public API (join, ticket status, cancel, TV display, slots, booking), per-IP rate limit, anonymous sockets for the patient page and TV. 18 unit and 101 integration tests green. Web pages added the same day: join + book (`/c/:slug`), my ticket (`/t/:token`), TV (`/tv/:slug/:code`), and `seed:demo`. Smoke-tested against the real API (slots, join, ticket status, display; seed is idempotent). Not yet clicked through in a browser. Not built: slots admin UI (create slots via the API or the seed), phone purge job (P1).
- M4 (2026-11-12, local): k6 booking race (200 -> 1 booked, 199 SLOT_FULL), k6 3-desk call-next (90 distinct, p95 20.9 ms), invariant auditor CLI (A-1..A-8) with corruption tests. All recorded in validation-results with conditions. Not yet: k6 + auditor in CI, abuse-protection extras (guest-token expiry is done; per-IP join cap is the public rate limit), README validation table.
- 30-day purge of patient name and phone built and tested (T-18; 112 integration tests green).
- Clinic Admin screen (`/admin`): create service points, staff accounts (activate/deactivate) and booking slots from the UI; login now returns `tenantSlug` for public links. Checked in a scripted headless-browser pass (see KNOWN-GAPS.md for what that did and did not cover).

See [KNOWN-GAPS.md](KNOWN-GAPS.md) for what is not built, not verified, or weaker than it looks.

## Next
1. **You:** click through the live site (join, Call next, TV), add an UptimeRobot ping on `/api/v1/health` (5-minute interval), check Render's free monthly hours cover it.
2. Seed `seed:super-admin` on production only if a Super Admin is needed (the demo does not need one).
3. CI badge and a demo GIF in the README.
4. Rotate the demo password if the repo becomes public and the demo is abused (re-run `seed:demo` with a new `DEMO_PASSWORD`).

## Verified 2026-11-13
- 19 unit and 115 integration tests pass on the final code (`8d0f056`); lint and build clean; Semgrep clean on the files changed today. Dependency audit: 12 known findings (1 high in `zod`, 10 moderate, 1 low), all in existing dependencies and not touched before the deadline.
- Live on Render + Neon (PostgreSQL 18): health ok with db up, web app and deep links served, 401 without a token, demo seeded, staff login works, TV board endpoint answers, `/api/v1/health/live` answers without a database query (D-38).
- Scripted Chrome pass on the live site: join x3, staff sign-in, Call next, TV, patient ticket and admin pages (README screenshots). A first screenshot attempt captured the screens before the call finished and was retaken.
- Auditor against the deployed database: A-1..A-5, A-7, A-8 pass; A-6 shows FAIL only when run as the Neon owner role. The app role was checked in the catalog instead (see KNOWN-GAPS).
- Not checked live: k6, purge timer, real phones, uptime monitor (to be created by hand).
- Deploy findings (runbook): the Render-generated `APP_DB_PASSWORD` is base64 and breaks the URL, so set your own letters-and-digits value; the first-deploy log hides app errors unless `migrate.ts` prints them (fixed in `2dace89`); seeding over the internet needs `PRISMA_TX_TIMEOUT_MS`.

## Blockers
- None for submission.

## Decision gates
- End of Nov 7 (hard stop Nov 8 morning): M0 F6 hello-world deploy with DB and WebSockets (D-4, D-32)
- Nov 13: feature freeze (D-24)
- Nov 15: verify SMS gateway inbound (D-20)

## Days left to Nov 14
Today (Nov 13) is the feature freeze; Nov 14 is submission only
