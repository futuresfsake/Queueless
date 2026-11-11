import { randomUUID } from 'node:crypto';
import { startTestApp, TestApp } from './support/test-app';
import { startTestDb, TestDb } from './support/test-db';
import { statusAfter } from '../src/queue/ticket-state-machine';
import { lockNextWaitingTicket } from '../src/db/sql/queue.sql';

const SUPER = { email: 'root@queueless.test', password: 'super-admin-password-1' };
const PW = 'correct-horse-battery';

let db: TestDb;
let t: TestApp;

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const key = () => ({ 'Idempotency-Key': randomUUID() });

interface Clinic {
  tenantId: string;
  admin: string;
  staff: string;
  staffId: string;
}

async function createClinic(slug: string): Promise<Clinic> {
  const superToken = await t.tokenFor(SUPER.email, SUPER.password);
  const created = await t.http
    .post('/api/v1/tenants')
    .set(bearer(superToken))
    .send({ slug, name: slug, admin: { email: `admin@${slug}.test`, password: PW } });
  expect(created.status).toBe(201);
  const admin = await t.tokenFor(`admin@${slug}.test`, PW);
  const staffRes = await t.http
    .post('/api/v1/users')
    .set(bearer(admin))
    .send({ email: `staff@${slug}.test`, password: PW });
  expect(staffRes.status).toBe(201);
  return {
    tenantId: created.body.id,
    admin,
    staff: await t.tokenFor(`staff@${slug}.test`, PW),
    staffId: staffRes.body.id,
  };
}

