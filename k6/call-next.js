// T-7 / T-20 / INV-3 / US-18: three staff desks press "Call next" at the same time, repeatedly.
// Pass = every call returns a different ticket (no patient called twice, none skipped), the queue
// ends with exactly as many CALLED tickets as successful calls, and latency is recorded (real numbers
// only; they depend on this machine, so the README states where it ran).
//
//   k6 run -e BASE_URL=http://localhost:3000 -e STAFF_EMAIL=... -e STAFF_PASSWORD=... k6/call-next.js
import http from 'k6/http';
import { check, fail } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const TICKETS = Number(__ENV.TICKETS || 90);
const DESKS = Number(__ENV.DESKS || 3);

const calledOk = new Counter('call_next_ok');
const unexpected = new Counter('call_next_unexpected');
const latency = new Trend('call_next_latency', true);

export const options = {
  scenarios: { desks: { executor: 'shared-iterations', vus: DESKS, iterations: TICKETS, maxDuration: '120s' } },
  thresholds: {
    call_next_ok: [`count==${TICKETS}`],
    call_next_unexpected: ['count==0'],
    call_next_latency: ['p(95)<2000'], // generous guard; the measured value is what gets recorded
  },
};

const seen = {}; // per VU: ticket ids this desk was handed

export function setup() {
  const login = http.post(
    `${BASE}/api/v1/auth/login`,
    JSON.stringify({ email: __ENV.STAFF_EMAIL, password: __ENV.STAFF_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (login.status !== 200) fail(`staff login failed: ${login.status}`);
  const token = login.json('accessToken');
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const points = http.get(`${BASE}/api/v1/service-points`, { headers: auth }).json();
  // A fresh queue for this run: use the last active service point (the seed makes two).
  const point = points.filter((p) => p.isActive).pop();
  const before = http.get(`${BASE}/api/v1/queue/${point.id}`, { headers: auth }).json('tickets');
  // Start from a clean slate: cancel anything still waiting from earlier runs.
  for (const t of before.filter((x) => x.status === 'WAITING')) {
    http.post(`${BASE}/api/v1/tickets/${t.id}/cancel`, '{}', { headers: { ...auth, 'Idempotency-Key': uuidv4() } });
  }
  const calledBefore = before.filter((x) => x.status === 'CALLED').length;
  for (let i = 0; i < TICKETS; i++) {
    const r = http.post(
      `${BASE}/api/v1/queue/${point.id}/tickets`,
      JSON.stringify({ patientName: `Load ${i}`, consent: true }),
      { headers: { ...auth, 'Idempotency-Key': uuidv4() } },
    );
    if (r.status !== 201) fail(`seeding ticket ${i} failed: ${r.status} ${r.body}`);
  }
  return { auth, pointId: point.id, calledBefore };
}

export default function (data) {
  const res = http.post(`${BASE}/api/v1/queue/${data.pointId}/call-next`, '{}', {
    headers: { ...data.auth, 'Idempotency-Key': uuidv4() },
  });
  latency.add(res.timings.duration);
  if (res.status !== 200) {
    unexpected.add(1);
    return;
  }
  const id = res.json('ticket.id');
  if (seen[id]) {
    unexpected.add(1); // the same desk was handed the same patient twice
    return;
  }
  seen[id] = true;
  calledOk.add(1);
}

export function teardown(data) {
  const tickets = http.get(`${BASE}/api/v1/queue/${data.pointId}`, { headers: data.auth }).json('tickets');
  const called = tickets.filter((t) => t.status === 'CALLED').length - data.calledBefore;
  const waiting = tickets.filter((t) => t.status === 'WAITING').length;
  // If two desks had been handed the same patient, CALLED would be lower than the number of calls.
  check(null, {
    'CALLED tickets == calls made (no duplicates across desks)': () => called === TICKETS,
    'no one left WAITING': () => waiting === 0,
  });
  if (called !== TICKETS || waiting !== 0) fail(`called=${called} expected ${TICKETS}, waiting=${waiting}`);
}
