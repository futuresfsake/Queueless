import { Injectable } from '@nestjs/common';
import type { JoinQueueBody } from '@queueless/shared';
import { FINAL_STATUSES } from '@queueless/shared';
import { Clock } from '../clock/clock';
import { notFound } from '../common/app-error';
import { PrismaService } from '../db/prisma.service';
import { TenantPrisma, Tx } from '../db/tenant-prisma.service';
import { QueueService } from '../queue/queue.service';

/** A guest token stays valid for 24 h after the ticket reaches a final state (api.md). */
const TOKEN_GRACE_MS = 24 * 60 * 60 * 1000;
const NEXT_UP_COUNT = 5;

/**
 * Patient / TV reads and writes. Everything here is unauthenticated, so what leaves this class is
 * deliberately small: no phone numbers, no other people's guest tokens, no names on the TV.
 */
@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrisma,
    private readonly queue: QueueService,
    private readonly clock: Clock,
  ) {}

  /** The tenants table is publicly readable (slug and name only); everything else needs the tenant set. */
  async resolveTenant(slug: string): Promise<{ id: string; name: string }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant || !tenant.isActive) throw notFound('Clinic');
    return { id: tenant.id, name: tenant.name };
  }

  async listServicePoints(slug: string) {
    const tenant = await this.resolveTenant(slug);
    const points = await this.tenantPrisma.run(tenant.id, (tx) =>
      tx.servicePoint.findMany({ where: { tenantId: tenant.id, isActive: true }, orderBy: { name: 'asc' } }),
    );
    return { clinic: tenant.name, servicePoints: points.map((p) => ({ id: p.id, name: p.name, code: p.code })) };
  }

  private async pointByCode(tx: Tx, tenantId: string, code: string) {
    const point = await tx.servicePoint.findFirst({ where: { tenantId, code } });
    if (!point) throw notFound('Service point');
    return point;
  }

  async join(slug: string, code: string, body: JoinQueueBody, key: string | undefined) {
    const tenant = await this.resolveTenant(slug);
    const point = await this.tenantPrisma.run(tenant.id, (tx) => this.pointByCode(tx, tenant.id, code));
    return this.queue.issueTicket(tenant.id, point.id, body, { kind: 'PATIENT' }, key);
  }

  async listSlots(slug: string, code: string, date?: string) {
    const tenant = await this.resolveTenant(slug);
    const day = date ?? this.clock.localDate();
    return this.tenantPrisma.run(tenant.id, async (tx) => {
      const point = await this.pointByCode(tx, tenant.id, code);
      const slots = await tx.slot.findMany({
        where: { tenantId: tenant.id, servicePointId: point.id },
        orderBy: { startsAt: 'asc' },
      });
      return {
        date: day,
        slots: slots
          .filter((s) => this.clock.localDate(undefined, s.startsAt) === day)
          .map((s) => ({ id: s.id, startsAt: s.startsAt, remaining: s.capacity - s.bookedCount })),
      };
    });
  }

  async book(slug: string, slotId: string, body: JoinQueueBody, key: string | undefined) {
    const tenant = await this.resolveTenant(slug);
    return this.queue.bookSlot(tenant.id, slotId, body, key);
  }

  /** US-6: the one ticket this token opens, plus how many are ahead and what is being served. */
  async ticketStatus(token: string) {
    const ticket = await this.tenantPrisma.runForTicketToken(token, (tx) =>
      tx.ticket.findFirst({ where: { accessToken: token } }),
    );
    if (!ticket) throw notFound('Ticket');
    if (
      FINAL_STATUSES.includes(ticket.status) &&
      ticket.completedAt &&
      this.clock.now().getTime() - ticket.completedAt.getTime() > TOKEN_GRACE_MS
    ) {
      throw notFound('Ticket');
    }
    return this.tenantPrisma.run(ticket.tenantId, async (tx) => {
      const point = await tx.servicePoint.findFirst({
        where: { id: ticket.servicePointId, tenantId: ticket.tenantId },
      });
      const ahead =
        ticket.status === 'WAITING'
          ? await tx.ticket.count({
              where: {
                tenantId: ticket.tenantId,
                servicePointId: ticket.servicePointId,
                queueDate: ticket.queueDate,
                status: 'WAITING',
                seq: { lt: ticket.seq },
              },
            })
          : 0;
      const tenant = await this.prisma.tenant.findUnique({ where: { id: ticket.tenantId } });
      return {
        clinicSlug: tenant?.slug ?? '',
        servicePointCode: point?.code ?? '',
        number: ticket.number,
        status: ticket.status,
        patientName: ticket.patientName,
        servicePoint: point?.name ?? '',
        servicePointId: ticket.servicePointId,
        peopleAhead: ahead,
        nowServing: await this.nowServing(tx, ticket.tenantId, ticket.servicePointId, ticket.queueDate),
      };
    });
  }

  async cancel(token: string) {
    const ticket = await this.tenantPrisma.runForTicketToken(token, (tx) =>
      tx.ticket.findFirst({ where: { accessToken: token }, select: { id: true, tenantId: true } }),
    );
    if (!ticket) throw notFound('Ticket');
    return this.queue.patientCancel(ticket.tenantId, ticket.id);
  }

  /** US-16: the TV. Numbers only, never names. */
  async display(slug: string, code: string) {
    const tenant = await this.resolveTenant(slug);
    return this.tenantPrisma.run(tenant.id, async (tx) => {
      const point = await this.pointByCode(tx, tenant.id, code);
      const date = new Date(`${this.clock.localDate()}T00:00:00.000Z`);
      const next = await tx.ticket.findMany({
        where: { tenantId: tenant.id, servicePointId: point.id, queueDate: date, status: 'WAITING' },
        orderBy: { seq: 'asc' },
        take: NEXT_UP_COUNT,
        select: { number: true },
      });
      return {
        clinic: tenant.name,
        servicePoint: point.name,
        nowServing: await this.nowServing(tx, tenant.id, point.id, date),
        nextUp: next.map((t) => t.number),
      };
    });
  }

  /** Most recently called ticket that is still CALLED or SERVING. */
  private async nowServing(tx: Tx, tenantId: string, servicePointId: string, queueDate: Date) {
    const t = await tx.ticket.findFirst({
      where: { tenantId, servicePointId, queueDate, status: { in: ['CALLED', 'SERVING'] } },
      orderBy: { calledAt: 'desc' },
      select: { number: true },
    });
    return t?.number ?? null;
  }
}
