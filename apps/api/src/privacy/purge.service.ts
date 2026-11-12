import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Clock } from '../clock/clock';
import { PrismaService } from '../db/prisma.service';
import { TenantPrisma } from '../db/tenant-prisma.service';

/** INV-9 / Data Privacy Act: name and phone are cleared 30 days after the ticket was issued. */
export const RETENTION_DAYS = 30;
const HOUR_MS = 3_600_000;

/**
 * Clears `patient_name` and `phone` on tickets older than 30 days. The ticket row, its number, status,
 * timestamps and events stay (they hold no personal data), so history and the auditor keep working.
 * Runs once at start and then hourly; also callable directly (tests, an operator). Idempotent.
 * Single API server (ADR-005): with several servers every one would run it, which is harmless.
 * Disabled when NODE_ENV=test or PURGE_INTERVAL_MS=0.
 */
@Injectable()
export class PurgeService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger(PurgeService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrisma,
    private readonly clock: Clock,
  ) {}

  onApplicationBootstrap(): void {
    const interval = Number(process.env.PURGE_INTERVAL_MS ?? HOUR_MS);
    if (process.env.NODE_ENV === 'test' || interval <= 0) return;
    const tick = () => this.purgeAll().catch((e) => this.log.error(`purge failed: ${(e as Error).message}`));
    void tick();
    this.timer = setInterval(tick, interval);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Every clinic, one transaction each so one failing clinic cannot block the others. Returns rows cleared. */
  async purgeAll(): Promise<number> {
    const cutoff = new Date(this.clock.now().getTime() - RETENTION_DAYS * 86_400_000);
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    let cleared = 0;
    for (const t of tenants) {
      try {
        cleared += await this.tenantPrisma.run(t.id, async (tx) => {
          const r = await tx.ticket.updateMany({
            where: { tenantId: t.id, issuedAt: { lt: cutoff }, OR: [{ phone: { not: null } }, { patientName: { not: null } }] },
            data: { phone: null, patientName: null },
          });
          return r.count;
        });
      } catch (e) {
        this.log.error(`purge failed for a clinic: ${(e as Error).message}`);
      }
    }
    if (cleared > 0) this.log.log(`cleared name and phone on ${cleared} ticket(s) older than ${RETENTION_DAYS} days`);
    return cleared;
  }
}
