# Test Plan

Status: Final v1.1 · Last updated: 2026-11-05

## Principles
- Test against a **real Postgres** (Testcontainers) connected as the **non-owner app role**, so RLS is actually exercised.
- Every test cites a story or invariant ID.
- Report only measured results. Simulated data is labeled simulated.

## Levels
| Level | Tool | Scope |
|---|---|---|
| Unit | Jest | Transition table, number formatting, idempotency hash, guards |
| Integration | Jest + Testcontainers | Services against real DB: RLS, locks, events, idempotency |
| Concurrency / load | k6 | HTTP-level races against the compose stack |
| E2E | Playwright | Post-MVP / if time |
| Chaos | Toxiproxy + scripts | Post-MVP |

## Test cases (MVP)
| ID | Case | Level | Covers |
|---|---|---|---|
| T-1 | Tenant A session cannot select/insert/update tenant B rows | Integration | INV-7, US-21 |
| T-2 | No `app.tenant_id` set → zero rows | Integration | INV-7 |
| T-3 | App role is not owner and does not bypass RLS | Integration | INV-7 |
| T-4 | Concurrent issue of N tickets → N unique numbers | Integration | INV-1 |
| T-5 | Invalid transitions return `INVALID_TRANSITION`, no event written | Unit + Integration | INV-2 |
| T-6 | Final states have no exits (table-driven over all pairs) | Unit | INV-2 |
| T-7 | 3 parallel call-next → 3 distinct tickets | Integration + k6 | INV-3, US-18 |
| T-8 | Call-next on empty queue → `QUEUE_EMPTY` | Integration | US-10 |
| T-9 | Same Idempotency-Key twice → one effect, same response | Integration | INV-4, US-19 |
| T-10 | Same key, different body → `IDEMPOTENCY_KEY_REUSED` | Integration | INV-4 |
| T-11 | Two simultaneous requests with the same key → exactly one effect; the second waits, then replays the first response | Integration | INV-4 |
| T-12 | UPDATE/DELETE on `queue_events` fails | Integration | INV-6 |
| T-13 | Each transition writes exactly one event | Integration | INV-8, US-20 |
| T-14 | Replay events == `tickets.status` for all tickets | Integration | ADR-002 |
| T-15 | 200 concurrent bookings, capacity 1 → exactly 1 success, 199 `SLOT_FULL`, `booked_count = 1` | k6 | INV-5, US-17 |
| T-16 | Consent required to issue ticket | Integration | US-5 |
| T-17 | RBAC: STAFF cannot create users; CLINIC_ADMIN cannot access another tenant | Integration | US-2, US-4 |
| T-18 | Purge nulls patient name and phone older than 30 days; ticket number and events remain | Integration | INV-9, US-25 |
| T-19 | `/health` returns DB status | Integration | US-22 |
| T-20 | Call-next latency distribution recorded | k6 | NFR-2 |
| T-21 | Auditor passes on a clean database and after the k6 runs; each check fails (right ID) on deliberately corrupted data | Integration + CI | US-33 |
| T-22 | A failed request (e.g. `QUEUE_EMPTY`) is not stored; same key succeeds after the queue has a waiting ticket | Integration | INV-4, ADR-004 |
| T-23 | Cancelling a booked ticket releases the slot; `booked_count` correct under concurrent cancel + book | Integration | INV-5, D-29 |
| T-24 | Joining a full service point returns `QUEUE_FULL` | Integration | US-36 |
| T-25 | Login throttle returns `TOO_MANY_ATTEMPTS` after 5 failures; unknown user and wrong password are indistinguishable | Integration | US-36 |
| T-26 | Guest token stops working 24 h after the ticket is final (virtual Clock) | Integration | US-36 |

## CI
GitHub Actions on every push/PR: install → lint → typecheck → unit/integration (Testcontainers or service container) → build → k6 against compose stack (T-7, T-15) → **invariant auditor CLI against the post-k6 database (T-21; failure fails the build)**. Badge in README.

## Pre-submission checklist (Nov 13)
- [ ] CI green on `main`
- [ ] T-1..T-19 pass
- [ ] k6 T-15 and T-7 results recorded in [validation-results](validation-results.md)
- [ ] `docker compose up` works from a clean clone
- [ ] Live demo reachable; demo accounts work
- [ ] README: no claim without a measured result
- [ ] Demo video recorded
