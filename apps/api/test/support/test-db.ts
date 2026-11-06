import { join } from 'node:path';
import { Client } from 'pg';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { applyMigrations, provisionRoles, setAppRolePassword } from '../../src/db/migrator';
import { PrismaService } from '../../src/db/prisma.service';
import { TenantPrisma } from '../../src/db/tenant-prisma.service';

// Ryuk (the cleanup sidecar) is an extra image pull; we stop the container ourselves in afterAll.
process.env.TESTCONTAINERS_RYUK_DISABLED ??= 'true';

const API_ROOT = join(__dirname, '..', '..');
const REPO_ROOT = join(API_ROOT, '..', '..');
const APP_PASSWORD = 'test-app-password';

export interface TestDb {
  prisma: PrismaService;
  tenantPrisma: TenantPrisma;
  /** Connection URL for the NON-OWNER app role (RLS applies). */
  appUrl: string;
  /** Superuser connection, for deliberately corrupting data or inspecting state. Never use it to test RLS. */
  superUser: () => Promise<Client>;
  stop: () => Promise<void>;
}

/**
 * Real Postgres 16, provisioned exactly like production:
 * superuser creates the owner role -> migrations run as the OWNER -> API connects as the non-owner app role.
 */
export async function startTestDb(): Promise<TestDb> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('queueless')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  const host = container.getHost();
  const port = container.getPort();
  const url = (user: string, password: string) =>
    `postgresql://${user}:${password}@${host}:${port}/queueless`;

  const superUrl = url('postgres', 'postgres');
  const ownerUrl = url('queueless_owner', 'queueless_owner');
  const appUrl = url('queueless_app', APP_PASSWORD);

  // Same code path as production (src/scripts/migrate.ts).
  const paths = {
    provisionSql: join(REPO_ROOT, 'scripts', 'provision-roles.sql'),
    migrationsDir: join(API_ROOT, 'prisma', 'migrations'),
  };
  await provisionRoles(superUrl, paths, 'queueless_owner');
  await applyMigrations(ownerUrl, paths);
  await setAppRolePassword(ownerUrl, APP_PASSWORD);

  const prisma = new PrismaService(appUrl);
  return {
    prisma,
    tenantPrisma: new TenantPrisma(prisma),
    appUrl,
    superUser: async () => {
      const c = new Client({ connectionString: superUrl });
      await c.connect();
      return c;
    },
    stop: async () => {
      await prisma.$disconnect();
      await container.stop();
    },
  };
}
