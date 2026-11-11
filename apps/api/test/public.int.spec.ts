import { randomUUID } from 'node:crypto';
import { startTestApp, TestApp } from './support/test-app';
import { startTestDb, TestDb } from './support/test-db';

const SUPER = { email: 'root@queueless.test', password: 'super-admin-password-1' };
const PW = 'correct-horse-battery';
let db: TestDb;
let t: TestApp;
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const key = () => ({ 'Idempotency-Key': randomUUID() });

async function createClinic(slug: string) {
  const superToken = await t.tokenFor(SUPER.email, SUPER.password);
  const created = await t.http
    .post('/api/v1/tenants')
    .set(bearer(superToken))
    .send({ slug, name: `Clinic ${slug}`, admin: { email: `admin@${slug}.test`, password: PW } });
  expect(created.status).toBe(201);
  const admin = await t.tokenFor(`admin@${slug}.test`, PW);
  await t.http.post('/api/v1/users').set(bearer(admin)).send({ email: `staff@${slug}.test`, password: PW });
  const sp = await t.http
    .post('/api/v1/service-points')
    .set(bearer(admin))
    .send({ name: 'Desk', code: 'desk', prefix: 'PB' });
  return {
    slug,
    admin,
    staff: await t.tokenFor(`staff@${slug}.test`, PW),
    sp: sp.body.id as string,
    tenantId: created.body.id as string,
  };
}
type Clinic = Awaited<ReturnType<typeof createClinic>>;

const join = (c: Clinic, name = 'Ana', extra: object = {}) =>
  t.http
    .post(`/api/v1/public/c/${c.slug}/service-points/desk/tickets`)
    .set(key())
    .send({ patientName: name, consent: true, ...extra });

const makeSlot = async (c: Clinic, capacity: number, startsAt = new Date(t.clock.now().getTime() + 60_000)) => {
  const res = await t.http
    .post('/api/v1/slots')
    .set(bearer(c.admin))
    .send({ servicePointId: c.sp, startsAt: startsAt.toISOString(), capacity });
  expect(res.status).toBe(201);
  return res.body.id as string;
};
const book = (c: Clinic, slotId: string, name = 'Ben') =>
  t.http.post(`/api/v1/public/c/${c.slug}/slots/${slotId}/book`).set(key()).send({ patientName: name, consent: true });

let a: Clinic;
let b: Clinic;

beforeAll(async () => {
  process.env.PUBLIC_WRITE_LIMIT = '1000'; // the rate-limit test builds its own app with a low limit
  db = await startTestDb();
  t = await startTestApp(db);
  const passwordHash = await t.passwords.hash(SUPER.password);
  await db.tenantPrisma.runAsSuperAdmin((tx) =>
    tx.user.create({ data: { email: SUPER.email, passwordHash, role: 'SUPER_ADMIN', tenantId: null } }),
  );
  a = await createClinic('pub-a');
  b = await createClinic('pub-b');
}, 180_000);

afterAll(async () => {
  await t?.close();
  await db?.stop();
});

describe('US-5 / US-6 patient join and ticket page', () => {
  it('lists active service points of a clinic by slug without any login', async () => {
    const res = await t.http.get(`/api/v1/public/c/${a.slug}/service-points`);
    expect(res.status).toBe(200);
    expect(res.body.servicePoints).toEqual([expect.objectContaining({ code: 'desk', name: 'Desk' })]);
    expect((await t.http.get('/api/v1/public/c/no-such-clinic/service-points')).status).toBe(404);
  });

  it('a patient joins, gets a token, and sees people ahead shrink as staff call', async () => {
    const first = await join(a, 'One', { phone: '+639171234567' });
    const second = await join(a, 'Two');
    expect(first.status).toBe(201);
    const tok = second.body.accessToken as string;

    let status = await t.http.get(`/api/v1/public/t/${tok}`);
    expect(status.body).toMatchObject({ status: 'WAITING', peopleAhead: 1, nowServing: null });
    expect(JSON.stringify(status.body)).not.toContain('639171234567'); // no one else's phone
    expect(status.body.accessToken).toBeUndefined();

    await t.http.post(`/api/v1/queue/${a.sp}/call-next`).set(bearer(a.staff)).set(key()).expect(200);
    status = await t.http.get(`/api/v1/public/t/${tok}`);
    expect(status.body).toMatchObject({ status: 'WAITING', peopleAhead: 0, nowServing: first.body.ticket.number });
  });

  it('a wrong or malformed token is 404, never data', async () => {
    expect((await t.http.get('/api/v1/public/t/' + 'x'.repeat(43))).status).toBe(404);
    expect((await t.http.get('/api/v1/public/t/short')).status).toBe(404);
  });

  it('no consent: 400 CONSENT_REQUIRED', async () => {
    const res = await t.http
      .post(`/api/v1/public/c/${b.slug}/service-points/desk/tickets`)
      .set(key())
      .send({ patientName: 'X', consent: false });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CONSENT_REQUIRED');
  });

  it('a ticket token opens only its own clinic ticket', async () => {
    const inB = await join(b, 'Bee');
    const view = await t.http.get(`/api/v1/public/t/${inB.body.accessToken}`);
    expect(view.status).toBe(200);
    expect(view.body.patientName).toBe('Bee');
    const queueA = await t.http.get(`/api/v1/queue/${a.sp}`).set(bearer(a.staff));
    expect(JSON.stringify(queueA.body)).not.toContain('Bee');
  });
});

