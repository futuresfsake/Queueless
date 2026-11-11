import {
  ALL_STATUSES,
  canTransition,
  FINAL_STATUSES,
  statusAfter,
  TRANSITION_EVENTS,
  TRANSITIONS,
} from './ticket-state-machine';

// The allowed edges, copied from docs/tech/state-machine.md. Anything not listed must be rejected.
const ALLOWED = new Set([
  'WAITING>CALLED>CALLED',
  'WAITING>CANCELLED>CANCELLED',
  'CALLED>STARTED>SERVING',
  'CALLED>NO_SHOW>NO_SHOW',
  'CALLED>SKIPPED>SKIPPED',
  'CALLED>CANCELLED>CANCELLED',
  'SERVING>SERVED>SERVED',
]);

describe('ticket state machine', () => {
  it('T-5 / INV-2: exactly the documented transitions are allowed (every status x event pair)', () => {
    const actual = new Set<string>();
    for (const from of ALL_STATUSES) {
      for (const event of TRANSITION_EVENTS) {
        if (canTransition(from, event)) actual.add(`${from}>${event}>${TRANSITIONS[event].to}`);
      }
    }
    expect(actual).toEqual(ALLOWED);
  });

  it('T-6 / INV-2: final states have no exits', () => {
    for (const from of FINAL_STATUSES) {
      for (const event of TRANSITION_EVENTS) {
        expect(canTransition(from, event)).toBe(false);
      }
    }
  });

  it('ADR-002: every event maps to the status used when replaying the log', () => {
    expect(statusAfter('TICKET_ISSUED')).toBe('WAITING');
    expect(statusAfter('STARTED')).toBe('SERVING');
    for (const event of TRANSITION_EVENTS) expect(statusAfter(event)).toBe(TRANSITIONS[event].to);
  });
});
