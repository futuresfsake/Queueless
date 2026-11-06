-- One-time setup, run as a superuser (local: the `postgres` user) BEFORE the migrations.
-- Creates the migration/owner role and makes it own the database. The app role
-- (queueless_app) is created by the RLS migration; set its password afterwards:
--   ALTER ROLE queueless_app PASSWORD '<from secret store>';
-- Local dev passwords below are placeholders; use secrets in any shared environment.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'queueless_owner') THEN
    CREATE ROLE queueless_owner LOGIN PASSWORD 'queueless_owner' CREATEROLE NOSUPERUSER;
  END IF;
END
$$;

ALTER DATABASE queueless OWNER TO queueless_owner;
ALTER SCHEMA public OWNER TO queueless_owner;
