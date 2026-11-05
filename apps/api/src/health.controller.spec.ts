import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('US-22: reports degraded when no database is configured', async () => {
    const res = await new HealthController().check();
    expect(res.db).toBe('down');
    expect(res.status).toBe('degraded');
  });
});
