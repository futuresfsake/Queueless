import { FakeClock } from '../clock/clock';
import { AppError } from '../common/app-error';
import { LoginThrottle } from './login-throttle.service';

const MIN = 60_000;

function blocked(fn: () => void): AppError | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e as AppError;
  }
}

describe('LoginThrottle (D-28, US-36)', () => {
  it('T-25: allows 4 failures, blocks from the 5th failure on, with TOO_MANY_ATTEMPTS', () => {
    const t = new LoginThrottle(new FakeClock());
    for (let i = 0; i < 4; i++) {
      t.assertAllowed('a@x.com', '1.1.1.1');
      t.recordFailure('a@x.com', '1.1.1.1');
    }
    t.assertAllowed('a@x.com', '1.1.1.1'); // still allowed: 4 failures
    t.recordFailure('a@x.com', '1.1.1.1'); // 5th
    const err = blocked(() => t.assertAllowed('a@x.com', '1.1.1.1'));
    expect(err?.code).toBe('TOO_MANY_ATTEMPTS');
    expect(err?.getStatus()).toBe(429);
    expect(err?.details.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('T-25: unlocks 15 minutes after the first counted failure (virtual Clock)', () => {
    const clock = new FakeClock();
    const t = new LoginThrottle(clock);
    for (let i = 0; i < 5; i++) t.recordFailure('a@x.com', '1.1.1.1');
    clock.advance(14 * MIN);
    expect(blocked(() => t.assertAllowed('a@x.com', '1.1.1.1'))).not.toBeNull();
    clock.advance(1 * MIN + 1);
    expect(blocked(() => t.assertAllowed('a@x.com', '1.1.1.1'))).toBeNull();
  });

  it('a success clears that email, and other emails are unaffected', () => {
    const t = new LoginThrottle(new FakeClock());
    for (let i = 0; i < 4; i++) t.recordFailure('a@x.com', '1.1.1.1');
    t.recordSuccess('a@x.com');
    t.recordFailure('a@x.com', '2.2.2.2');
    expect(blocked(() => t.assertAllowed('a@x.com', '2.2.2.2'))).toBeNull();
    expect(blocked(() => t.assertAllowed('other@x.com', '3.3.3.3'))).toBeNull();
  });

  it('per-IP cap stops one address from spraying many emails', () => {
    const t = new LoginThrottle(new FakeClock());
    for (let i = 0; i < LoginThrottle.IP_LIMIT; i++) t.recordFailure(`user${i}@x.com`, '9.9.9.9');
    expect(blocked(() => t.assertAllowed('fresh@x.com', '9.9.9.9'))?.code).toBe('TOO_MANY_ATTEMPTS');
    expect(blocked(() => t.assertAllowed('fresh@x.com', '8.8.8.8'))).toBeNull();
  });
});
