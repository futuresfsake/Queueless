# Deployment & Runbook

Status: Final v1.2 · Last updated: 2026-11-06

## Local
```
cp .env.example .env
docker compose up -d postgres                 # Postgres 16 on host port 5434
pnpm --filter @queueless/api db:setup         # needs PROVISION_DATABASE_URL for a brand-new database (superuser)
pnpm --filter @queueless/api dev              # API on :3000
pnpm --filter @queueless/web dev              # web on :5173
```
First run on a brand-new local database: set `PROVISION_DATABASE_URL=postgresql://postgres:postgres@localhost:5434/queueless` and `OWNER_PASSWORD=queueless_owner` for that one `db:setup` command. Migrations run as the owner role; the API runs as `queueless_app`. Seed the Super Admin: `pnpm --filter @queueless/api seed:super-admin`.

## Environment variables
| Var | Purpose |
|---|---|
| `DATABASE_URL` | Connection as `queueless_app` (non-owner) — used by the API |
| `MIGRATION_DATABASE_URL` | Connection as `queueless_owner` — used only by `migrate.js` |
| `APP_DB_PASSWORD` | Set on `queueless_app` by `migrate.js` on each deploy |
| `PROVISION_DATABASE_URL`, `OWNER_PASSWORD` | First deploy only: superuser connection and the owner role password (remove the URL afterwards) |
| `TRUST_PROXY` | `1` behind Railway so per-IP limits see the client |
| `JWT_SECRET` | JWT signing |
| `CORS_ORIGINS` | Allowed web origins |
| `PORT` | API port |
| `TZ` / `CLINIC_TZ` | `Asia/Manila` for queue dates |

## CI/CD (GitHub Actions)
`lint → typecheck → test → build → (deploy on main)`. Required check before merge.

## Production (target)
- API + Postgres: Railway (decision D-4; fallback Render, gate: M0 F6, end of Nov 7). Web: Vercel.
- Deploy order: run migrations (owner role) → deploy API → deploy web.
- Ensure WebSocket support is enabled on the API host and CORS includes the web origin.
- After deploy: run `/health`, log in with demo account, issue a ticket, call next.

## Rollback
- Redeploy the previous API image/commit.
- Migrations are forward-only; write a compensating migration if needed. Take a DB snapshot before schema changes.

## Troubleshooting
| Symptom | Likely cause | Check |
|---|---|---|
| Cross-tenant data visible | API connecting as owner role | `SELECT current_user, rolbypassrls` |
| Empty results for everything | `app.tenant_id` not set | Is the request using `TenantPrisma.run`? |
| Sockets not connecting | Host lacks WS/CORS | Browser console, host settings |
| Duplicate/absent updates after restart | Clients not refetching | Reconnect handler |
| `REQUEST_IN_PROGRESS` stuck | Crash left key IN_PROGRESS | Rolled back with transaction; if persists, check key cleanup |

## Backup & retention
Managed Postgres daily snapshots (host-provided). Phone purge job daily. Idempotency keys cleaned daily.

## Role provisioning (v1.1)
The migration creates `queueless_app` (LOGIN, NOSUPERUSER, NOBYPASSRLS) but not its password. After the first migration on each environment:
```sql
ALTER ROLE queueless_app PASSWORD '<from secret store>';
```
On a managed Postgres confirm during the M0 F6 hello-world deploy that (a) the migration role can `CREATE ROLE`, and (b) `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user` for the **app** connection returns false/false. If the host forbids `CREATE ROLE`, create the role by hand once with an owner-run script and keep the migration's `IF NOT EXISTS` guard. After every deploy run the auditor CLI (check A-6 verifies this posture).

## First deploy (M0 F6) — Railway (API + Postgres) and Vercel (web)

Updated 2026-11-06. Everything below was rehearsed locally: the exact Docker image was run against an empty database in production mode (provision -> migrate -> role-safety guard -> API, WebSocket echo, CORS for allowed vs other origins). Railway-specific steps (variable names, dashboard clicks) are the only untested part.

### What happens on every deploy
`apps/api/Dockerfile` runs `node dist/scripts/migrate.js && node dist/main.js`:
1. If `PROVISION_DATABASE_URL` is set (first deploy only): superuser creates `queueless_owner` and gives it the database.
2. As `queueless_owner`: apply new SQL migrations (recorded in `schema_migrations`), then set the `queueless_app` password from `APP_DB_PASSWORD`.
3. **Guard (auditor check A-6):** connect with `DATABASE_URL` and abort the deploy if that role is a superuser, can bypass RLS, or owns tables. Pasting the owner URL by mistake makes the container exit instead of silently serving without tenant isolation.
4. Start the API as the non-root `node` user.

