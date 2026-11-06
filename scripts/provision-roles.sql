-- One-time setup, run as a SUPERUSER before the migrations (the migrator does this when PROVISION_DATABASE_URL is set).
-- Creates the migration/owner role and makes it own the current database. Database-name agnostic
-- (local: "queueless", Railway: "railway"). Passwords are set by the migrator from env vars, never in SQL files.
-- The app role (queueless_app) is created by the RLS migration.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'queueless_owner') THEN
    CREATE ROLE queueless_owner LOGIN CREATEROLE NOSUPERUSER;
  END IF;
END
$$;

DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I OWNER TO queueless_owner', current_database());
END
$$;

ALTER SCHEMA public OWNER TO queueless_owner;
