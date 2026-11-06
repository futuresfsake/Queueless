import { JwtService } from '@nestjs/jwt';
import { startTestApp, TestApp } from './support/test-app';
import { startTestDb, TestDb } from './support/test-db';

const SUPER = { email: 'root@queueless.test', password: 'super-admin-password-1' };
const PW = 'correct-horse-battery';
const MIN = 60_000;

let db: TestDb;
let t: TestApp;
let superToken: string;

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function createTenant(slug: string, adminEmail: string) {
  const res = await t.http
    .post('/api/v1/tenants')
    .set(bearer(superToken))
    .send({ slug, name: slug.toUpperCase(), admin: { email: adminEmail, password: PW } });
  expect(res.status).toBe(201);
  return res.body as { id: string; slug: string; admin: { id: string; email: string } };
}

async function createStaff(adminToken: string, email: string) {
  const res = await t.http.post('/api/v1/users').set(bearer(adminToken)).send({ email, password: PW });
  expect(res.status).toBe(201);
  return res.body as { id: string; email: string };
}

let tenantA: Awaited<ReturnType<typeof createTenant>>;
let tenantB: Awaited<ReturnType<typeof createTenant>>;
let adminA: string;
let adminB: string;

beforeAll(async () => {
  db = await startTestDb();
  t = await startTestApp(db);

  // D-17: the Super Admin exists only through seeding, never through the API.
  const passwordHash = await t.passwords.hash(SUPER.password);
  await db.tenantPrisma.runAsSuperAdmin((tx) =>
    tx.user.create({ data: { email: SUPER.email, passwordHash, role: 'SUPER_ADMIN', tenantId: null } }),
  );
  superToken = await t.tokenFor(SUPER.email, SUPER.password);

  tenantA = await createTenant('clinic-a', 'admin@a.test');
  tenantB = await createTenant('clinic-b', 'admin@b.test');
  adminA = await t.tokenFor('admin@a.test', PW);
  adminB = await t.tokenFor('admin@b.test', PW);
}, 180_000);

beforeEach(() => {
  // Login throttling is per email/IP over 15 minutes; move the virtual clock so tests stay independent.
  t.clock.advance(16 * MIN);
});

afterAll(async () => {
  await t?.close();
  await db?.stop();
});

describe('US-4 login and sessions', () => {
  it('logs in and returns a token plus the user, never the password hash', async () => {
    const res = await t.login('admin@a.test', PW);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toEqual({
      id: tenantA.admin.id,
      email: 'admin@a.test',
      role: 'CLINIC_ADMIN',
      tenantId: tenantA.id,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|scrypt/);
  });

  it('email is case-insensitive', async () => {
    expect((await t.login('ADMIN@A.TEST', PW)).status).toBe(200);
  });

  it('GET /auth/me returns the caller; no token, garbage token or foreign-signed token are 401', async () => {
    const me = await t.http.get('/api/v1/auth/me').set(bearer(adminA));
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('admin@a.test');

    expect((await t.http.get('/api/v1/auth/me')).status).toBe(401);
    expect((await t.http.get('/api/v1/auth/me').set(bearer('not.a.jwt'))).status).toBe(401);

    const forged = new JwtService({ secret: 'some-other-secret' }).sign({
      sub: tenantA.admin.id,
      role: 'CLINIC_ADMIN',
      tenantId: tenantA.id,
    });
    expect((await t.http.get('/api/v1/auth/me').set(bearer(forged))).status).toBe(401);
  });

  it('a token whose claims no longer match the database is rejected (role/tenant tampering after issue)', async () => {
    const wrongTenant = new JwtService({ secret: process.env.JWT_SECRET }).sign({
      sub: tenantA.admin.id,
      role: 'CLINIC_ADMIN',
      tenantId: tenantB.id, // signed correctly, but not who this user is
    });
    expect((await t.http.get('/api/v1/auth/me').set(bearer(wrongTenant))).status).toBe(401);
  });

  it('T-25: wrong password and unknown email are indistinguishable', async () => {
    const wrong = await t.login('admin@a.test', 'wrong-password-123');
    const unknown = await t.login('nobody@a.test', 'wrong-password-123');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body.error.code).toBe('UNAUTHORIZED');
  });

  it('T-25 / US-36: 5 failures lock the email (429 TOO_MANY_ATTEMPTS), even for the right password, until 15 min pass', async () => {
    for (let i = 0; i < 5; i++) expect((await t.login('admin@b.test', 'bad-password-123')).status).toBe(401);

    const locked = await t.login('admin@b.test', PW);
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('TOO_MANY_ATTEMPTS');
    expect(locked.body.error.details.retryAfterSeconds).toBeGreaterThan(0);

    t.clock.advance(16 * MIN);
    expect((await t.login('admin@b.test', PW)).status).toBe(200);
  });

  it('T-25: unknown emails are throttled too, so lockout does not reveal which accounts exist', async () => {
    for (let i = 0; i < 5; i++) await t.login('ghost@a.test', 'bad-password-123');
    expect((await t.login('ghost@a.test', PW)).status).toBe(429);
  });

  it('errors share one shape: { error: { code, message, details } }', async () => {
    const res = await t.http.post('/api/v1/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'VALIDATION_FAILED', message: expect.any(String), details: { issues: expect.any(Array) } },
    });
  });

  it('default deny: a route with neither @Public nor @Roles is 401 anonymously and 403 even when logged in', async () => {
    expect((await t.http.get('/api/v1/__unmarked')).status).toBe(401);
    const res = await t.http.get('/api/v1/__unmarked').set(bearer(superToken));
    expect(res.status).toBe(403);
    expect(res.body.leaked).toBeUndefined();
  });

  it('US-22: /health stays public', async () => {
    const res = await t.http.get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.db).toBe('up');
  });
});

