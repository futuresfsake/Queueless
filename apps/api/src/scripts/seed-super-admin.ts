import 'reflect-metadata';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../db/prisma.service';
import { TenantPrisma } from '../db/tenant-prisma.service';

/**
 * D-17: the Super Admin exists only because someone with access to the environment ran this script.
 * No public sign-up. Credentials come from env vars so the password never appears in code, history or logs.
 *   SUPER_ADMIN_EMAIL=... SUPER_ADMIN_PASSWORD=... pnpm --filter @queueless/api seed:super-admin
 * Idempotent: running it again resets that account's password and re-activates it.
 */
async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD');
  if (password.length < 12) throw new Error('SUPER_ADMIN_PASSWORD must be at least 12 characters');

  const prisma = new PrismaService();
  try {
    const passwordHash = await new PasswordService().hash(password);
    await new TenantPrisma(prisma).runAsSuperAdmin((tx) =>
      tx.user.upsert({
        where: { email },
        create: { email, passwordHash, role: 'SUPER_ADMIN', tenantId: null },
        update: { passwordHash, isActive: true },
      }),
    );
    console.log(`Super Admin ready: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
