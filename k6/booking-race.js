// T-15 / INV-5 / US-17: 200 concurrent patients try to book the LAST place of one slot.
// Pass = exactly 1 booking succeeds (201), the other 199 get 409 SLOT_FULL, nothing else, and the
// slot's booked count is 1 afterwards. HTTP-level race against the real stack (not mocked).
//
//   k6 run -e BASE_URL=http://localhost:3000 -e SLUG=k6clinic -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... k6/booking-race.js
// The API must run with a high PUBLIC_WRITE_LIMIT: all 200 requests come from one IP (see runbook).
import http from 'k6/http';
import { check, fail } from 'k6';
import { Counter } from 'k6/metrics';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const SLUG = __ENV.SLUG || 'demo-clinic';
const N = Number(__ENV.N || 200);
const json = { headers: { 'Content-Type': 'application/json' } };

const booked = new Counter('bookings_201');
const full = new Counter('bookings_slot_full_409');
const other = new Counter('bookings_unexpected');

export const options = {
  scenarios: { race: { executor: 'shared-iterations', vus: N, iterations: N, maxDuration: '60s' } },
  thresholds: {
    bookings_201: [`count==1`],
    bookings_slot_full_409: [`count==${N - 1}`],
    bookings_unexpected: ['count==0'],
  },
};

export function setup() {
  const login = http.post(
    `${BASE}/api/v1/auth/login`,
    JSON.stringify({ email: __ENV.ADMIN_EMAIL, password: __ENV.ADMIN_PASSWORD }),
    json,
  );
  if (login.status !== 200) fail(`admin login failed: ${login.status}`);
  const auth = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.json('accessToken')}` } };
  const points = http.get(`${BASE}/api/v1/service-points`, auth).json();
  const point = points.find((p) => p.isActive);
  const slot = http.post(
    `${BASE}/api/v1/slots`,
    JSON.stringify({ servicePointId: point.id, startsAt: new Date(Date.now() + 60000).toISOString(), capacity: 1 }),
    auth,
  );
  if (slot.status !== 201) fail(`slot create failed: ${slot.status} ${slot.body}`);
  return { slotId: slot.json('id'), auth };
}

export default function (data) {
  const res = http.post(
    `${BASE}/api/v1/public/c/${SLUG}/slots/${data.slotId}/book`,
    JSON.stringify({ patientName: `Racer ${__VU}`, consent: true }),
    { headers: { 'Content-Type': 'application/json', 'Idempotency-Key': uuidv4() } },
  );
  if (res.status === 201) booked.add(1);
  else if (res.status === 409 && res.json('error.code') === 'SLOT_FULL') full.add(1);
  else other.add(1);
}

export function teardown(data) {
  const slots = http.get(`${BASE}/api/v1/slots`, data.auth).json();
  const slot = slots.find((s) => s.id === data.slotId);
  check(slot, { 'slot booked_count is exactly 1': (s) => s && s.bookedCount === 1 });
  if (!slot || slot.bookedCount !== 1) fail(`booked_count is ${slot && slot.bookedCount}, expected 1`);
}
