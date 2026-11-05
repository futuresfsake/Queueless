# Invariant Auditor

Status: Final v1.1 · Last updated: 2026-11-05

Story: US-33. Window: M6 (Nov 11), alongside the k6 proof. Decision D-26.

## 1. Why this exists
Most queue projects claim correctness. This one **checks it, continuously, in the open**. The auditor is a set of read-only SQL checks that run against the real database and report pass/fail per invariant. It runs:
- on demand (admin "Integrity" panel and `GET /admin/audit`),
- nightly per tenant (stored in `audit_runs`),
- **in CI** after the k6 tests and (post-MVP) after every simulator and chaos run. A failing audit fails the build.

The demo shows it live: run the load test, then show the Integrity panel go green. After the chaos test (kill the API mid-run), show it still green.

## 2. Checks
| ID | Check | Invariant | How |
|---|---|---|---|
| A-1 | No duplicate ticket numbers per service point per day | INV-1 | `GROUP BY service_point_id, queue_date, seq HAVING count(*) > 1` returns 0 rows |
| A-2 | Every ticket's status equals the status replayed from its events | INV-8, ADR-002 | Last event per ticket (`DISTINCT ON`) mapped to a status == `tickets.status` |
| A-3 | Every consecutive event pair per ticket is an allowed transition; first event is `TICKET_ISSUED`; nothing follows a final state | INV-2 | Window `lag()` joined to the transition table |
| A-4 | `slots.booked_count` equals the number of non-cancelled tickets holding that slot, and ≤ capacity | INV-5 | Aggregate compare |
| A-5 | No ticket was `CALLED` twice | INV-3 | Count of `CALLED` events per ticket ≤ 1 |
| A-6 | Security posture: every tenant table has RLS enabled **and forced**; app role is not owner/superuser and has no `BYPASSRLS`; app role lacks UPDATE/DELETE on `queue_events`; the append-only trigger exists | INV-6, INV-7 | `pg_class.relrowsecurity/relforcerowsecurity`, `pg_roles`, `has_table_privilege`, `pg_trigger` |
| A-7 | No patient name/phone older than 30 days | INV-9 | Count of tickets with `issued_at < now() - 30 days AND (phone IS NOT NULL OR patient_name IS NOT NULL)` is 0 |
| A-8 | Every status change in the audited window has exactly one event (events ≥ transitions implied by timestamps: `called_at`, `started_at`, `completed_at`) | INV-8 | Compare counts of non-null timestamps with event counts |

## 3. Output
```json
{ "tenantId": "…", "ranAt": "…", "trigger": "manual|nightly|ci", "passed": true,
  "checks": [ { "id": "A-1", "passed": true, "violations": 0, "sample": [] } ] }
```
Stored append-only in `audit_runs` (see schema). `sample` holds up to 5 offending IDs (ticket numbers only, no names).

## 4. UI
Admin page "Integrity": a badge ("8/8 checks passed · 10:42") and a table of checks with last result. A failing check shows its sample and links to the invariant doc.

## 5. Scope and honesty
- The auditor checks **internal consistency** of what the system recorded. Passing does not prove the system is correct against real-world events (e.g. a patient who walked away). README wording: "the integrity checks pass", never "the system is proven correct".
- A-6 is a configuration audit; it proves the database is set up as designed on the environment it runs against (so it also catches a production deploy that connects as the owner role).
- Checks are bounded (default: last 7 days) for speed; a full-history run is available on demand.

## 6. Implementation notes
- One `AuditService` with each check as a named SQL string + expected-empty assertion; pure SQL, no business logic reuse (so a bug in services cannot hide itself).
- Runs inside a tenant-scoped, **read-only** transaction (`SET TRANSACTION READ ONLY`).
- A-6 runs once per environment (platform level, not per tenant).
- CLI: `pnpm --filter api audit` exits non-zero on failure (used by CI).

## 7. Tests
Seed deliberately corrupted data in a test database (using the owner role to bypass guards) and assert each check fails with the right ID; assert a clean database passes; assert the auditor itself never writes except to `audit_runs`.

## 8. Cut rule
If behind: ship the CLI + CI step only (no UI, no nightly job).
