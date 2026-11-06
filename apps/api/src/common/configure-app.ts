import type { INestApplication } from '@nestjs/common';
import type { Express } from 'express';

/** Settings shared by main.ts and the integration tests, so tests exercise the real URL layout. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  const hops = Number(process.env.TRUST_PROXY ?? 0);
  // Behind Railway/Vercel set TRUST_PROXY=1 so req.ip is the client, not the proxy. Leave 0 when exposed directly
  // (otherwise X-Forwarded-For can be spoofed to dodge the per-IP login limit).
  if (hops > 0) (app.getHttpAdapter().getInstance() as Express).set('trust proxy', hops);
}
