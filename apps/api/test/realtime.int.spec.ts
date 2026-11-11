import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import { startTestApp, TestApp } from './support/test-app';
import { startTestDb, TestDb } from './support/test-db';

const SUPER = { email: 'root@queueless.test', password: 'super-admin-password-1' };
const PW = 'correct-horse-battery';

let db: TestDb;
let t: TestApp;
let url: string;
const sockets: Socket[] = [];

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function createClinic(slug: string) {
  const superToken = await t.tokenFor(SUPER.email, SUPER.password);
  const created = await t.http
    .post('/api/v1/tenants')
    .set(bearer(superToken))
    .send({ slug, name: slug, admin: { email: `admin@${slug}.test`, password: PW } });
  const admin = await t.tokenFor(`admin@${slug}.test`, PW);
  await t.http.post('/api/v1/users').set(bearer(admin)).send({ email: `staff@${slug}.test`, password: PW });
  const sp = await t.http
    .post('/api/v1/service-points')
    .set(bearer(admin))
    .send({ name: 'Desk', code: 'desk', prefix: 'RT' });
  return { tenantId: created.body.id as string, staff: await t.tokenFor(`staff@${slug}.test`, PW), sp: sp.body.id as string };
}

const connect = (token: string | undefined) => {
  const s = io(url, { transports: ['websocket'], auth: token ? { token } : {}, reconnection: false });
  sockets.push(s);
  return s;
};
const connected = (s: Socket) =>
  new Promise<void>((resolve, reject) => {
    s.on('connect', resolve);
    s.on('connect_error', reject);
  });
const subscribe = (s: Socket, servicePointId: string) =>
  new Promise<{ ok: boolean; code?: string }>((resolve) => s.emit('subscribe', { servicePointId }, resolve));
const nextEvent = (s: Socket, ms = 3000) =>
  new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no queue.changed received')), ms);
    s.once('queue.changed', (p) => {
      clearTimeout(timer);
      resolve(p);
    });
  });
const noEvent = (s: Socket, ms = 500) =>
  new Promise<void>((resolve, reject) => {
    const onEvent = () => reject(new Error('unexpected queue.changed'));
    s.once('queue.changed', onEvent);
    setTimeout(() => {
      s.off('queue.changed', onEvent);
      resolve();
    }, ms);
  });

let a: Awaited<ReturnType<typeof createClinic>>;
let b: Awaited<ReturnType<typeof createClinic>>;

beforeAll(async () => {
  db = await startTestDb();
  t = await startTestApp(db);
  await t.app.listen(0);
  url = `http://localhost:${(t.app.getHttpServer().address() as AddressInfo).port}`;
  const passwordHash = await t.passwords.hash(SUPER.password);
  await db.tenantPrisma.runAsSuperAdmin((tx) =>
    tx.user.create({ data: { email: SUPER.email, passwordHash, role: 'SUPER_ADMIN', tenantId: null } }),
  );
  a = await createClinic('rt-a');
  b = await createClinic('rt-b');
}, 180_000);

afterEach(() => {
  while (sockets.length) sockets.pop()!.close();
});

afterAll(async () => {
  await t?.close();
  await db?.stop();
});

describe('M2 staff real-time channel', () => {
  it('rejects a connection with a bad token', async () => {
    await expect(connected(connect('not-a-jwt'))).rejects.toThrow('UNAUTHORIZED');
  });

  it('an anonymous socket connects but cannot use the staff subscribe', async () => {
    const s = connect(undefined);
    await connected(s);
    expect(await subscribe(s, a.sp)).toEqual({ ok: false, code: 'FORBIDDEN' });
  });

  it('an anonymous socket can follow a public queue by slug and code and gets the signal', async () => {
    const s = connect(undefined);
    await connected(s);
    const ack = await new Promise((r) => s.emit('subscribe.public', { slug: 'rt-b', code: 'desk' }, r));
    expect(ack).toEqual({ ok: true });
    const changed = nextEvent(s);
    await t.http
      .post(`/api/v1/queue/${b.sp}/tickets`)
      .set(bearer(b.staff))
      .set('Idempotency-Key', randomUUID())
      .send({ patientName: 'Pub', consent: true })
      .expect(201);
    expect(await changed).toEqual({ servicePointId: b.sp });
    const other = await new Promise((r) => s.emit('subscribe.public', { slug: 'nope', code: 'desk' }, r));
    expect(other).toEqual({ ok: false, code: 'NOT_FOUND' });
  });

  it('pushes queue.changed to a subscribed staff socket after a ticket is issued and after call-next', async () => {
    const s = connect(a.staff);
    await connected(s);
    expect(await subscribe(s, a.sp)).toEqual({ ok: true });

    const issued = nextEvent(s);
    await t.http
      .post(`/api/v1/queue/${a.sp}/tickets`)
      .set(bearer(a.staff))
      .set('Idempotency-Key', randomUUID())
      .send({ patientName: 'Ana', consent: true })
      .expect(201);
    expect(await issued).toEqual({ servicePointId: a.sp });

    const called = nextEvent(s);
    await t.http
      .post(`/api/v1/queue/${a.sp}/call-next`)
      .set(bearer(a.staff))
      .set('Idempotency-Key', randomUUID())
      .expect(200);
    expect(await called).toEqual({ servicePointId: a.sp });
  });

  it('does not push when the request fails (nothing committed)', async () => {
    const s = connect(a.staff);
    await connected(s);
    await subscribe(s, a.sp);
    const quiet = noEvent(s);
    // Queue is empty after the previous test consumed the only ticket's WAITING state -> QUEUE_EMPTY.
    await t.http
      .post(`/api/v1/queue/${a.sp}/call-next`)
      .set(bearer(a.staff))
      .set('Idempotency-Key', randomUUID())
      .expect(409);
    await quiet;
  });

  it("a staff user cannot join another tenant's room and never receives its events", async () => {
    const s = connect(a.staff);
    await connected(s);
    expect(await subscribe(s, b.sp)).toEqual({ ok: false, code: 'NOT_FOUND' });
    const quiet = noEvent(s);
    await t.http
      .post(`/api/v1/queue/${b.sp}/tickets`)
      .set(bearer(b.staff))
      .set('Idempotency-Key', randomUUID())
      .send({ patientName: 'Ben', consent: true })
      .expect(201);
    await quiet;
  });

  it('rejects a malformed subscribe', async () => {
    const s = connect(a.staff);
    await connected(s);
    const res = await new Promise<{ ok: boolean; code?: string }>((resolve) => s.emit('subscribe', { servicePointId: 'x' }, resolve));
    expect(res).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
  });
});
