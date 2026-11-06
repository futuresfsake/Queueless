// D-19: business logic never calls Date.now()/new Date() directly. It injects Clock.
// The simulator and tests swap in FakeClock to control time.

export abstract class Clock {
  abstract now(): Date;

  /** Clinic-local calendar date (YYYY-MM-DD) for a given instant. Used for daily ticket-number resets (D-6). */
  localDate(tz: string = process.env.CLINIC_TZ ?? 'Asia/Manila', at: Date = this.now()): string {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(at);
  }
}

export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}

/** Deterministic clock for tests and the simulator. Time only moves when told to, and never backwards. */
export class FakeClock extends Clock {
  private current: Date;

  constructor(start: Date | string = '2026-01-01T00:00:00.000Z') {
    super();
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    if (ms < 0) throw new Error('FakeClock cannot move backwards');
    this.current = new Date(this.current.getTime() + ms);
  }

  set(to: Date | string): void {
    const next = new Date(to);
    if (next < this.current) throw new Error('FakeClock cannot move backwards');
    this.current = next;
  }
}
