import { randomUUID } from 'node:crypto';
import { AuditService } from '../src/audit/audit.service';
import { PrismaService } from '../src/db/prisma.service';
import { TenantPrisma } from '../src/db/tenant-prisma.service';
import { SystemClock } from '../src/clock/clock';
import { startTestApp, TestApp } from './support/test-app';
import { startTestDb, TestDb } from './support/test-db';

// T-21 / US-33: the auditor passes on clean data, and EACH check fails (with its own ID) when the
// data is deliberately corrupted. Corruption uses the superuser connection, which bypasses RLS and
// grants; the append-only triggers are switched off per session where a test needs to rewrite events.
const SUPER = { email: 'root@queueless.test', password: 'super-admin-password-1' };
const PW = 'correct-horse-battery';
let db: TestDb;
let t: TestApp;
let audit: AuditService;
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const key = () => ({ 'Idempotency-Key': randomUUID() });

interface Clinic {
  tenantId: string;
  slug: string;
  tickets: { waiting: string; served: string; booked: string };
  numbers: { waiting: string; served: string; booked: string };
  slotId: string;
}
let n = 0;

/** A small clean clinic: one WAITING ticket, one SERVED ticket, one ticket booked into a slot. */
async function cleanClinic(): Promise<Clinic> {
  const slug = `audit-${n++}`;
  const superToken = await t.tokenFor(SUPER.email, SUPER.password);
  const created = await t.http
    .post('/api/v1/tenants')
    .set(bearer(superToken))
    .send({ slug, name: slug, admin: { email: `admin@${slug}.test`, password: PW } });
  const admin = await t.tokenFor(`admin@${slug}.test`, PW);
  await t.http.post('/api/v1/users').set(bearer(admin)).send({ email: `staff@${slug}.test`, password: PW });
  const staff = await t.tokenFor(`staff@${slug}.test`, PW);
  const sp = (await t.http.post('/api/v1/service-points').set(bearer(admin)).send({ name: 'D', code: 'd', prefix: 'AU' })).body.id;
  const slotId = (
    await t.http
      .post('/api/v1/slots')
      .set(bearer(admin))
      .send({ servicePointId: sp, startsAt: new Date(Date.now() + 60_000).toISOString(), capacity: 2 })
  ).body.id;

  const issue = (name: string) =>
    t.http.post(`/api/v1/queue/${sp}/tickets`).set(bearer(staff)).set(key()).send({ patientName: name, consent: true, phone: '+639171234567' });
  const served = (await issue('Served')).body.ticket;
  const called = await t.http.post(`/api/v1/queue/${sp}/call-next`).set(bearer(staff)).set(key());
  expect(called.body.ticket.id).toBe(served.id);
  await t.http.post(`/api/v1/tickets/${served.id}/start`).set(bearer(staff)).set(key()).expect(200);
  await t.http.post(`/api/v1/tickets/${served.id}/complete`).set(bearer(staff)).set(key()).expect(200);
  const waiting = (await issue('Waiting')).body.ticket;
  const booked = (
    await t.http.post(`/api/v1/public/c/${slug}/slots/${slotId}/book`).set(key()).send({ patientName: 'Booked', consent: true })
  ).body.ticket;
  return {
    tenantId: created.body.id,
    slug,
    tickets: { waiting: waiting.id, served: served.id, booked: booked.id },
    numbers: { waiting: waiting.number, served: served.number, booked: booked.number },
    slotId,
  };
}

/** Run SQL as the superuser with triggers off (so append-only events can be tampered with). */
async function corrupt(sql: string, params: unknown[] = []) {
  const c = await db.superUser();
  try {
    await c.query('SET session_replication_role = replica');
    await c.query(sql, params);
  } finally {
    await c.end();
  }
}

const failed = (r: Awaited<ReturnType<AuditService['runTenant']>>) => r.checks.filter((c) => !c.passed).map((c) => c.id);

beforeAll(async () => {
  db = await startTestDb();
  t = await startTestApp(db);
  const passwordHash = await t.passwords.hash(SUPER.password);
  await db.tenantPrisma.runAsSuperAdmin((tx) =>
    tx.user.create({ data: { email: SUPER.email, passwordHash, role: 'SUPER_ADMIN', tenantId: null } }),
  );
  audit = new AuditService(db.prisma, db.tenantPrisma, new SystemClock());
}, 180_000);

afterAll(async () => {
  await t?.close();
  await db?.stop();
});