describe('US-1 tenants (Super Admin)', () => {
  it('creates a clinic with its first Clinic Admin, who can log in', async () => {
    const created = await createTenant('clinic-new', 'admin@new.test');
    expect(created.admin.email).toBe('admin@new.test');
    const login = await t.login('admin@new.test', PW);
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ role: 'CLINIC_ADMIN', tenantId: created.id });
  });

  it('lists clinics', async () => {
    const res = await t.http.get('/api/v1/tenants').set(bearer(superToken));
    expect(res.status).toBe(200);
    expect(res.body.map((x: { slug: string }) => x.slug)).toEqual(expect.arrayContaining(['clinic-a', 'clinic-b']));
  });

  it('duplicate slug is 409 CONFLICT', async () => {
    const res = await t.http
      .post('/api/v1/tenants')
      .set(bearer(superToken))
      .send({ slug: 'clinic-a', name: 'Dup', admin: { email: 'other@a.test', password: PW } });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('tenant + admin are all-or-nothing: a duplicate admin email leaves no orphan clinic', async () => {
    const res = await t.http
      .post('/api/v1/tenants')
      .set(bearer(superToken))
      .send({ slug: 'orphan-check', name: 'Orphan', admin: { email: 'admin@a.test', password: PW } });
    expect(res.status).toBe(409);
    const list = await t.http.get('/api/v1/tenants').set(bearer(superToken));
    expect(list.body.map((x: { slug: string }) => x.slug)).not.toContain('orphan-check');
  });

  it('validates input: bad slug and short password are 400 with issue paths', async () => {
    const res = await t.http
      .post('/api/v1/tenants')
      .set(bearer(superToken))
      .send({ slug: 'Bad Slug!', name: 'x', admin: { email: 'a@b.test', password: 'short' } });
    expect(res.status).toBe(400);
    const paths = res.body.error.details.issues.map((i: { path: string }) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['slug', 'admin.password']));
  });

  it('T-17: Clinic Admin and Staff cannot manage clinics', async () => {
    const staffEmail = `staff-${Date.now()}@a.test`;
    await createStaff(adminA, staffEmail);
    const staffToken = await t.tokenFor(staffEmail, PW);
    for (const token of [adminA, staffToken]) {
      expect((await t.http.get('/api/v1/tenants').set(bearer(token))).status).toBe(403);
      const post = await t.http
        .post('/api/v1/tenants')
        .set(bearer(token))
        .send({ slug: 'x-clinic', name: 'X', admin: { email: 'x@x.test', password: PW } });
      expect(post.status).toBe(403);
    }
  });
});

