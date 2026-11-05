# ADR-004: Idempotency keys stored in Postgres

Status: Accepted (revised v1.1, 2026-11-05) · Date: 2026-11-05

## Context
Staff double-tap, networks retry, and users on weak signal resend requests. A repeated "Call next" must never skip a patient.

## Decision
Queue-changing endpoints require an `Idempotency-Key` header. The key row lives in the **same transaction** as the queue change:

1. `INSERT INTO idempotency_keys (tenant_id, key, endpoint, request_hash) ... ON CONFLICT (tenant_id, key) DO NOTHING`.
2. **Row inserted** → this request owns the key. Perform the action, then `UPDATE` the row with `response_status` and `response_body`. Commit.
3. **Conflict** → another transaction owns the key. Postgres makes our insert wait on the unique index until that transaction ends:
   - It **committed** → read the stored row. Same `request_hash` → return the stored response, no effect. Different hash → `422 IDEMPOTENCY_KEY_REUSED`.
   - It **rolled back** → our insert proceeds and we perform the action ourselves.
4. Only **successful** results are stored. A business error (e.g. `QUEUE_EMPTY`, `INVALID_TRANSITION`) rolls the transaction back, key included, so a retry with the same key re-evaluates against current state.
5. The client generates one key per user action and reuses it on retry. Keys are deleted after 24 h.

`request_hash` = SHA-256 of method + path + canonical JSON body.

## Why there is no `IN_PROGRESS` state
Because the key is inserted inside the transaction, no other session can ever *see* an in-progress row; it is invisible until commit, and concurrent duplicates block rather than observe it. An earlier draft had an `IN_PROGRESS` status and a `409 REQUEST_IN_PROGRESS` error; both were unreachable and were removed (CHANGELOG v1.1).

## Alternatives
- **Redis store:** faster, but adds infra and loses atomicity with the queue change.
- **No keys, rely on state guards:** guards prevent invalid transitions but not "call next twice" (two valid calls).
- **Separate transaction for the key:** reintroduces the gap where the effect happens but the key is not saved (or vice versa).

## Consequences
+ Atomic with the queue change: no state where the effect exists but the key doesn't.
+ Concurrent duplicates are handled by the database, not by app-level locking.
− A blocked duplicate holds a connection while it waits (bounded by the first request's duration; set a statement/lock timeout of a few seconds).
− Extra write per request; daily cleanup job.

## Tests
T-9 (replay), T-10 (key reuse with different body), T-11 (two simultaneous requests, same key → one effect, second replays), T-22 (failed request is not stored; same key succeeds after state changes).
