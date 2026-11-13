import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Raw Prisma client. Connects as the NON-OWNER app role (DATABASE_URL), so RLS applies.
 * Do not use it for tenant data directly: go through TenantPrisma (conventions.md).
 * Connection is lazy (first query), so the app and unit tests boot without a database.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(databaseUrl: string | undefined = process.env.DATABASE_URL) {
    // PRISMA_TX_TIMEOUT_MS lets one-off scripts (seeding a remote database over the internet) outlast
    // Prisma's 5 s default. Unset, behaviour is unchanged.
    const timeout = Number(process.env.PRISMA_TX_TIMEOUT_MS);
    super({
      ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
      ...(timeout > 0 ? { transactionOptions: { timeout, maxWait: timeout } } : {}),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
