import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Ticket } from '@prisma/client';
import type { JoinQueueBody, TicketAction } from '@queueless/shared';
import { AppError, notFound } from '../common/app-error';
import { Clock } from '../clock/clock';
import { lockNextWaitingTicket, lockSlot, nextTicketSeq } from '../db/sql/queue.sql';
import { TenantPrisma, Tx } from '../db/tenant-prisma.service';
import { EventsService } from './events.service';
import { IdempotencyService } from './idempotency.service';
import { TransitionEvent, TRANSITIONS } from './ticket-state-machine';

const CONSENT_TEXT_VERSION = 'v1';

/** Who caused a queue change. Patients have no user row (actor_user_id stays NULL). */
export type Actor = { kind: 'STAFF'; userId: string } | { kind: 'PATIENT' };

const ACTION_EVENT: Record<TicketAction, TransitionEvent> = {
  start: 'STARTED',
  complete: 'SERVED',
  'no-show': 'NO_SHOW',
  skip: 'SKIPPED',
  cancel: 'CANCELLED',
};

/** What staff see. Never includes the phone number or the guest access token. */
const staffTicket = (t: Ticket) => ({
  id: t.id,
  servicePointId: t.servicePointId,
  number: t.number,
  status: t.status,
  seq: t.seq,
  version: t.version,
  patientName: t.patientName,
  issuedAt: t.issuedAt,
  calledAt: t.calledAt,
  startedAt: t.startedAt,
  completedAt: t.completedAt,
});
export type StaffTicket = ReturnType<typeof staffTicket>;

@Injectable()
export class QueueService {
  constructor(
    private readonly tenantPrisma: TenantPrisma,
    private readonly events: EventsService,
    private readonly idempotency: IdempotencyService,
    private readonly clock: Clock,
  ) {}

