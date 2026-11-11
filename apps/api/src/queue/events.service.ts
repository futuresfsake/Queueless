import { Injectable } from '@nestjs/common';
import type { ActorKind, EventType, Prisma } from '@prisma/client';
import type { Tx } from '../db/tenant-prisma.service';

@Injectable()
export class EventsService {
  append(
    tx: Tx,
    event: {
      tenantId: string;
      servicePointId: string;
      ticketId: string;
      type: EventType;
      actorUserId?: string;
      actorKind: ActorKind;
      payload?: Prisma.InputJsonValue;
    },
  ) {
    return tx.queueEvent.create({
      data: {
        tenantId: event.tenantId,
        servicePointId: event.servicePointId,
        ticketId: event.ticketId,
        type: event.type,
        actorUserId: event.actorUserId,
        actorKind: event.actorKind,
        payload: event.payload ?? {},
      },
    });
  }
}
