import type { INestApplication } from '@nestjs/common';
import type { Express, NextFunction, Request, Response } from 'express';

/** Settings shared by main.ts and the integration tests, so tests exercise the real URL layout. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  const hops = Number(process.env.TRUST_PROXY ?? 0);
  // Behind Railway/Vercel set TRUST_PROXY=1 so req.ip is the client, not the proxy. Leave 0 when exposed directly
  // (otherwise X-Forwarded-For can be spoofed to dodge the per-IP login limit).
  const express = app.getHttpAdapter().getInstance() as Express;
  if (hops > 0) express.set('trust proxy', hops);
  // HSTS: tell browsers to stay on HTTPS. Sent only when the request arrived over TLS (req.secure, which needs
  // TRUST_PROXY behind a TLS-terminating host), so local http dev is unaffected. The host does the http->https redirect.
  express.use((req: Request, res: Response, next: NextFunction) => {
    if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    next();
  });
}