  /** US-9: today's active tickets for one service point, in queue order. */
  list(tenantId: string, servicePointId: string) {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const point = await tx.servicePoint.findFirst({ where: { id: servicePointId, tenantId } });
      if (!point) throw notFound('Service point');
      const { iso, asDate } = this.queueDate();
      const tickets = await tx.ticket.findMany({
        where: { tenantId, servicePointId, queueDate: asDate, status: { in: ['WAITING', 'CALLED', 'SERVING'] } },
        orderBy: { seq: 'asc' },
      });
      return { servicePointId, queueDate: iso, tickets: tickets.map(staffTicket) };
    });
  }

  /** US-5: issue a ticket. One transaction: counter, ticket, consent, event, idempotency key. */
  issueTicket(
    tenantId: string,
    servicePointId: string,
    body: JoinQueueBody,
    actor: Actor,
    idempotencyKey: string | undefined,
  ): Promise<{ ticket: StaffTicket; accessToken: string }> {
    // Checked before anything is written: no consent, no data stored (Data Privacy Act).
    if (body.consent !== true) throw new AppError(400, 'CONSENT_REQUIRED', 'Consent is required to join the queue');

    return this.tenantPrisma.run(tenantId, (tx) =>
      this.idempotency.run(
        tx,
        {
          tenantId,
          key: idempotencyKey,
          method: 'POST',
          route: '/queue/:servicePointId/tickets',
          path: `/queue/${servicePointId}/tickets`,
          body,
        },
        async () => {
          const point = await tx.servicePoint.findFirst({ where: { id: servicePointId, tenantId } });
          if (!point) throw notFound('Service point');
          if (!point.isActive) throw new AppError(409, 'SERVICE_POINT_INACTIVE', 'This queue is closed');

          const { iso, asDate } = this.queueDate();
          // Take the number FIRST. The counter upsert locks the counter row until commit, so
          // issuers for this service point run one at a time from here on, and the max_waiting
          // count below cannot be passed by two concurrent joins. If we then throw QUEUE_FULL,
          // the rollback also gives the number back (no gap).
          const seq = await nextTicketSeq(tx, tenantId, servicePointId, iso);

          const waiting = await tx.ticket.count({
            where: { tenantId, servicePointId, queueDate: asDate, status: 'WAITING' },
          });
          if (waiting >= point.maxWaiting) throw new AppError(409, 'QUEUE_FULL', 'This queue is full');

          const ticket = await tx.ticket.create({
            data: {
              tenantId,
              servicePointId,
              queueDate: asDate,
              seq,
              number: `${point.prefix}-${String(seq).padStart(3, '0')}`, // D-6
              patientName: body.patientName,
              phone: body.phone,
              accessToken: randomBytes(32).toString('base64url'), // 256-bit, unguessable guest link
              issuedAt: this.clock.now(), // drives the 30-day purge (INV-9), so it comes from Clock (D-19)
            },
          });
          await tx.consent.create({
            data: { tenantId, ticketId: ticket.id, textVersion: CONSENT_TEXT_VERSION, acceptedAt: this.clock.now() },
          });
          await this.events.append(tx, {
            tenantId,
            servicePointId,
            ticketId: ticket.id,
            type: 'TICKET_ISSUED',
            actorKind: actor.kind,
            actorUserId: actor.kind === 'STAFF' ? actor.userId : undefined,
            payload: { number: ticket.number },
          });
          return { ticket: staffTicket(ticket), accessToken: ticket.accessToken };
        },
      ),
    );
  }

  /** US-10 / INV-3: call the lowest-sequence WAITING ticket. */
  callNext(
    tenantId: string,
    servicePointId: string,
    actorUserId: string,
    idempotencyKey: string | undefined,
  ): Promise<{ ticket: StaffTicket }> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      this.idempotency.run(
        tx,
        {
          tenantId,
          key: idempotencyKey,
          method: 'POST',
          route: '/queue/:servicePointId/call-next',
          path: `/queue/${servicePointId}/call-next`,
        },
        async () => {
          const point = await tx.servicePoint.findFirst({ where: { id: servicePointId, tenantId } });
          if (!point) throw notFound('Service point');

          const next = await lockNextWaitingTicket(tx, tenantId, servicePointId, this.queueDate().iso);
          if (!next) throw new AppError(409, 'QUEUE_EMPTY', 'No one is waiting'); // D-2
          return {
            ticket: await this.applyTransition(tx, tenantId, next, 'CALLED', { kind: 'STAFF', userId: actorUserId }),
          };
        },
      ),
    );
  }

  /** US-7, US-11..14: staff action on one ticket. */
  act(
    tenantId: string,
    ticketId: string,
    action: TicketAction,
    actorUserId: string,
    idempotencyKey: string | undefined,
  ): Promise<{ ticket: StaffTicket }> {
    return this.tenantPrisma.run(tenantId, (tx) =>
      this.idempotency.run(
        tx,
        {
          tenantId,
          key: idempotencyKey,
          method: 'POST',
          route: `/tickets/:id/${action}`,
          path: `/tickets/${ticketId}/${action}`,
        },
        async () => {
          const current = await tx.ticket.findFirst({
            where: { id: ticketId, tenantId },
            select: { id: true, slotId: true },
          });
          if (!current) throw notFound('Ticket');
          return {
            ticket: await this.applyTransition(tx, tenantId, current, ACTION_EVENT[action], {
              kind: 'STAFF',
              userId: actorUserId,
            }),
          };
        },
      ),
    );
  }

  /**
   * The ONLY place a ticket's status changes (INV-2, INV-8): one guarded UPDATE plus one event,
   * in the caller's transaction. The patient cancel endpoint (M3) will call this too.
   *
   * The UPDATE repeats the expected current status in its WHERE clause. If another request got
   * there first, zero rows match and we throw; the throw rolls the transaction back, so no
   * event is written for a transition that did not happen.
   */
  async applyTransition(
    tx: Tx,
    tenantId: string,
    target: { id: string; slotId: string | null },
    event: TransitionEvent,
    actor: Actor,
  ): Promise<StaffTicket> {
    const rule = TRANSITIONS[event];
    const now = this.clock.now();
    const releasesSlot = event === 'CANCELLED' && target.slotId !== null;

    // D-29: take the slot lock BEFORE the ticket lock, the same order booking uses, so a
    // concurrent book + cancel cannot deadlock.
    if (releasesSlot) await lockSlot(tx, tenantId, target.slotId!);

    const [ticket] = await tx.ticket.updateManyAndReturn({
      where: { id: target.id, tenantId, status: { in: [...rule.from] } },
      data: {
        status: rule.to,
        version: { increment: 1 },
        ...(event === 'CALLED' && actor.kind === 'STAFF' ? { calledAt: now, calledBy: actor.userId } : {}),
        ...(event === 'STARTED' ? { startedAt: now } : {}),
        ...(event === 'SERVED' || event === 'NO_SHOW' || event === 'SKIPPED' || event === 'CANCELLED'
          ? { completedAt: now }
          : {}),
      },
    });
    if (!ticket) {
      throw new AppError(409, 'INVALID_TRANSITION', 'The ticket is not in a state that allows this action');
    }

    if (releasesSlot) {
      await tx.slot.update({ where: { id: target.slotId! }, data: { bookedCount: { decrement: 1 } } });
    }

    await this.events.append(tx, {
      tenantId,
      servicePointId: ticket.servicePointId,
      ticketId: ticket.id,
      type: event,
      actorKind: actor.kind,
      actorUserId: actor.kind === 'STAFF' ? actor.userId : undefined,
      payload: { number: ticket.number },
    });
    return staffTicket(ticket);
  }

  /** Clinic-local day (D-6): ticket numbers reset daily and the queue only shows today. */
  private queueDate(): { iso: string; asDate: Date } {
    const iso = this.clock.localDate();
    return { iso, asDate: new Date(`${iso}T00:00:00.000Z`) };
  }
}
