# k6 load and race tests

Run against a running API (dev or compose) that has the demo seed. Needs Docker or a local k6.

```
DEMO_PASSWORD=<12+ chars> DEMO_SLUG=k6clinic pnpm --filter @queueless/api seed:demo
PUBLIC_WRITE_LIMIT=100000 pnpm --filter @queueless/api dev      # one client IP, so lift the per-IP limit

docker run --rm -i -v "$PWD/k6:/k6" grafana/k6 run \
  -e BASE_URL=http://host.docker.internal:3000 -e SLUG=k6clinic \
  -e ADMIN_EMAIL=admin@k6clinic.example -e ADMIN_PASSWORD=<same> /k6/booking-race.js

docker run --rm -i -v "$PWD/k6:/k6" grafana/k6 run \
  -e BASE_URL=http://host.docker.internal:3000 \
  -e STAFF_EMAIL=staff@k6clinic.example -e STAFF_PASSWORD=<same> /k6/call-next.js
```

- `booking-race.js` (T-15): 200 concurrent bookings of 1 place; exactly 1 succeeds, 199 `SLOT_FULL`, `booked_count = 1`.
- `call-next.js` (T-7, T-20): 3 desks call 90 tickets concurrently; all distinct, none left waiting; prints latency.

Results and the conditions they were measured under: `docs/testing/validation-results.md`.
