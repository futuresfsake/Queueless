import { HealthController } from './health.controller';
import type { PrismaService } from './db/prisma.service';

const prismaWith = (query: () => Promise<unknown>) =>
  ({ $queryRaw: query }) as unknown as PrismaService;

describe('HealthController', () => {
  it('US-22: reports degraded when the database is unreachable', async () => {
    const res = await new HealthController(
      prismaWith(() => Promise.reject(new Error('no db'))),
    ).check();
    expect(res.db).toBe('down');
    expect(res.status).toBe('degraded');
  });

  it('US-22 / T-19: reports ok when the database answers', async () => {
    const res = await new HealthController(prismaWith(() => Promise.resolve([{ '?column?': 1 }]))).check();
    expect(res.db).toBe('up');
    expect(res.status).toBe('ok');
  });
});