let prefixCounter = 0;
async function createServicePoint(clinic: Clinic, opts: { maxWaiting?: number } = {}) {
  const n = prefixCounter++;
  const prefix = String.fromCharCode(65 + Math.floor(n / 26)) + String.fromCharCode(65 + (n % 26)); // AA, AB, ... (DB allows 1-3 letters)
  const res = await t.http
    .post('/api/v1/service-points')
    .set(bearer(clinic.admin))
    .send({ name: `Desk ${prefix}`, code: `desk-${prefix.toLowerCase()}`, prefix, ...opts });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

const join = (clinic: Clinic, sp: string, name = 'Juan', extra: object = {}) =>
  t.http
    .post(`/api/v1/queue/${sp}/tickets`)
    .set(bearer(clinic.staff))
    .set(key())
    .send({ patientName: name, consent: true, ...extra });

const callNext = (clinic: Clinic, sp: string, headers: Record<string, string> = key()) =>
  t.http.post(`/api/v1/queue/${sp}/call-next`).set(bearer(clinic.staff)).set(headers);

const act = (clinic: Clinic, ticketId: string, action: string, headers: Record<string, string> = key()) =>
  t.http.post(`/api/v1/tickets/${ticketId}/${action}`).set(bearer(clinic.staff)).set(headers);

const events = (clinic: Clinic, ticketId?: string) =>
  db.tenantPrisma.run(clinic.tenantId, (tx) =>
    tx.queueEvent.findMany({ where: ticketId ? { ticketId } : {}, orderBy: { id: 'asc' } }),
  );

let a: Clinic;
let b: Clinic;

beforeAll(async () => {
  db = await startTestDb();
  t = await startTestApp(db);
  const passwordHash = await t.passwords.hash(SUPER.password);
  await db.tenantPrisma.runAsSuperAdmin((tx) =>
    tx.user.create({ data: { email: SUPER.email, passwordHash, role: 'SUPER_ADMIN', tenantId: null } }),
  );
  a = await createClinic('clinic-a');
  b = await createClinic('clinic-b');
}, 180_000);

afterAll(async () => {
  await t?.close();
  await db?.stop();
});

describe('US-5 / T-16 issue ticket', () => {
  it('issues PREFIX-NNN, logs consent and a TICKET_ISSUED event, returns the guest token once', async () => {
    const sp = await createServicePoint(a);
    const res = await join(a, sp, 'Maria', { phone: '+639171234567' });
    expect(res.status).toBe(201);
    expect(res.body.ticket).toMatchObject({ number: expect.stringMatching(/^[A-Z]{2}-001$/), status: 'WAITING', seq: 1 });
    expect(res.body.accessToken.length).toBeGreaterThanOrEqual(43); // 256 bits, base64url

    const consents = await db.tenantPrisma.run(a.tenantId, (tx) =>
      tx.consent.findMany({ where: { ticketId: res.body.ticket.id } }),
    );
    expect(consents).toHaveLength(1);
    const evs = await events(a, res.body.ticket.id);
    expect(evs.map((e) => e.type)).toEqual(['TICKET_ISSUED']);
  });

  it('T-16: no consent -> CONSENT_REQUIRED and nothing is stored', async () => {
    const sp = await createServicePoint(a);
    for (const body of [{ patientName: 'X' }, { patientName: 'X', consent: false }]) {
      const res = await t.http.post(`/api/v1/queue/${sp}/tickets`).set(bearer(a.staff)).set(key()).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CONSENT_REQUIRED');
    }
    const count = await db.tenantPrisma.run(a.tenantId, (tx) => tx.ticket.count({ where: { servicePointId: sp } }));
    expect(count).toBe(0);
  });

  it('rejects an invalid phone number and unknown fields never reach the database', async () => {
    const sp = await createServicePoint(a);
    const bad = await join(a, sp, 'X', { phone: 'not-a-phone' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_FAILED');
    // Privacy rule 6: a symptom field is dropped, not stored.
    const ok = await join(a, sp, 'X', { symptoms: 'fever' });
    expect(ok.status).toBe(201);
    expect(JSON.stringify(ok.body)).not.toMatch(/fever|symptom/);
  });

  it('T-4 / INV-1: 20 concurrent joins -> 20 unique, gap-free numbers', async () => {
    const sp = await createServicePoint(a);
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => join(a, sp, `P${i}`)));
    expect(results.every((r) => r.status === 201)).toBe(true);
    const seqs = results.map((r) => r.body.ticket.seq).sort((x, y) => x - y);
    expect(seqs).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(new Set(results.map((r) => r.body.ticket.number)).size).toBe(20);
  });

  it('T-24 / US-36: a full queue returns QUEUE_FULL and burns no number', async () => {
    const sp = await createServicePoint(a, { maxWaiting: 2 });
    expect((await join(a, sp)).status).toBe(201);
    expect((await join(a, sp)).status).toBe(201);
    const full = await join(a, sp);
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe('QUEUE_FULL');

    // Free one place; the next number continues from 3 (the failed join rolled back its number).
    const first = (await callNext(a, sp)).body.ticket;
    expect((await act(a, first.id, 'cancel')).status).toBe(200);
    const next = await join(a, sp);
    expect(next.status).toBe(201);
    expect(next.body.ticket.seq).toBe(3);
  });

  it('T-24: concurrent joins can never exceed max_waiting', async () => {
    const sp = await createServicePoint(a, { maxWaiting: 3 });
    const results = await Promise.all(Array.from({ length: 8 }, () => join(a, sp)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.body?.error?.code === 'QUEUE_FULL')).toHaveLength(5);
  });

  it('an inactive service point refuses new tickets', async () => {
    const sp = await createServicePoint(a);
    await t.http.patch(`/api/v1/service-points/${sp}`).set(bearer(a.admin)).send({ isActive: false });
    const res = await join(a, sp);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SERVICE_POINT_INACTIVE');
  });
});

describe('US-10 / T-8 call next', () => {
  it('calls the lowest sequence first and records who called', async () => {
    const sp = await createServicePoint(a);
    await join(a, sp, 'first');
    await join(a, sp, 'second');
    const res = await callNext(a, sp);
    expect(res.status).toBe(200);
    expect(res.body.ticket).toMatchObject({ seq: 1, status: 'CALLED', version: 1, patientName: 'first' });
    expect(res.body.ticket.calledAt).toEqual(expect.any(String));
    const row = await db.tenantPrisma.run(a.tenantId, (tx) => tx.ticket.findUniqueOrThrow({ where: { id: res.body.ticket.id } }));
    expect(row.calledBy).toBe(a.staffId);
  });

  it('T-8: empty queue -> 409 QUEUE_EMPTY with the standard error body', async () => {
    const sp = await createServicePoint(a);
    const res = await callNext(a, sp);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: 'QUEUE_EMPTY', message: expect.any(String), details: {} } });
  });

  it('T-7 / INV-3 / US-18: 3 parallel call-next return 3 different tickets, in order', async () => {
    const sp = await createServicePoint(a);
    for (let i = 0; i < 5; i++) await join(a, sp, `P${i}`);
    const results = await Promise.all([callNext(a, sp), callNext(a, sp), callNext(a, sp)]);
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    const ids = results.map((r) => r.body.ticket.id);
    expect(new Set(ids).size).toBe(3);
    expect(results.map((r) => r.body.ticket.seq).sort()).toEqual([1, 2, 3]);
  });

  it('INV-3 / ADR-003: a row locked by another transaction is skipped, not waited on (deterministic overlap)', async () => {
    const sp = await createServicePoint(a);
    const first = (await join(a, sp, 'one')).body.ticket;
    const second = (await join(a, sp, 'two')).body.ticket;
    const queueDate = t.clock.localDate();
    const lock = (tx: Parameters<typeof lockNextWaitingTicket>[0]) =>
      lockNextWaitingTicket(tx, a.tenantId, sp, queueDate);

    // Transaction 1 locks the first ticket and stays open until we say so.
    let release!: () => void;
    const hold = new Promise<void>((resolve) => (release = resolve));
    let locked!: (id: string | undefined) => void;
    const firstLocked = new Promise<string | undefined>((resolve) => (locked = resolve));
    const tx1 = db.tenantPrisma.run(a.tenantId, async (tx) => {
      locked((await lock(tx))?.id);
      await hold;
    });
    expect(await firstLocked).toBe(first.id);

    // Transaction 2 runs while tx1 still holds the lock. With SKIP LOCKED it returns the next row
    // at once; without it, it would block until tx1 ends and this race would report 'BLOCKED'.
    const tx2 = db.tenantPrisma.run(a.tenantId, async (tx) => (await lock(tx))?.id);
    const outcome = await Promise.race([tx2, new Promise<string>((r) => setTimeout(() => r('BLOCKED'), 3000))]);
    release();
    await tx1;
    await tx2;
    expect(outcome).toBe(second.id);
  });

  it('T-7: more callers than waiting patients -> exactly N successes, the rest QUEUE_EMPTY', async () => {
    const sp = await createServicePoint(a);
    await join(a, sp);
    await join(a, sp);
    const results = await Promise.all(Array.from({ length: 6 }, () => callNext(a, sp)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(2);
    expect(results.filter((r) => r.body?.error?.code === 'QUEUE_EMPTY')).toHaveLength(4);
  });
});

