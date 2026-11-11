import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Clock } from '../clock/clock';
import { AppError } from '../common/app-error';

const WINDOW_MS = 60_000;
const MAX_KEYS = 10_000;

/**
 * US-36 / D-28: per-IP limit on public writes (join, book, cancel). In-memory because the MVP is a
 * single API server (ADR-005). Reads are not limited. The limit is per minute and per IP; a clinic
 * shares one NAT address, so it is loose (PUBLIC_WRITE_LIMIT, default 30). Time comes from Clock (D-19).
 */
@Injectable()
export class PublicRateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();
  private readonly limit = Number(process.env.PUBLIC_WRITE_LIMIT ?? 30);

  constructor(private readonly clock: Clock) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const ip = String(req.ip ?? 'unknown');
    const now = this.clock.now().getTime();
    const recent = (this.hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= this.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 1000));
      throw new AppError(429, 'RATE_LIMITED', 'Too many requests. Try again in a minute.', { retryAfterSeconds });
    }
    recent.push(now);
    this.hits.delete(ip); // re-insert so the Map stays in recency order for eviction
    this.hits.set(ip, recent);
    if (this.hits.size > MAX_KEYS) this.hits.delete(this.hits.keys().next().value as string);
    return true;
  }
}
