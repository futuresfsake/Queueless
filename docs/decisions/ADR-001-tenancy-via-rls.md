# ADR-001: Multi-tenancy with PostgreSQL RLS

Status: Accepted · Date: 2026-11-05

## Context
Many clinics share one database. A bug that forgets a `WHERE tenant_id = ...` would leak patient data. We want isolation enforced by the database, not only by app code.

## Decision
Shared schema; every tenant table has `tenant_id`. Postgres RLS policies compare `tenant_id` to `current_setting('app.tenant_id', true)`. Each request runs in a transaction that first calls `set_config('app.tenant_id', $1, true)` (transaction-local). The API connects as a non-owner role (`queueless_app`) and tables use `FORCE ROW LEVEL SECURITY`. App code also filters by tenant (defense in depth).

## Alternatives
- **App-level filtering only:** simplest, but one missed filter leaks data.
- **Schema per tenant / DB per tenant:** strong isolation but heavy migrations and ops; overkill for the MVP.

## Consequences
+ Isolation holds even if app code has a bug; testable.
+ Unset tenant fails closed.
− Every tenant query must go through `TenantPrisma.run` (extra transaction).
− Migrations run as the owner role; need two DB URLs.
− Super Admin needs a separate, small, tested path.
