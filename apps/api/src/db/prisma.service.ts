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
    super(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
