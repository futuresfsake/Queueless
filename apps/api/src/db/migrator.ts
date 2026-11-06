import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

/**
 * Applies the SQL migrations in prisma/migrations with plain pg, so the production image needs neither
 * psql nor the Prisma CLI. Order of operations (docs/ops/deployment-runbook.md):
 *   1. superuser: create queueless_owner and give it the database        (provisionRoles)
 *   2. owner:     apply each migration once, recorded in schema_migrations (applyMigrations)
 *   3. owner:     set the app role's password                             (setRolePasswords)
 * Everything is idempotent, so running it on every deploy is safe.
 */

async function withClient<T>(url: string, fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export interface MigratorPaths {
  provisionSql: string;
  migrationsDir: string;
}

export async function provisionRoles(superUrl: string, paths: MigratorPaths, ownerPassword: string): Promise<void> {
  await withClient(superUrl, async (c) => {
    await c.query(readFileSync(paths.provisionSql, 'utf8'));
    await c.query(`ALTER ROLE queueless_owner PASSWORD ${c.escapeLiteral(ownerPassword)}`);
  });
}

export async function applyMigrations(ownerUrl: string, paths: MigratorPaths): Promise<string[]> {
  const names = readdirSync(paths.migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  return withClient(ownerUrl, async (c) => {
    await c.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
    );
    const done = new Set((await c.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const applied: string[] = [];
    for (const name of names) {
      if (done.has(name)) continue;
      const sql = readFileSync(join(paths.migrationsDir, name, 'migration.sql'), 'utf8');
      await c.query('BEGIN');
      try {
        await c.query(sql);
        await c.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
        await c.query('COMMIT');
      } catch (err) {
        await c.query('ROLLBACK');
        throw new Error(`Migration ${name} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      applied.push(name);
    }
    return applied;
  });
}

export async function setAppRolePassword(ownerUrl: string, appPassword: string): Promise<void> {
  await withClient(ownerUrl, (c) => c.query(`ALTER ROLE queueless_app PASSWORD ${c.escapeLiteral(appPassword)}`));
}

/**
 * Deploy-time guard (auditor check A-6): connect exactly as the API will and refuse to proceed if that role
 * could bypass RLS. Catches the classic mistake of pasting the owner/superuser URL into DATABASE_URL.
 */
export async function assertAppRoleSafe(appUrl: string): Promise<void> {
  await withClient(appUrl, async (c) => {
    const role = (
      await c.query<{ current_user: string; rolsuper: boolean; rolbypassrls: boolean }>(
        'SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user',
      )
    ).rows[0];
    const owned = Number(
      (
        await c.query<{ n: string }>(
          `SELECT count(*) AS n FROM pg_tables WHERE schemaname = 'public' AND tableowner = current_user`,
        )
      ).rows[0].n,
    );
    if (role.rolsuper || role.rolbypassrls || owned > 0) {
      throw new Error(
        `DATABASE_URL role "${role.current_user}" is unsafe (superuser=${role.rolsuper}, bypassrls=${role.rolbypassrls}, ` +
          `ownedTables=${owned}). The API must connect as queueless_app so RLS applies.`,
      );
    }
  });
}
