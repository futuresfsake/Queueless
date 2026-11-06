import { join } from 'node:path';
import { applyMigrations, assertAppRoleSafe, provisionRoles, setAppRolePassword } from '../db/migrator';

/**
 * Deploy-time database setup. Runs before the API starts (Dockerfile CMD) and locally via `pnpm db:setup`.
 *
 *   MIGRATION_DATABASE_URL  required  connection as queueless_owner (applies migrations)
 *   APP_DB_PASSWORD         required  password to set on queueless_app (the API's runtime role)
 *   PROVISION_DATABASE_URL  optional  SUPERUSER connection; when set, creates queueless_owner first.
 *   DATABASE_URL            required  connection as queueless_app; verified safe before the API starts (A-6)
 *   OWNER_PASSWORD          required if PROVISION_DATABASE_URL is set; the password for queueless_owner
 *
 * After the first successful deploy, REMOVE PROVISION_DATABASE_URL from the service: the API process should
 * never hold superuser credentials. Without it this script skips provisioning.
 */
async function main() {
  const need = (name: string) => {
    const v = process.env[name];
    if (!v) throw new Error(`${name} is required`);
    return v;
  };

  const repoRoot = process.env.QUEUELESS_ROOT ?? join(__dirname, '..', '..', '..', '..');
  const paths = {
    provisionSql: join(repoRoot, 'scripts', 'provision-roles.sql'),
    migrationsDir: join(repoRoot, 'apps', 'api', 'prisma', 'migrations'),
  };

  if (process.env.PROVISION_DATABASE_URL) {
    await provisionRoles(process.env.PROVISION_DATABASE_URL, paths, need('OWNER_PASSWORD'));
    console.log('roles provisioned');
  }
  const applied = await applyMigrations(need('MIGRATION_DATABASE_URL'), paths);
  console.log(applied.length ? `applied: ${applied.join(', ')}` : 'migrations up to date');
  await setAppRolePassword(need('MIGRATION_DATABASE_URL'), need('APP_DB_PASSWORD'));
  console.log('app role password set');
  await assertAppRoleSafe(need('DATABASE_URL'));
  console.log('DATABASE_URL role is non-owner, non-superuser, cannot bypass RLS (A-6 ok)');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
