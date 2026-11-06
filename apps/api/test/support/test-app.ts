import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PasswordService } from '../../src/auth/password.service';
import { Clock, FakeClock } from '../../src/clock/clock';
import { configureApp } from '../../src/common/configure-app';
import { PrismaService } from '../../src/db/prisma.service';
import type { TestDb } from './test-db';

// Set before the Nest module is built: JwtModule and PasswordService read these at construction.
process.env.JWT_SECRET = 'integration-test-secret-integration-test-secret';
process.env.PASSWORD_SCRYPT_LOG_N = '10'; // fast hashing in tests; production default is 16

/** A route that forgot both @Public and @Roles. Default-deny must reject it. */
@Controller('__unmarked')
class UnmarkedController {
  @Get()
  secret() {
    return { leaked: true };
  }
}

export interface TestApp {
  app: INestApplication;
  http: ReturnType<typeof request>;
  clock: FakeClock;
  passwords: PasswordService;
  login: (email: string, password: string) => Promise<request.Response>;
  tokenFor: (email: string, password: string) => Promise<string>;
  close: () => Promise<void>;
}

export async function startTestApp(db: TestDb): Promise<TestApp> {
  const clock = new FakeClock(new Date());
  const moduleRef = await Test.createTestingModule({ imports: [AppModule], controllers: [UnmarkedController] })
    .overrideProvider(PrismaService)
    .useValue(db.prisma)
    .overrideProvider(Clock)
    .useValue(clock)
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  const http = request(app.getHttpServer());
  const login = (email: string, password: string) => http.post('/api/v1/auth/login').send({ email, password });
  return {
    app,
    http,
    clock,
    passwords: moduleRef.get(PasswordService),
    login,
    tokenFor: async (email, password) => {
      const res = await login(email, password);
      if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
      return res.body.accessToken as string;
    },
    close: () => app.close(),
  };
}