describe('US-11..14 transitions and INV-2 / T-5 / T-13', () => {
  it('walks WAITING -> CALLED -> SERVING -> SERVED with exactly one event per change (INV-8)', async () => {
    const sp = await createServicePoint(a);
    const id = (await join(a, sp)).body.ticket.id;
    await callNext(a, sp);
    const started = await act(a, id, 'start');
    expect(started.body.ticket).toMatchObject({ status: 'SERVING', version: 2 });
    expect(started.body.ticket.startedAt).toEqual(expect.any(String));
    const served = await act(a, id, 'complete');
    expect(served.body.ticket).toMatchObject({ status: 'SERVED', version: 3 });
    expect(served.body.ticket.completedAt).toEqual(expect.any(String));

    const evs = await events(a, id);
    expect(evs.map((e) => e.type)).toEqual(['TICKET_ISSUED', 'CALLED', 'STARTED', 'SERVED']);
    expect(evs.slice(1).every((e) => e.actorKind === 'STAFF' && e.actorUserId === a.staffId)).toBe(true);
  });

  it.each([
    ['no-show', 'NO_SHOW'],
    ['skip', 'SKIPPED'],
    ['cancel', 'CANCELLED'],
  ])('a called ticket can %s', async (action, status) => {
    const sp = await createServicePoint(a);
    const id = (await join(a, sp)).body.ticket.id;
    await callNext(a, sp);
    const res = await act(a, id, action);
    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe(status);
  });

  it('a waiting ticket can be cancelled', async () => {
    const sp = await createServicePoint(a);
    const id = (await join(a, sp)).body.ticket.id;
    expect((await act(a, id, 'cancel')).body.ticket.status).toBe('CANCELLED');
  });

  it('T-5: an invalid transition returns INVALID_TRANSITION and writes no event', async () => {
    const sp = await createServicePoint(a);
    const id = (await join(a, sp)).body.ticket.id; // WAITING
    const before = (await events(a, id)).length;
    for (const action of ['start', 'complete', 'no-show', 'skip']) {
      const res = await act(a, id, action);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
    }
    expect((await events(a, id)).length).toBe(before);
    const row = await db.tenantPrisma.run(a.tenantId, (tx) => tx.ticket.findUniqueOrThrow({ where: { id } }));
    expect(row).toMatchObject({ status: 'WAITING', version: 0 });
  });

  it('T-6 / INV-2: a final ticket cannot be moved again', async () => {
    const sp = await createServicePoint(a);
    const id = (await join(a, sp)).body.ticket.id;
    await act(a, id, 'cancel');
    for (const action of ['start', 'complete', 'no-show', 'skip', 'cancel']) {
      expect((await act(a, id, action)).body.error.code).toBe('INVALID_TRANSITION');
    }
  });

  it('INV-2: two different keys racing to finish the same ticket -> exactly one wins', async () => {
    const sp = await createServicePoint(a);
    const id = (await join(a, sp)).body.ticket.id;
    await callNext(a, sp);
    const results = await Promise.all([act(a, id, 'no-show'), act(a, id, 'skip'), act(a, id, 'start')]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.body?.error?.code === 'INVALID_TRANSITION')).toHaveLength(2);
    const evs = await events(a, id);
    expect(evs).toHaveLength(3); // ISSUED, CALLED, and the one winner
  });

  it('an unknown ticket or action is not found / rejected', async () => {
    expect((await act(a, randomUUID(), 'start')).status).toBe(404);
    const sp = await createServicePoint(a);
    const id = (await join(a, sp)).body.ticket.id;
    expect((await act(a, id, 'explode')).status).toBe(400);
  });
});