describe('T-21 invariant auditor', () => {
  it('a clean clinic passes A-1..A-5, A-7, A-8 and the security audit A-6', async () => {
    const c = await cleanClinic();
    const report = await audit.runTenant(c.tenantId, { trigger: 'ci' });
    expect(failed(report)).toEqual([]);
    expect(report.passed).toBe(true);
    expect((await audit.runSecurity()).passed).toBe(true);
    // The run is stored (append-only by privilege) and carries no patient data.
    const stored = await db.tenantPrisma.run(c.tenantId, (tx) => tx.auditRun.findMany());
    expect(stored).toHaveLength(1);
    expect(JSON.stringify(stored[0].results)).not.toMatch(/Served|Waiting|Booked|6391/);
  });

  it('A-2 fails when a ticket status disagrees with its events', async () => {
    const c = await cleanClinic();
    await corrupt(`UPDATE tickets SET status = 'SERVED' WHERE id = $1`, [c.tickets.waiting]);
    const r = await audit.runTenant(c.tenantId, { record: false });
    expect(failed(r)).toContain('A-2');
    expect(r.checks.find((x) => x.id === 'A-2')!.sample).toEqual([c.numbers.waiting]);
  });

  it('A-3 fails on an event that skips the state machine (ISSUED then SERVED)', async () => {
    const c = await cleanClinic();
    await corrupt(
      `INSERT INTO queue_events (tenant_id, service_point_id, ticket_id, type, actor_kind)
       SELECT tenant_id, service_point_id, id, 'SERVED', 'STAFF' FROM tickets WHERE id = $1`,
      [c.tickets.waiting],
    );
    const r = await audit.runTenant(c.tenantId, { record: false });
    expect(failed(r)).toContain('A-3');
    expect(r.checks.find((x) => x.id === 'A-3')!.sample).toEqual([c.numbers.waiting]);
  });

  it('A-4 fails when a slot counter drifts from the tickets holding it', async () => {
    const c = await cleanClinic();
    await corrupt(`UPDATE slots SET booked_count = 0 WHERE id = $1`, [c.slotId]);
    const r = await audit.runTenant(c.tenantId, { record: false });
    expect(failed(r)).toContain('A-4');
    expect(r.checks.find((x) => x.id === 'A-4')!.sample).toEqual([c.slotId]);
  });

  it('A-5 fails when a ticket was called twice', async () => {
    const c = await cleanClinic();
    await corrupt(
      `INSERT INTO queue_events (tenant_id, service_point_id, ticket_id, type, actor_kind)
       SELECT tenant_id, service_point_id, id, 'CALLED', 'STAFF' FROM tickets WHERE id = $1`,
      [c.tickets.served],
    );
    const r = await audit.runTenant(c.tenantId, { record: false });
    expect(failed(r)).toContain('A-5');
    expect(r.checks.find((x) => x.id === 'A-5')!.sample).toEqual([c.numbers.served]);
  });

  it('A-7 fails when a patient name or phone outlives 30 days', async () => {
    const c = await cleanClinic();
    await corrupt(`UPDATE tickets SET issued_at = now() - interval '40 days' WHERE id = $1`, [c.tickets.waiting]);
    const r = await audit.runTenant(c.tenantId, { record: false, windowDays: 0 });
    expect(failed(r)).toContain('A-7');
    expect(r.checks.find((x) => x.id === 'A-7')!.sample).toEqual([c.numbers.waiting]);
  });

  it('A-8 fails when a status timestamp has no matching event', async () => {
    const c = await cleanClinic();
    await corrupt(`UPDATE tickets SET started_at = now() WHERE id = $1`, [c.tickets.waiting]);
    const r = await audit.runTenant(c.tenantId, { record: false });
    expect(failed(r)).toContain('A-8');
    expect(r.checks.find((x) => x.id === 'A-8')!.sample).toEqual([c.numbers.waiting]);
  });

  it('A-6 fails when the API would connect as a superuser (RLS bypassed)', async () => {
    const bad = new PrismaService(db.superUrl);
    try {
      const r = await new AuditService(bad, new TenantPrisma(bad), new SystemClock()).runSecurity();
      expect(r.passed).toBe(false);
      expect(r.sample.join(' ')).toMatch(/superuser/);
    } finally {
      await bad.$disconnect();
    }
  });

  it('A-1 fails on a duplicate ticket number (the unique index is dropped first, to simulate its absence)', async () => {
    const c = await cleanClinic();
    const sup = await db.superUser();
    try {
      await sup.query('DROP INDEX IF EXISTS "tickets_service_point_id_queue_date_seq_key"');
      await sup.query(
        `INSERT INTO tickets (id, tenant_id, service_point_id, queue_date, seq, number, status, access_token, issued_at, version)
         SELECT gen_random_uuid(), tenant_id, service_point_id, queue_date, seq, number, 'WAITING', 'dup-' || gen_random_uuid(), now(), 0
         FROM tickets WHERE id = $1`,
        [c.tickets.waiting],
      );
    } finally {
      await sup.end();
    }
    const r = await audit.runTenant(c.tenantId, { record: false });
    expect(failed(r)).toContain('A-1');
    expect(r.checks.find((x) => x.id === 'A-1')!.sample).toEqual([c.numbers.waiting]);
  });
});
