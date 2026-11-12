import { randomUUID } from 'node:crypto';
import { AuditService } from '../src/audit/audit.service';
import { SystemClock } from '../src/clock/clock';
import { PurgeService } from '../src/privacy/purge.service';
import { startTestApp, TestApp } from './support/test-app';
import { startTestDb, TestDb } from './support/test-db';

// T-18 / INV-9: name and phone are cleared after 30 days; everything else about the ticket stays.
const SUPER = { email: 'root@queueless.test', password: 'super-admin-password-1' };
const PW = 'correct-horse-battery';
let db: TestDb;
let t: TestApp;
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  db = await startTestDb();
  t = await startTestApp(db);
  const passwordHash = await t.passwords.hash(SUPER.password);
  await db.tenantPrisma.runAsSuperAdmin((tx) =>
    tx.user.create({ data: { email: SUPER.email, passwordHash, role: 'SUPER_ADMIN', tenantId: null } }),
  );
}, 180_000);

afterAll(async () => {
  await t?.close();
  await db?.stop();
});

it('the purge is registered in the running app (it would silently never run otherwise)', () => {
  expect(t.app.get(PurgeService)).toBeInstanceOf(PurgeService);
});

it('T-18: clears name and phone of tickets older than 30 days, keeps recent ones and the ticket history', async () => {
  const superToken = await t.tokenFor(SUPER.email, SUPER.password);
  const created = await t.http
    .post('/api/v1/tenants')
    .set(bearer(superToken))
    .send({ slug: 'purge-a', name: 'Purge A', admin: { email: 'admin@purge-a.test', password: PW } });
  const tenantId = created.body.id as string;
  const admin = await t.tokenFor('admin@purge-a.test', PW);
  await t.http.post('/api/v1/users').set(bearer(admin)).send({ email: 'staff@purge-a.test', password: PW });
  const staff = await t.tokenFor('staff@purge-a.test', PW);
  const sp = (await t.http.post('/api/v1/service-points').set(bearer(admin)).send({ name: 'D', code: 'd', prefix: 'PG' })).body.id;

  const issue = (name: string) =>
    t.http
      .post(`/api/v1/queue/${sp}/tickets`)
      .set(bearer(staff))
      .set('Idempotency-Key', randomUUID())
      .send({ patientName: name, phone: '+639171234567', consent: true });
  const old = (await issue('Old Patient')).body.ticket;
  const recent = (await issue('Recent Patient')).body.ticket;

  // Make the first ticket 31 days old (superuser: the app role has no reason to ever do this).
  const sup = await db.superUser();
  try {
    await sup.query(`UPDATE tickets SET issued_at = now() - interval '31 days' WHERE id = $1`, [old.id]);
  } finally {
    await sup.end();
  }

  // Before the purge the auditor sees the problem (A-7) ...
  const audit = new AuditService(db.prisma, db.tenantPrisma, new SystemClock());
  const before = await audit.runTenant(tenantId, { record: false, windowDays: 0 });
  expect(before.checks.find((c) => c.id === 'A-7')!.passed).toBe(false);

  const purge = new PurgeService(db.prisma, db.tenantPrisma, new SystemClock());
  expect(await purge.purgeAll()).toBe(1);
  expect(await purge.purgeAll()).toBe(0); // idempotent

  const rows = await db.tenantPrisma.run(tenantId, (tx) => tx.ticket.findMany({ orderBy: { seq: 'asc' } }));
  const oldRow = rows.find((r) => r.id === old.id)!;
  const recentRow = rows.find((r) => r.id === recent.id)!;
  expect(oldRow.phone).toBeNull();
  expect(oldRow.patientName).toBeNull();
  expect(oldRow.number).toBe(old.number); // the ticket itself and its history stay
  expect(oldRow.status).toBe('WAITING');
  expect(recentRow.phone).toBe('+639171234567');
  expect(recentRow.patientName).toBe('Recent Patient');

  // ... and after it, A-7 passes and the rest of the audit is still clean.
  const after = await audit.runTenant(tenantId, { record: false, windowDays: 0 });
  expect(after.checks.find((c) => c.id === 'A-7')!.passed).toBe(true);
  expect(after.passed).toBe(true);
});
