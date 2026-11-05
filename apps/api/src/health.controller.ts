import { Controller, Get } from '@nestjs/common';
import { Pool } from 'pg';
import type { HealthResponse } from '@queueless/shared';

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  : null;

@Controller('health')
export class HealthController {
  @Get()
  async check(): Promise<HealthResponse> {
    let db: 'up' | 'down' = 'down';
    if (pool) {
      try {
        await pool.query('SELECT 1');
        db = 'up';
      } catch {
        db = 'down';
      }
    }
    return {
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
