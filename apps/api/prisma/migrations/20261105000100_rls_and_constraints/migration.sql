-- Hand-written: roles, CHECK constraints, append-only trigger, RLS, grants.
-- Runs as the OWNER role (queueless_owner / MIGRATION_DATABASE_URL). See docs/tech/schema.md and ADR-001/ADR-002.
-- The app connects as queueless_app, which is NOT the owner and has NOBYPASSRLS.
-- Set the app role's password out-of-band (ALTER ROLE queueless_app PASSWORD '...'), never in a migration.

-- ---------------------------------------------------------------------------
-- 1. App role (non-owner, cannot bypass RLS)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'queueless_app') THEN
    CREATE ROLE queueless_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. CHECK constraints
-- ---------------------------------------------------------------------------
-- Only SUPER_ADMIN has no tenant.
ALTER TABLE "users" ADD CONSTRAINT users_role_tenant_chk
  CHECK (("role" = 'SUPER_ADMIN') = ("tenant_id" IS NULL));
-- Emails are stored lowercase (case-insensitive uniqueness without citext).
ALTER TABLE "users" ADD CONSTRAINT users_email_lower_chk CHECK ("email" = lower("email"));

ALTER TABLE "service_points" ADD CONSTRAINT service_points_prefix_chk CHECK ("prefix" ~ '^[A-Z]{1,3}$');
ALTER TABLE "service_points" ADD CONSTRAINT service_points_code_chk CHECK ("code" ~ '^[a-z0-9-]{1,40}$');

-- INV-5: last line of defense against overbooking.
ALTER TABLE "slots" ADD CONSTRAINT slots_capacity_chk CHECK ("capacity" > 0);
ALTER TABLE "slots" ADD CONSTRAINT slots_booked_chk CHECK ("booked_count" >= 0 AND "booked_count" <= "capacity");

ALTER TABLE "tickets" ADD CONSTRAINT tickets_seq_chk CHECK ("seq" > 0);

-- ---------------------------------------------------------------------------
-- 3. INV-6: queue_events is append-only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION queue_events_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'queue_events is append-only (% not allowed)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER queue_events_no_update_delete
  BEFORE UPDATE OR DELETE ON "queue_events"
  FOR EACH ROW EXECUTE FUNCTION queue_events_append_only();

CREATE TRIGGER queue_events_no_truncate
  BEFORE TRUNCATE ON "queue_events"
  FOR EACH STATEMENT EXECUTE FUNCTION queue_events_append_only();

-- ---------------------------------------------------------------------------
-- 4. INV-7: Row-Level Security (fail closed: unset app.tenant_id => NULL => no rows)
-- ---------------------------------------------------------------------------
-- Standard tenant isolation for tables that carry tenant_id.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'service_points', 'slots', 'ticket_counters', 'tickets',
    'queue_events', 'consents', 'idempotency_keys'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)
         WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)', t);
  END LOOP;
END
$$;

-- tickets: a guest may read exactly one ticket by its unguessable token BEFORE the tenant is known.
-- The app sets app.ticket_token (transaction-local), reads the ticket, learns tenant_id, then
-- continues inside a normal tenant-scoped transaction.
CREATE POLICY ticket_token_lookup ON "tickets" FOR SELECT
  USING ("access_token" = nullif(current_setting('app.ticket_token', true), ''));

-- users: own tenant, or Super Admin; plus a single-row lookup by email for login.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY users_tenant ON "users"
  USING (
    "tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid
    OR current_setting('app.is_super_admin', true) = 'true'
  )
  WITH CHECK (
    "tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid
    OR current_setting('app.is_super_admin', true) = 'true'
  );
CREATE POLICY users_login_lookup ON "users" FOR SELECT
  USING ("email" = nullif(current_setting('app.login_email', true), ''));

-- tenants: slug/name are public (needed to resolve /c/:tenantSlug); only Super Admin may write.
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenants_read ON "tenants" FOR SELECT USING (true);
CREATE POLICY tenants_super_admin_write ON "tenants" FOR ALL
  USING (current_setting('app.is_super_admin', true) = 'true')
  WITH CHECK (current_setting('app.is_super_admin', true) = 'true');

-- ---------------------------------------------------------------------------
-- 5. Grants (least privilege for the app role)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO queueless_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "tenants", "users", "service_points", "slots", "ticket_counters",
  "tickets", "consents", "idempotency_keys"
TO queueless_app;

-- INV-6: no UPDATE/DELETE/TRUNCATE privilege on events at all (trigger is the second layer).
GRANT SELECT, INSERT ON "queue_events" TO queueless_app;
GRANT USAGE ON SEQUENCE "queue_events_id_seq" TO queueless_app;
