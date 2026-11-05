# Deployment & Runbook

Status: Final v1.1 · Last updated: 2026-11-05

## Local
```
cp .env.example .env
docker compose up
```
Services: `postgres` (16), `api` (NestJS), `web` (Vite). Migrations run as the owner role, then the API starts using the app role. Seed: `pnpm --filter api seed`.

## Environment variables
| Var | Purpose |
|---|---|
| `DATABASE_URL` | Connection as `queueless_app` (non-owner) — used by the API |
| `MIGRATION_DATABASE_URL` | Connection as `queueless_owner` — used only for migrations |
| `JWT_SECRET` | JWT signing |
| `CORS_ORIGINS` | Allowed web origins |
| `PORT` | API port |
| `TZ` / `CLINIC_TZ` | `Asia/Manila` for queue dates |

## CI/CD (GitHub Actions)
`lint → typecheck → test → build → (deploy on main)`. Required check before merge.

## Production (target)
- API + Postgres: Railway (decision D-4; fallback Render, gate Nov 8). Web: Vercel.
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
On a managed Postgres confirm during the Nov 8 hello-world deploy that (a) the migration role can `CREATE ROLE`, and (b) `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user` for the **app** connection returns false/false. If the host forbids `CREATE ROLE`, create the role by hand once with an owner-run script and keep the migration's `IF NOT EXISTS` guard. After every deploy run the auditor CLI (check A-6 verifies this posture).