describe('US-19 / INV-4 idempotency', () => {
  it('T-9: the same key twice -> one effect, identical response', async () => {
    const sp = await createServicePoint(a);
    await join(a, sp, 'one');
    await join(a, sp, 'two');
    const headers = key();
    const first = await callNext(a, sp, headers);
    const second = await callNext(a, sp, headers);
    expect(second.status).toBe(first.status);
    expect(second.body).toEqual(first.body);
    const called = await db.tenantPrisma.run(a.tenantId, (tx) =>
      tx.ticket.count({ where: { servicePointId: sp, status: 'CALLED' } }),
    );
    expect(called).toBe(1); // the double-tap did not skip a patient
  });

  it('T-9: a replayed join does not create a second ticket', async () => {
    const sp = await createServicePoint(a);
    const headers = key();
    const send = () => t.http.post(`/api/v1/queue/${sp}/tickets`).set(bearer(a.staff)).set(headers).send({ patientName: 'Ana', consent: true });
    const first = await send();
    const second = await send();
    expect(second.body).toEqual(first.body);
    const count = await db.tenantPrisma.run(a.tenantId, (tx) => tx.ticket.count({ where: { servicePointId: sp } }));
    expect(count).toBe(1);
  });

  it('T-9: a replayed transition is not applied twice', async () => {
    const sp = await createServicePoint(a);
    const id = (await join(a, sp)).body.ticket.id;
    await callNext(a, sp);
    const headers = key();
    const first = await act(a, id, 'start', headers);
    const second = await act(a, id, 'start', headers);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect((await events(a, id)).filter((e) => e.type === 'STARTED')).toHaveLength(1);
  });

  it('T-10: the same key with a different request -> 422 IDEMPOTENCY_KEY_REUSED', async () => {
    const sp = await createServicePoint(a);
    const sp2 = await createServicePoint(a);
    await join(a, sp);
    const headers = key();
    expect((await callNext(a, sp, headers)).status).toBe(200);
    const other = await callNext(a, sp2, headers);
    expect(other.status).toBe(422);
    expect(other.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');

    const jHeaders = key();
    const post = (name: string) =>
      t.http.post(`/api/v1/queue/${sp}/tickets`).set(bearer(a.staff)).set(jHeaders).send({ patientName: name, consent: true });
    expect((await post('A')).status).toBe(201);
    expect((await post('B')).status).toBe(422);
  });

  it('key order in the JSON body does not matter', async () => {
    const sp = await createServicePoint(a);
    const headers = key();
    const send = (body: object) => t.http.post(`/api/v1/queue/${sp}/tickets`).set(bearer(a.staff)).set(headers).send(body);
    const first = await send({ patientName: 'Z', consent: true });
    const second = await send({ consent: true, patientName: 'Z' });
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
  });

  it('T-11: two simultaneous requests with the same key -> exactly one effect', async () => {
    const sp = await createServicePoint(a);
    await join(a, sp, 'one');
    await join(a, sp, 'two');
    const headers = key();
    const [r1, r2] = await Promise.all([callNext(a, sp, headers), callNext(a, sp, headers)]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r2.body).toEqual(r1.body);
    const called = await db.tenantPrisma.run(a.tenantId, (tx) =>
      tx.ticket.count({ where: { servicePointId: sp, status: 'CALLED' } }),
    );
    expect(called).toBe(1);
  });

  it('T-22: a failed request is not stored; the same key works once the queue has someone', async () => {
    const sp = await createServicePoint(a);
    const headers = key();
    const empty = await callNext(a, sp, headers);
    expect(empty.body.error.code).toBe('QUEUE_EMPTY');
    await join(a, sp);
    const retry = await callNext(a, sp, headers);
    expect(retry.status).toBe(200);
    expect(retry.body.ticket.status).toBe('CALLED');
  });

  it('a missing Idempotency-Key -> 400 IDEMPOTENCY_KEY_REQUIRED on every queue-changing endpoint, with no effect', async () => {
    const sp = await createServicePoint(a);
    const id = (await join(a, sp)).body.ticket.id;
    const calls = [
      t.http.post(`/api/v1/queue/${sp}/tickets`).set(bearer(a.staff)).send({ patientName: 'X', consent: true }),
      t.http.post(`/api/v1/queue/${sp}/call-next`).set(bearer(a.staff)),
      t.http.post(`/api/v1/tickets/${id}/cancel`).set(bearer(a.staff)),
    ];
    for (const res of await Promise.all(calls)) {
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    }
    const row = await db.tenantPrisma.run(a.tenantId, (tx) => tx.ticket.findUniqueOrThrow({ where: { id } }));
    expect(row.status).toBe('WAITING');
  });
});

describe('ADR-002 / T-14 event log is the source of truth', () => {
  it('replaying queue_events reproduces tickets.status for every ticket', async () => {
    const sp = await createServicePoint(a);
    const ids: string[] = [];
    for (let i = 0; i < 8; i++) ids.push((await join(a, sp, `P${i}`)).body.ticket.id);
    for (let i = 0; i < 6; i++) await callNext(a, sp);
    await act(a, ids[0], 'start');
    await act(a, ids[0], 'complete');
    await act(a, ids[1], 'no-show');
    await act(a, ids[2], 'skip');
    await act(a, ids[3], 'cancel');
    await act(a, ids[4], 'start');
    await act(a, ids[7], 'cancel');
    await act(a, ids[5], 'complete'); // invalid, must not disturb the log

    const { tickets, evs } = await db.tenantPrisma.run(a.tenantId, async (tx) => ({
      tickets: await tx.ticket.findMany({ where: { servicePointId: sp } }),
      evs: await tx.queueEvent.findMany({ where: { servicePointId: sp }, orderBy: { id: 'asc' } }),
    }));
    expect(tickets).toHaveLength(8);
    for (const ticket of tickets) {
      const log = evs.filter((e) => e.ticketId === ticket.id);
      expect(statusAfter(log[log.length - 1].type)).toBe(ticket.status);
      expect(ticket.version).toBe(log.length - 1); // one version bump per transition
    }
  });
});

describe('US-9 staff queue view', () => {
  it('lists today\'s active tickets in order, without phone numbers or guest tokens', async () => {
    const sp = await createServicePoint(a);
    await join(a, sp, 'first', { phone: '09171234567' });
    const second = (await join(a, sp, 'second')).body.ticket.id;
    await callNext(a, sp);
    await act(a, second, 'cancel');
    const res = await t.http.get(`/api/v1/queue/${sp}`).set(bearer(a.staff));
    expect(res.status).toBe(200);
    expect(res.body.tickets.map((x: { patientName: string; status: string }) => [x.patientName, x.status])).toEqual([
      ['first', 'CALLED'],
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(/phone|accessToken|09171234567/);
  });

  it('T-17 / INV-7: another clinic cannot see or change this clinic\'s queue', async () => {
    const sp = await createServicePoint(a);
    const id = (await join(a, sp)).body.ticket.id;
    expect((await t.http.get(`/api/v1/queue/${sp}`).set(bearer(b.staff))).status).toBe(404);
    expect((await callNext(b, sp)).status).toBe(404);
    expect((await join(b, sp)).status).toBe(404);
    expect((await act(b, id, 'cancel')).status).toBe(404);
    const row = await db.tenantPrisma.run(a.tenantId, (tx) => tx.ticket.findUniqueOrThrow({ where: { id } }));
    expect(row.status).toBe('WAITING');
  });

  it('requires a login', async () => {
    const sp = await createServicePoint(a);
    expect((await t.http.get(`/api/v1/queue/${sp}`)).status).toBe(401);
    expect((await t.http.post(`/api/v1/queue/${sp}/call-next`).set(key())).status).toBe(401);
  });
});

describe('D-6 daily reset (virtual clock)', () => {
  it('numbers restart at 001 on the next clinic-local day', async () => {
    const sp = await createServicePoint(a);
    expect((await join(a, sp)).body.ticket.seq).toBe(1);
    expect((await join(a, sp)).body.ticket.seq).toBe(2);
    t.clock.advance(25 * 60 * 60 * 1000);
    const nextDay = await join(a, sp);
    expect(nextDay.body.ticket.seq).toBe(1);
    // Yesterday's waiting tickets are not in today's queue, and call-next does not pick them.
    expect((await callNext(a, sp)).body.ticket.id).toBe(nextDay.body.ticket.id);
  });
});
