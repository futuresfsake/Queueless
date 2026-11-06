import { FakeClock, SystemClock } from './clock';

describe('Clock (D-19)', () => {
  it('SystemClock returns the current time', () => {
    const before = Date.now();
    const t = new SystemClock().now().getTime();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(Date.now());
  });

  it('FakeClock only moves when told to', () => {
    const c = new FakeClock('2026-11-06T00:00:00.000Z');
    expect(c.now().toISOString()).toBe('2026-11-06T00:00:00.000Z');
    c.advance(90_000);
    expect(c.now().toISOString()).toBe('2026-11-06T00:01:30.000Z');
  });

  it('FakeClock never moves backwards', () => {
    const c = new FakeClock('2026-11-06T00:00:00.000Z');
    expect(() => c.advance(-1)).toThrow();
    expect(() => c.set('2026-11-05T00:00:00.000Z')).toThrow();
  });

  it('D-6: localDate uses Asia/Manila, not UTC (16:30Z is already the next day in Manila)', () => {
    const c = new FakeClock('2026-11-06T16:30:00.000Z');
    expect(c.localDate('Asia/Manila')).toBe('2026-11-07');
    expect(c.localDate('UTC')).toBe('2026-11-06');
  });
});