describe('US-2 users (Clinic Admin)', () => {
  it('creates STAFF in its own clinic; the staff member logs in as STAFF of that clinic', async () => {
    const staff = await createStaff(adminA, 'nurse1@a.test');
    expect(staff).not.toHaveProperty('passwordHash');
    const login = await t.login('nurse1@a.test', PW);
    expect(login.body.user).toMatchObject({ role: 'STAFF', tenantId: tenantA.id });
  });

  it('role and tenant in the body are ignored: always STAFF, always the caller\'s clinic', async () => {
    const res = await t.http
      .post('/api/v1/users')
      .set(bearer(adminA))
      .send({ email: 'sneaky@a.test', password: PW, role: 'SUPER_ADMIN', tenantId: tenantB.id });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('STAFF');
    const login = await t.login('sneaky@a.test', PW);
    expect(login.body.user.tenantId).toBe(tenantA.id);
  });

  it('T-17: STAFF cannot create or list users', async () => {
    await createStaff(adminA, 'nurse2@a.test');
    const staffToken = await t.tokenFor('nurse2@a.test', PW);
    expect((await t.http.post('/api/v1/users').set(bearer(staffToken)).send({ email: 'z@a.test', password: PW })).status).toBe(403);
    expect((await t.http.get('/api/v1/users').set(bearer(staffToken))).status).toBe(403);
  });

  it('T-17: Super Admin has no clinic, so the clinic user endpoints are 403', async () => {
    expect((await t.http.get('/api/v1/users').set(bearer(superToken))).status).toBe(403);
  });

  it('T-17 / US-21: a Clinic Admin sees only its own clinic\'s users and cannot touch another clinic\'s', async () => {
    const bStaff = await createStaff(adminB, 'nurse@b.test');

    const listA = await t.http.get('/api/v1/users').set(bearer(adminA));
    expect(listA.status).toBe(200);
    const emails = listA.body.map((u: { email: string }) => u.email);
    expect(emails).toContain('admin@a.test');
    expect(emails).not.toContain('nurse@b.test');

    const patch = await t.http.patch(`/api/v1/users/${bStaff.id}`).set(bearer(adminA)).send({ isActive: false });
    expect(patch.status).toBe(404);
    expect((await t.login('nurse@b.test', PW)).status).toBe(200); // untouched
  });

  it('deactivating staff blocks login AND kills their existing token immediately', async () => {
    const staff = await createStaff(adminA, 'leaver@a.test');
    const token = await t.tokenFor('leaver@a.test', PW);
    expect((await t.http.get('/api/v1/auth/me').set(bearer(token))).status).toBe(200);

    const off = await t.http.patch(`/api/v1/users/${staff.id}`).set(bearer(adminA)).send({ isActive: false });
    expect(off.status).toBe(200);
    expect(off.body.isActive).toBe(false);

    expect((await t.http.get('/api/v1/auth/me').set(bearer(token))).status).toBe(401);
    expect((await t.login('leaver@a.test', PW)).status).toBe(401);

    await t.http.patch(`/api/v1/users/${staff.id}`).set(bearer(adminA)).send({ isActive: true });
    expect((await t.login('leaver@a.test', PW)).status).toBe(200);
  });

  it('an admin can reset a staff password; the old one stops working', async () => {
    const staff = await createStaff(adminA, 'reset@a.test');
    const res = await t.http
      .patch(`/api/v1/users/${staff.id}`)
      .set(bearer(adminA))
      .send({ password: 'brand-new-password-9' });
    expect(res.status).toBe(200);
    expect((await t.login('reset@a.test', PW)).status).toBe(401);
    expect((await t.login('reset@a.test', 'brand-new-password-9')).status).toBe(200);
  });

  it('only STAFF accounts are manageable (an admin cannot deactivate admins, including themselves)', async () => {
    const res = await t.http
      .patch(`/api/v1/users/${tenantA.admin.id}`)
      .set(bearer(adminA))
      .send({ isActive: false });
    expect(res.status).toBe(403);
    expect((await t.http.get('/api/v1/auth/me').set(bearer(adminA))).status).toBe(200);
  });

  it('validates: duplicate email 409, short password 400, empty patch 400, non-UUID id 400', async () => {
    await createStaff(adminA, 'dupe@a.test');
    const dupe = await t.http.post('/api/v1/users').set(bearer(adminA)).send({ email: 'dupe@a.test', password: PW });
    expect(dupe.status).toBe(409);
    const weak = await t.http.post('/api/v1/users').set(bearer(adminA)).send({ email: 'w@a.test', password: 'short' });
    expect(weak.status).toBe(400);
    const staff = await createStaff(adminA, 'empty@a.test');
    expect((await t.http.patch(`/api/v1/users/${staff.id}`).set(bearer(adminA)).send({})).status).toBe(400);
    expect((await t.http.patch('/api/v1/users/not-a-uuid').set(bearer(adminA)).send({ isActive: false })).status).toBe(400);
  });

  it('a deactivated clinic cannot log in and its tokens stop working', async () => {
    const tenant = await createTenant('clinic-off', 'admin@off.test');
    const token = await t.tokenFor('admin@off.test', PW);
    const su = await db.superUser();
    try {
      await su.query('UPDATE tenants SET is_active = false WHERE id = $1', [tenant.id]);
    } finally {
      await su.end();
    }
    expect((await t.http.get('/api/v1/auth/me').set(bearer(token))).status).toBe(401);
    expect((await t.login('admin@off.test', PW)).status).toBe(401);
  });
});