describe('US-7 patient cancel', () => {
  it('cancels a waiting ticket once; a second cancel is INVALID_TRANSITION', async () => {
    const j = await join(a, 'Cancel Me');
    const tok = j.body.accessToken as string;
    const first = await t.http.post(`/api/v1/public/t/${tok}/cancel`);
    expect(first.status).toBe(200);
    expect(first.body.ticket.status).toBe('CANCELLED');
    const again = await t.http.post(`/api/v1/public/t/${tok}/cancel`);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVALID_TRANSITION');
  });
});

describe('US-16 TV display', () => {
  it('shows numbers only: now serving and next up, never names or phones', async () => {
    const res = await t.http.get(`/api/v1/public/c/${a.slug}/service-points/desk/display`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      clinic: 'Clinic pub-a',
      servicePoint: 'Desk',
      nowServing: expect.stringMatching(/^PB-\d{3}$/),
      nextUp: expect.any(Array),
    });
    expect(JSON.stringify(res.body)).not.toMatch(/One|Two|Cancel Me|6391/);
  });
});

describe('US-8 / INV-5 slots and booking', () => {
  it('lists slots with remaining capacity', async () => {
    const id = await makeSlot(a, 3);
    const res = await t.http.get(`/api/v1/public/c/${a.slug}/service-points/desk/slots`);
    expect(res.body.slots).toContainEqual(expect.objectContaining({ id, remaining: 3 }));
  });

  it('INV-5: many concurrent bookings of the last place -> exactly one succeeds, the rest SLOT_FULL', async () => {
    const slot = await makeSlot(a, 1);
    const results = await Promise.all(Array.from({ length: 25 }, (_, i) => book(a, slot, `P${i}`)));
    const ok = results.filter((r) => r.status === 201);
    const full = results.filter((r) => r.status === 409);
    expect(ok).toHaveLength(1);
    expect(full).toHaveLength(24);
    expect(full.every((r) => r.body.error.code === 'SLOT_FULL')).toBe(true);
    const row = await db.tenantPrisma.run(a.tenantId, (tx) => tx.slot.findUniqueOrThrow({ where: { id: slot } }));
    expect(row.bookedCount).toBe(1);
  });

  it('T-23: cancelling a booked ticket releases the slot so it can be booked again', async () => {
    const slot = await makeSlot(a, 1);
    const first = await book(a, slot);
    expect(first.status).toBe(201);
    expect((await book(a, slot)).body.error.code).toBe('SLOT_FULL');
    await t.http.post(`/api/v1/public/t/${first.body.accessToken}/cancel`).expect(200);
    const row = await db.tenantPrisma.run(a.tenantId, (tx) => tx.slot.findUniqueOrThrow({ where: { id: slot } }));
    expect(row.bookedCount).toBe(0);
    expect((await book(a, slot)).status).toBe(201);
  });

  it('a slot on another day cannot be booked, and another clinic cannot book it', async () => {
    const tomorrow = await makeSlot(a, 2, new Date(t.clock.now().getTime() + 48 * 3600_000));
    expect((await book(a, tomorrow)).status).toBe(400);
    const today = await makeSlot(a, 2);
    expect((await book(b, today)).status).toBe(404); // RLS: b cannot even see a's slot
  });

  it('only a Clinic Admin can create slots', async () => {
    const res = await t.http
      .post('/api/v1/slots')
      .set(bearer(a.staff))
      .send({ servicePointId: a.sp, startsAt: new Date().toISOString(), capacity: 2 });
    expect(res.status).toBe(403);
  });
});

describe('US-36 public write rate limit', () => {
  it('429 RATE_LIMITED after too many public writes from one IP', async () => {
    process.env.PUBLIC_WRITE_LIMIT = '3';
    const limited = await startTestApp(db);
    try {
      const post = () =>
        limited.http
          .post(`/api/v1/public/c/${a.slug}/service-points/desk/tickets`)
          .set(key())
          .send({ patientName: 'Spam', consent: true });
      const codes: number[] = [];
      for (let i = 0; i < 5; i++) codes.push((await post()).status);
      expect(codes).toEqual([201, 201, 201, 429, 429]);
    } finally {
      await limited.close();
      process.env.PUBLIC_WRITE_LIMIT = '1000';
    }
  });
});