### Railway
1. New Project -> **Deploy PostgreSQL**. Note the service name (assumed `Postgres` below).
2. In the project: **New -> GitHub Repo -> futuresfsake/Queueless**. Railway reads `railway.toml` (Dockerfile build, health check `/api/v1/health`).
3. API service -> **Variables**. Generate the three secrets yourself, hex only so they are URL-safe: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (run three times).

   | Variable | Value |
   |---|---|
   | `JWT_SECRET` | secret #1 (production requires 32+ chars) |
   | `OWNER_PASSWORD` | secret #2 |
   | `APP_DB_PASSWORD` | secret #3 |
   | `PROVISION_DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (superuser; **delete after the first successful deploy**) |
   | `MIGRATION_DATABASE_URL` | `postgresql://queueless_owner:${{OWNER_PASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}` |
   | `DATABASE_URL` | `postgresql://queueless_app:${{APP_DB_PASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}` |
   | `TRUST_PROXY` | `1` |
   | `CORS_ORIGINS` | the Vercel URL (step below); until then `http://localhost:5173` |
   | `CLINIC_TZ` | `Asia/Manila` |

   If the Postgres variables are named differently, check the Postgres service's Variables tab and adjust the references.
4. API service -> **Settings -> Networking -> Generate Domain**. Note `https://<api>.up.railway.app`.
5. Watch the deploy logs for: `roles provisioned`, `applied: ...`, `app role password set`, `... (A-6 ok)`, `API listening`.
6. **Remove `PROVISION_DATABASE_URL`** (the API must not hold superuser credentials) and redeploy once. Logs should now skip "roles provisioned".

### Vercel
1. Add New Project -> import the repo. **Root Directory: `apps/web`**. Leave "Include source files outside of the Root Directory" enabled. `apps/web/vercel.json` supplies install/build commands.
2. Environment variable: `VITE_API_URL=https://<api>.up.railway.app` (build-time).
3. Deploy. Copy the `https://<project>.vercel.app` URL into Railway `CORS_ORIGINS` (comma-separate if you add custom domains) and redeploy the API.

### Gate checklist (done when every box is ticked)
- [ ] `https://<api>/api/v1/health` -> `{"status":"ok","db":"up"}`
- [ ] Deploy log shows `A-6 ok` for the deployed `DATABASE_URL`
- [ ] Vercel page shows **API: ok (db up)** and **WebSocket: connected - echo ok**
- [ ] Browser console has no CORS errors
- [ ] `https://<api>/api/v1/tenants` without a token -> 401
- [ ] `PROVISION_DATABASE_URL` removed and the redeploy still starts
- [ ] Seed the Super Admin against production (below) and log in via `POST /api/v1/auth/login`

### Seeding the Super Admin in production
Run the seed from your laptop against production, connecting as the **app role** through Railway's public TCP proxy (Postgres service -> Settings -> Networking -> enable TCP Proxy; note host and port). Variables passed on the command line win over your local `.env`:
```
DATABASE_URL="postgresql://queueless_app:<APP_DB_PASSWORD>@<proxy-host>:<proxy-port>/railway" SUPER_ADMIN_EMAIL="you@example.com" SUPER_ADMIN_PASSWORD="<12+ chars>" pnpm --filter @queueless/api seed:super-admin
```
The app role may write `users` here because the seed sets `app.is_super_admin` for its own transaction (policy `users_tenant`). Disable the TCP proxy afterwards. Never commit or paste the password.

### If something fails (risks R4, R9)
| Symptom | Likely cause | Action |
|---|---|---|
| `permission denied to create role` | Host does not give a real superuser | Create `queueless_owner` by hand once (owner of the DB, `CREATEROLE`), skip `PROVISION_DATABASE_URL`; or switch host to Render |
| `... is unsafe (superuser=..., ownedTables=...)` | `DATABASE_URL` uses the wrong user | Point it at `queueless_app` |
| Health OK but socket `connect_error` | CORS origin mismatch or proxy blocks WS | Check `CORS_ORIGINS` exactly equals the Vercel origin (scheme, no trailing slash); check host WS support |
| Rate limits hit one shared IP | `TRUST_PROXY` not set | Set `TRUST_PROXY=1` |
