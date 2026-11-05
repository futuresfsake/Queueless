# Chaos Test Plan (post-MVP, one scenario also in MVP demo)

Status: Final v1.0 · Last updated: 2026-11-05

Story: US-31. Window: Nov 28–30. The "API restart" scenario (C-1) is also used in the MVP demo video.

## Method
Run the simulator (or a k6 load script) against the Docker Compose stack, inject the fault, then check invariants (INV-1..INV-10) and outbox counts. A scenario **passes** only if all checks pass; record actual results with date and commit. Failures are fixed or documented — never hidden.

| ID | Fault | Injection | Expected | Checks |
|---|---|---|---|---|
| C-1 | API restarted mid-run | `docker compose restart api` while load runs | In-flight requests may fail; retries with the same Idempotency-Key succeed once; clients reconnect and refetch | No lost/duplicate calls, replay == projection, outbox: 0 lost; duplicates **measured** |
| C-2 | Postgres restarted | `docker compose restart postgres` | API returns errors then recovers; no partial transitions | Transactions atomic: events count == status changes |
| C-3 | Redis restarted (after Redis added) | restart `redis` | Worker resumes; stuck `SENDING` rows recovered | 0 lost SMS; duplicates measured |
| C-4 | 2 s latency API→Postgres | Toxiproxy latency toxic | Slower but correct; no double-calls due to client timeouts + retries | INV-3, INV-4 hold; p95 recorded |
| C-5 | Client network drop | Toxiproxy on WebSocket / disable network in browser | UI shows reconnecting banner; refetch restores state | Screen state == server snapshot |
| C-6 | Duplicate/concurrent webhook | Replay the same inbound SMS 20× in parallel | One ticket created | `provider_message_id` dedupe |

## Setup
Toxiproxy container in a `docker-compose.chaos.yml` overlay; API `DATABASE_URL` points through the proxy for C-4. Scripts in `chaos/` (bash + k6). Each script prints a PASS/FAIL table and writes JSON for `validation-results.md`.

## Reporting
Table in README: scenario, fault, result (measured), date. Anything not run is "not run", never assumed.
