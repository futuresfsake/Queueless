import { randomUUID } from 'node:crypto';
import { startTestDb, TestDb } from './support/test-db';

let db: TestDb;
let tenantA: string;
let tenantB: string;

async function makeTenant(slug: string): Promise<string> {
  const t = await db.tenantPrisma.runAsSuperAdmin((tx) =>
    tx.tenant.create({ data: { slug, name: slug.toUpperCase() } }),
  );
  return t.id;
}

const servicePoint = (tenantId: string, code: string, prefix: string) => ({
  tenantId,
  name: `SP ${code}`,
  code,
  prefix,
});

beforeAll(async () => {
  db = await startTestDb();
  tenantA = await makeTenant('clinic-a');
  tenantB = await makeTenant('clinic-b');
  await db.tenantPrisma.run(tenantA, (tx) =>
    tx.servicePoint.create({ data: servicePoint(tenantA, 'triage', 'A') }),
  );
  await db.tenantPrisma.run(tenantB, (tx) =>
    tx.servicePoint.create({ data: servicePoint(tenantB, 'triage', 'B') }),
  );
}, 180_000);

afterAll(async () => {
  await db?.stop();
});

describe('INV-7 tenant isolation (RLS, non-owner role)', () => {
  it('T-1 / US-21: tenant A sees only its own rows', async () => {
    const rows = await db.tenantPrisma.run(tenantA, (tx) => tx.servicePoint.findMany());
    expect(rows).toHaveLength(1);
    expect(rows[0].tenantId).toBe(tenantA);
  });

  it('T-1: tenant A cannot read tenant B rows even by explicit id', async () => {
    const bRow = await db.tenantPrisma.run(tenantB, (tx) => tx.servicePoint.findFirstOrThrow());
    const seenByA = await db.tenantPrisma.run(tenantA, (tx) =>
      tx.servicePoint.findUnique({ where: { id: bRow.id } }),
    );
    expect(seenByA).toBeNull();
  });

  it('T-1: tenant A cannot insert a row for tenant B', async () => {
    await expect(
      db.tenantPrisma.run(tenantA, (tx) =>
        tx.servicePoint.create({ data: servicePoint(tenantB, 'evil', 'E') }),
      ),
    ).rejects.toThrow();
  });

  it('T-1: tenant A cannot update or delete tenant B rows (0 rows affected)', async () => {
    const upd = await db.tenantPrisma.run(tenantA, (tx) =>
      tx.servicePoint.updateMany({ where: { tenantId: tenantB }, data: { name: 'hacked' } }),
    );
    const del = await db.tenantPrisma.run(tenantA, (tx) =>
      tx.servicePoint.deleteMany({ where: { tenantId: tenantB } }),
    );
    expect(upd.count).toBe(0);
    expect(del.count).toBe(0);
    const bRow = await db.tenantPrisma.run(tenantB, (tx) => tx.servicePoint.findFirstOrThrow());
    expect(bRow.name).not.toBe('hacked');
  });

  it('T-2: with no tenant set, reads return zero rows (fail closed)', async () => {
    const rows = await db.prisma.servicePoint.findMany(); // bare client, no set_config
    expect(rows).toHaveLength(0);
  });

  it('T-2: with no tenant set, writes are rejected', async () => {
    await expect(
      db.prisma.servicePoint.create({ data: servicePoint(tenantA, 'sneaky', 'S') }),
    ).rejects.toThrow();
  });

  it('T-2: the tenant setting does not leak to the next transaction on a pooled connection', async () => {
    await db.tenantPrisma.run(tenantA, (tx) => tx.servicePoint.findMany());
    // Same pool, next call without a tenant must see nothing.
    for (let i = 0; i < 10; i++) {
      expect(await db.prisma.servicePoint.findMany()).toHaveLength(0);
    }
  });

  it('INV-7: tenant ids must be UUIDs (no injection through the setting value)', () => {
    expect(() => db.tenantPrisma.run("x'; DROP TABLE tenants;--", async () => 1)).toThrow();
  });

  it('INV-7: non-super-admin cannot write tenants, but tenants are readable', async () => {
    await expect(
      db.tenantPrisma.run(tenantA, (tx) => tx.tenant.create({ data: { slug: 'x', name: 'x' } })),
    ).rejects.toThrow();
    const readable = await db.tenantPrisma.run(tenantA, (tx) => tx.tenant.findMany());
    expect(readable.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Database posture', () => {
  it('T-3: the app role is not superuser, does not bypass RLS, and owns nothing', async () => {
    const [role] = await db.prisma.$queryRaw<
      { current_user: string; rolsuper: boolean; rolbypassrls: boolean }[]
    >`SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    expect(role.current_user).toBe('queueless_app');
    expect(role.rolsuper).toBe(false);
    expect(role.rolbypassrls).toBe(false);

    const owned = await db.prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner = current_user`;
    expect(owned).toHaveLength(0);
  });

  it('INV-7: every table has RLS enabled AND forced', async () => {
    const rows = await db.prisma.$queryRaw<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> '_prisma_migrations'
      ORDER BY c.relname`;
    const exposed = rows.filter((r) => !r.relrowsecurity || !r.relforcerowsecurity);
    // slots/etc. that lack a policy would show here; every table except none is expected to be protected.
    expect(exposed.map((r) => r.relname)).toEqual([]);
  });

  it('T-12 / INV-6: queue_events cannot be updated or deleted by the app role', async () => {
    const spId = (await db.tenantPrisma.run(tenantA, (tx) => tx.servicePoint.findFirstOrThrow())).id;
    const ticketId = randomUUID();
    await db.tenantPrisma.run(tenantA, async (tx) => {
      await tx.ticket.create({
        data: {
          id: ticketId,
          tenantId: tenantA,
          servicePointId: spId,
          queueDate: new Date('2026-11-06'),
          seq: 1,
          number: 'A-001',
          accessToken: randomUUID() + randomUUID(),
        },
      });
      await tx.queueEvent.create({
        data: { tenantId: tenantA, ticketId, servicePointId: spId, type: 'TICKET_ISSUED', actorKind: 'PATIENT' },
      });
    });
    await expect(
      db.tenantPrisma.run(tenantA, (tx) => tx.queueEvent.updateMany({ data: { type: 'CALLED' } })),
    ).rejects.toThrow();
    await expect(
      db.tenantPrisma.run(tenantA, (tx) => tx.queueEvent.deleteMany({})),
    ).rejects.toThrow();
    const events = await db.tenantPrisma.run(tenantA, (tx) => tx.queueEvent.findMany());
    expect(events).toHaveLength(1);
  });

  it('T-19 / US-22: the database answers a trivial query as the app role', async () => {
    const [{ ok }] = await db.prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    expect(ok).toBe(1);
  });
});
