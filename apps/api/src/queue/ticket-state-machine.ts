import type { EventType, TicketStatus } from '@prisma/client';

// The ticket state machine (docs/tech/state-machine.md). Pure data, no I/O, so INV-2 can be
// unit-tested over every (status, event) pair.

/** Events that move an existing ticket. TICKET_ISSUED creates one; TRANSFERRED is post-MVP. */
export type TransitionEvent = Extract<EventType, 'CALLED' | 'STARTED' | 'SERVED' | 'NO_SHOW' | 'SKIPPED' | 'CANCELLED'>;

export const TRANSITIONS: Record<TransitionEvent, { from: readonly TicketStatus[]; to: TicketStatus }> = {
  CALLED: { from: ['WAITING'], to: 'CALLED' },
  STARTED: { from: ['CALLED'], to: 'SERVING' },
  SERVED: { from: ['SERVING'], to: 'SERVED' },
  NO_SHOW: { from: ['CALLED'], to: 'NO_SHOW' },
  SKIPPED: { from: ['CALLED'], to: 'SKIPPED' },
  CANCELLED: { from: ['WAITING', 'CALLED'], to: 'CANCELLED' },
};

export const TRANSITION_EVENTS = Object.keys(TRANSITIONS) as TransitionEvent[];
export const ALL_STATUSES: TicketStatus[] = ['WAITING', 'CALLED', 'SERVING', 'SERVED', 'SKIPPED', 'NO_SHOW', 'CANCELLED'];
export const FINAL_STATUSES: TicketStatus[] = ['SERVED', 'SKIPPED', 'NO_SHOW', 'CANCELLED'];

export function canTransition(from: TicketStatus, event: TransitionEvent): boolean {
  return TRANSITIONS[event].from.includes(from);
}

/** Projection rule (ADR-002): the status a ticket has after this event. Used to rebuild state from the log. */
export function statusAfter(event: EventType): TicketStatus {
  if (event === 'TICKET_ISSUED') return 'WAITING';
  if (event === 'TRANSFERRED') throw new Error('TRANSFERRED is post-MVP (multi-stage-visits.md)');
  return TRANSITIONS[event].to;
}
