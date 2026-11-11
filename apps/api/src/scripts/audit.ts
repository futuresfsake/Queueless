import 'reflect-metadata';
import { AuditService, CheckResult } from '../audit/audit.service';
import { SystemClock } from '../clock/clock';
import { PrismaService } from '../db/prisma.service';
import { TenantPrisma } from '../db/tenant-prisma.service';

/**
 * Invariant auditor CLI (US-33, T-21). Runs A-6 once, then A-1..A-8 for every active clinic, prints a
 * table, stores one audit_runs row per clinic, and exits 1 if anything fails (CI uses this).
 *   pnpm --filter @queueless/api audit [-- --days 7] [-- --trigger ci]
 * Connect with the SAME DATABASE_URL role the API uses, so A-6 audits the real runtime posture.
 */
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const line = (c: CheckResult) =>
  `${c.passed ? 'PASS' : 'FAIL'}  ${c.id}  ${c.violations === 0 ? '' : `(${c.violations}) `}${c.title}` +
  (c.passed ? '' : `\n        e.g. ${c.sample.join(', ')}`);

async function main() {
  const days = arg('days') !== undefined ? Number(arg('days')) : undefined;
  const trigger = (arg('trigger') ?? 'manual') as 'manual' | 'nightly' | 'ci';
  const prisma = new PrismaService();
  const tenantPrisma = new TenantPrisma(prisma);
  const audit = new AuditService(prisma, tenantPrisma, new SystemClock());
  let failed = false;
  try {
    const security = await audit.runSecurity();
    console.log('Platform');
    console.log('  ' + line(security));
    failed ||= !security.passed;

    const tenants = await prisma.tenant.findMany({ where: { isActive: true }, orderBy: { slug: 'asc' } });
    for (const t of tenants) {
      const report = await audit.runTenant(t.id, { trigger, windowDays: days });
      console.log(`\nClinic ${t.slug}`);
      for (const c of report.checks) console.log('  ' + line(c));
      failed ||= !report.passed;
    }
    console.log(failed ? '\nAUDIT FAILED' : '\nAll integrity checks passed.');
  } finally {
    await prisma.$disconnect();
  }
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
});
