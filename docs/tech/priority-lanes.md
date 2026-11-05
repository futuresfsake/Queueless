# Priority Lanes (post-MVP)

Status: Final v1.1 · Last updated: 2026-11-05

Story: US-35. Window: Nov 22–24 (with wait-time estimates). Decision D-25.

## 1. Why
Philippine clinics routinely serve senior citizens, persons with disabilities, and pregnant patients first. Generic queue systems ignore this, so staff override the screen by hand and the "fair" queue becomes a lie. Modeling it explicitly is locally grounded and technically interesting (it breaks the simple `SKIP LOCKED` picture).

> Legal basis: priority treatment for senior citizens and PWDs is supported by Philippine law (e.g. RA 9994 and RA 7277); pregnant patients are customary practice. Verify the exact provisions before citing them in the README.

## 2. Model
- `tickets.lane` enum `REGULAR | PRIORITY`, default `REGULAR`.
- Patient may **request** priority at join ("Senior / PWD / pregnant — I will show proof at the desk"). The request sets `PRIORITY`; staff can change the lane at the desk (`LANE_CHANGED` event, actor recorded).
- **Data minimization:** the *category is never stored*, only the lane. No disability or pregnancy data (DPA 2012, see security-privacy.md).
- Per-service-point config: `lanes_enabled` (default off, so MVP behavior is unchanged) and `max_consecutive_priority` (default 2).

## 3. Call-next policy
Order: `PRIORITY` first, then `REGULAR`, FIFO by `seq` within a lane — **except** the starvation guard: after `max_consecutive_priority` priority calls in a row while regular patients wait, the next call is `REGULAR`.

### Concurrency (the interesting part)
`SKIP LOCKED` lets staff proceed in parallel because each pick is independent. The starvation guard needs a *global* view (how many priority calls just happened), so independent picks would race. Decision: when `lanes_enabled`, call-next first takes `pg_advisory_xact_lock(hashtext(service_point_id))`, which serializes **only the policy decision** per service point, then picks with `FOR UPDATE SKIP LOCKED` as before.
- INV-3 (no ticket called twice) still holds.
- Cost: one staff call at a time per service point (milliseconds). Acceptable at clinic scale; documented trade-off: correctness of the policy over parallelism.
- With lanes disabled, no advisory lock is taken.

The "last N calls" are read from `queue_events` (`CALLED` payload includes `lane`).

## 4. Events and state machine
No new ticket states. New event `LANE_CHANGED` (WAITING only). `TICKET_ISSUED` and `CALLED` payloads include `lane`. Replay (A-2) is unaffected because `LANE_CHANGED` does not change status; the auditor maps it as "status unchanged".

## 5. UI
- Join page: optional priority checkbox with short explanation.
- Staff screen: lane badge; "Move to priority / regular" action (WAITING).
- TV: no lane shown (ticket numbers only; avoids exposing who is priority).
- Patient page: ahead count is lane-aware.

## 6. Estimates
For `REGULAR` tickets the estimate ignores future priority arrivals (known weakness, stated in wait-time-estimation.md). `PRIORITY` estimate counts only priority tickets ahead.

## 7. Tests
- Priority called before regular; FIFO within each lane.
- Starvation guard: with 5 priority and 2 regular waiting, call order never exceeds the configured consecutive priority calls.
- 3 concurrent call-next with lanes enabled → 3 distinct tickets, policy order respected.
- Lane change writes one event and is idempotent.
- Lane disabled → behavior identical to MVP.

## 8. Cut rule
If behind: ship priority-first ordering without the starvation guard and document the limitation; do not ship the guard half-working.
