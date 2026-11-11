import { Injectable } from '@nestjs/common';
import { Clock } from '../clock/clock';
import { PrismaService } from '../db/prisma.service';
import { TenantPrisma } from '../db/tenant-prisma.service';
import { AuditCheck, RLS_TABLES, SECURITY_CHECK, TENANT_CHECKS } from './audit-checks';

export interface CheckResult {
  id: string;
  title: string;
  invariant: string;
  passed: boolean;
  violations: number;
  /** Up to 5 offending ticket numbers or slot ids. Never names or phones. */
  sample: string[];
}
export interface AuditReport {
  tenantId: string | null;
  ranAt: string;
  trigger: 'manual' | 'nightly' | 'ci';
  passed: boolean;
  checks: CheckResult[];
}

const SAMPLE_SIZE = 5;
const DEFAULT_WINDOW_DAYS = 7;

/**
 * Invariant auditor (US-33, D-26). It checks the internal consistency of what the system recorded;
 * passing does NOT prove the system matches real-world events. Every check is read-only SQL; the
 * only write is the result row in audit_runs.
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrisma,
    private readonly clock: Clock,
  ) {}

  /** A-1..A-5, A-7, A-8 for one tenant. `windowDays = 0` examines the full history. */
  async runTenant(
    tenantId: string,
    opts: { trigger?: AuditReport['trigger']; windowDays?: number; record?: boolean } = {},
  ): Promise<AuditReport> {
    const days = opts.windowDays ?? DEFAULT_WINDOW_DAYS;
    const since = days === 0 ? new Date(0) : new Date(this.clock.now().getTime() - days * 86_400_000);

    const checks = await this.tenantPrisma.run(tenantId, async (tx) => {
      const out: CheckResult[] = [];
      for (const c of TENANT_CHECKS) out.push(await this.runCheck(c, (sql, ...p) => tx.$queryRawUnsafe(sql, ...p), tenantId, since));
      return out;
    });

    const report: AuditReport = {
      tenantId,
      ranAt: this.clock.now().toISOString(),
      trigger: opts.trigger ?? 'manual',
      passed: checks.every((c) => c.passed),
      checks,
    };
    if (opts.record !== false) {
      await this.tenantPrisma.run(tenantId, (tx) =>
        tx.auditRun.create({ data: { tenantId, trigger: report.trigger, passed: report.passed, results: report as never } }),
      );
    }
    return report;
  }

  private async runCheck(
    c: AuditCheck,
    query: (sql: string, ...params: unknown[]) => Promise<unknown>,
    tenantId: string,
    since: Date,
  ): Promise<CheckResult> {
    const rows = (await query(
      `SELECT ref, count(*) OVER () AS total FROM (${c.sql}) v ORDER BY ref LIMIT ${SAMPLE_SIZE}`,
      tenantId,
      since,
    )) as { ref: string; total: bigint }[];
    const violations = rows.length ? Number(rows[0].total) : 0;
    return { id: c.id, title: c.title, invariant: c.invariant, passed: violations === 0, violations, sample: rows.map((r) => r.ref) };
  }

  /**
   * A-6: the database is set up as designed on THIS environment. Catches a deploy that connects as
   * the owner or a superuser (RLS would then be silently bypassed) and any lost append-only guard.
   */
  async runSecurity(): Promise<CheckResult> {
    const problems: string[] = [];

    const role = (await this.prisma.$queryRawUnsafe(
      `SELECT current_user::text AS name, r.rolsuper, r.rolbypassrls FROM pg_roles r WHERE r.rolname = current_user`,
    )) as { name: string; rolsuper: boolean; rolbypassrls: boolean }[];
    if (role[0]?.rolsuper) problems.push('app role is a superuser');
    if (role[0]?.rolbypassrls) problems.push('app role has BYPASSRLS');

    const owned = (await this.prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND pg_get_userbyid(c.relowner) = current_user`,
    )) as { n: number }[];
    if (owned[0]?.n > 0) problems.push(`app role owns ${owned[0].n} table(s) (owners bypass RLS)`);

    const rls = (await this.prisma.$queryRawUnsafe(
      `SELECT relname::text AS name, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relnamespace = 'public'::regnamespace AND relname = ANY($1::text[])`,
      RLS_TABLES,
    )) as { name: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[];
    for (const t of RLS_TABLES) {
      const row = rls.find((r) => r.name === t);
      if (!row?.relrowsecurity || !row.relforcerowsecurity) problems.push(`RLS not enabled and forced on ${t}`);
    }

    const priv = (await this.prisma.$queryRawUnsafe(
      `SELECT has_table_privilege(current_user, 'queue_events', 'UPDATE') AS upd,
              has_table_privilege(current_user, 'queue_events', 'DELETE') AS del`,
    )) as { upd: boolean; del: boolean }[];
    if (priv[0]?.upd || priv[0]?.del) problems.push('app role can UPDATE/DELETE queue_events');

    const trig = (await this.prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM pg_trigger WHERE tgrelid = 'queue_events'::regclass AND NOT tgisinternal`,
    )) as { n: number }[];
    if ((trig[0]?.n ?? 0) < 2) problems.push('append-only triggers on queue_events are missing');

    return { ...SECURITY_CHECK, passed: problems.length === 0, violations: problems.length, sample: problems.slice(0, SAMPLE_SIZE) };
  }
}
