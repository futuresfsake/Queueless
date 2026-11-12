import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { configureApp } from './common/configure-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',');
  app.enableCors({ origin: origins, credentials: true });
  configureApp(app);

  // Single-deploy mode: if the built web app is present, serve it from the same origin as the API
  // (no CORS, one URL). Dev uses the Vite server instead and leaves WEB_DIST unset.
  const webDist = process.env.WEB_DIST ? path.resolve(process.env.WEB_DIST) : null;
  if (webDist && existsSync(path.join(webDist, 'index.html'))) {
    app.useStaticAssets(webDist, { index: false, maxAge: '1h' });
    // SPA fallback so deep links (/t/:token, /tv/...) survive a refresh. API and socket paths are excluded.
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) return next();
      res.sendFile(path.join(webDist, 'index.html'));
    });
    console.log(`Serving web app from ${webDist}`);
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`API listening on :${port}`);
}
bootstrap();
