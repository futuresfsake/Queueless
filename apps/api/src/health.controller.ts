import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@queueless/shared';
import { Public } from './auth/decorators';
import { PrismaService } from './db/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness only: the process is up. Deliberately does NOT touch the database, so an uptime monitor that pings
   * this keeps the web host awake without keeping a scale-to-zero database (Neon free) awake around the clock.
   */
  @Public()
  @Get('live')
  live(): { status: 'ok'; uptimeSeconds: number } {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  @Public()
  @Get()
  async check(): Promise<HealthResponse> {
    let db: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }
    return {
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
