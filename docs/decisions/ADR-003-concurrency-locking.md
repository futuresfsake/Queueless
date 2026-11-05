# ADR-003: Row locking for call-next and slot booking

Status: Accepted · Date: 2026-11-05

## Context
Multiple staff click "Call next" at once; many patients book the last slot at once. Read-then-write in app code causes races.

## Decision
- **Call next:** `SELECT ... WHERE status='WAITING' ORDER BY seq FOR UPDATE SKIP LOCKED LIMIT 1`, then update and insert event in the same transaction. Concurrent callers each lock a different row.
- **Booking:** `SELECT ... FROM slots WHERE id=$1 FOR UPDATE`, check capacity, increment. A CHECK (`booked_count <= capacity`) backs it up.
- **Ticket numbers:** `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` on `ticket_counters`, plus UNIQUE on (service point, day, seq).
- Default isolation level (READ COMMITTED) is sufficient with these explicit locks.

## Alternatives
- **Optimistic concurrency (version column + retry):** works but needs retry loops and wastes work under contention.
- **SERIALIZABLE isolation:** correct but needs retry handling for serialization failures.
- **Distributed lock in Redis:** adds infra and a failure mode; the database already coordinates.

## Consequences
+ Simple, provable with k6 (200 → 1; 3 → 3 distinct).
− Hot-row contention on a single slot (acceptable at clinic scale).
− `SKIP LOCKED` gives no strict global fairness under contention; ordering is by `seq` among unlocked rows (acceptable, documented).