describe('US-3 service points (Clinic Admin)', () => {
  it('creates, lists and updates service points; maxWaiting defaults to 200 (D-28)', async () => {
    const created = await t.http
      .post('/api/v1/service-points')
      .set(bearer(adminA))
      .send({ name: 'Triage', code: 'triage', prefix: 'T' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ code: 'triage', prefix: 'T', isActive: true, maxWaiting: 200 });

    const list = await t.http.get('/api/v1/service-points').set(bearer(adminA));
    expect(list.body.map((s: { code: string }) => s.code)).toContain('triage');

    const upd = await t.http
      .patch(`/api/v1/service-points/${created.body.id}`)
      .set(bearer(adminA))
      .send({ name: 'Triage Desk', isActive: false, maxWaiting: 50 });
    expect(upd.status).toBe(200);
    expect(upd.body).toMatchObject({ name: 'Triage Desk', isActive: false, maxWaiting: 50 });
  });

  it('STAFF can list service points but not create or change them', async () => {
    await createStaff(adminA, 'desk@a.test');
    const staffToken = await t.tokenFor('desk@a.test', PW);
    expect((await t.http.get('/api/v1/service-points').set(bearer(staffToken))).status).toBe(200);
    const post = await t.http
      .post('/api/v1/service-points')
      .set(bearer(staffToken))
      .send({ name: 'Nope', code: 'nope', prefix: 'N' });
    expect(post.status).toBe(403);
  });

  it('validates against the same rules as the DB CHECKs: prefix A-Z (1-3), code lowercase/digits/dash', async () => {
    const bad = await t.http
      .post('/api/v1/service-points')
      .set(bearer(adminA))
      .send({ name: 'Bad', code: 'Has Spaces', prefix: 'abcd' });
    expect(bad.status).toBe(400);
    const paths = bad.body.error.details.issues.map((i: { path: string }) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['code', 'prefix']));
  });

  it('duplicate code within a clinic is 409; the same code in another clinic is fine', async () => {
    const body = { name: 'Pharmacy', code: 'pharmacy', prefix: 'P' };
    expect((await t.http.post('/api/v1/service-points').set(bearer(adminA)).send(body)).status).toBe(201);
    expect((await t.http.post('/api/v1/service-points').set(bearer(adminA)).send(body)).status).toBe(409);
    expect((await t.http.post('/api/v1/service-points').set(bearer(adminB)).send(body)).status).toBe(201);
  });

  it('US-21: clinic B cannot see or modify clinic A\'s service points', async () => {
    const a = await t.http
      .post('/api/v1/service-points')
      .set(bearer(adminA))
      .send({ name: 'Lab', code: 'lab', prefix: 'L' });
    const listB = await t.http.get('/api/v1/service-points').set(bearer(adminB));
    expect(listB.body.map((s: { id: string }) => s.id)).not.toContain(a.body.id);
    const patch = await t.http
      .patch(`/api/v1/service-points/${a.body.id}`)
      .set(bearer(adminB))
      .send({ name: 'hijacked' });
    expect(patch.status).toBe(404);
  });

  it('Super Admin has no clinic, so service points are 403 for them', async () => {
    expect((await t.http.get('/api/v1/service-points').set(bearer(superToken))).status).toBe(403);
  });
});
