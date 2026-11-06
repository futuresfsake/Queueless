import { Injectable } from '@nestjs/common';
import { Clock } from '../clock/clock';
import { AppError } from '../common/app-error';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_KEYS = 10_000;

/**
 * D-28 / US-36: 5 failed logins per 15 minutes per email, plus a looser per-IP cap (a clinic shares one NAT IP).
 * In-memory because the MVP is a single API server (ADR-005). Unknown emails are counted exactly like real ones,
 * so the response never reveals whether an account exists (T-25). Time comes from Clock (D-19).
 * Trade-off: someone can lock a known email out for 15 minutes. Accepted for an MVP; noted in security-privacy.md.
 */
@Injectable()
export class LoginThrottle {
  static readonly EMAIL_LIMIT = 5;
  static readonly IP_LIMIT = 20;

  private readonly failures = new Map<string, number[]>();

  constructor(private readonly clock: Clock) {}

  /** Throws 429 TOO_MANY_ATTEMPTS when either key is over its limit. */
  assertAllowed(email: string, ip: string): void {
    const wait = Math.max(
      this.waitSeconds(`e:${email}`, LoginThrottle.EMAIL_LIMIT),
      this.waitSeconds(`ip:${ip}`, LoginThrottle.IP_LIMIT),
    );
    if (wait > 0) {
      throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Too many failed attempts. Try again later.', {
        retryAfterSeconds: wait,
      });
    }
  }

  recordFailure(email: string, ip: string): void {
    const now = this.clock.now().getTime();
    for (const key of [`e:${email}`, `ip:${ip}`]) {
      const recent = this.recent(key, now);
      recent.push(now);
      this.failures.set(key, recent);
    }
    if (this.failures.size > MAX_KEYS) this.sweep(now);
  }

  recordSuccess(email: string): void {
    this.failures.delete(`e:${email}`);
  }

  private recent(key: string, now: number): number[] {
    return (this.failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  }

  private waitSeconds(key: string, limit: number): number {
    const now = this.clock.now().getTime();
    const recent = this.recent(key, now);
    if (recent.length < limit) return 0;
    return Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 1000));
  }

  /** Bound memory against an attacker spraying random emails. */
  private sweep(now: number): void {
    for (const [key] of this.failures) {
      if (this.recent(key, now).length === 0) this.failures.delete(key);
    }
    // Still too big: drop the oldest keys (Map keeps insertion order).
    for (const key of this.failures.keys()) {
      if (this.failures.size <= MAX_KEYS) break;
      this.failures.delete(key);
    }
  }
}
