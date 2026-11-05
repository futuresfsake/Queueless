# Validation Results

Status: Draft · Last updated: 2026-11-05

**Rule: never fake usage numbers.** Fill the Result column only with what was actually measured. Label simulated data as simulated.

| What | How | Result | Date | Evidence |
|---|---|---|---|---|
| No double-booking | k6: 200 concurrent requests, 1 slot | TBD | — | — |
| No skipped/duplicate calls | 3 simultaneous call-next (k6) | TBD | — | — |
| Idempotent retries | Replay same key | TBD | — | — |
| Tenant isolation | Integration tests T-1..T-3 | TBD | — | — |
| Crash recovery (API restarted mid-run) | Manual / script | TBD | — | — |
| Call-next latency (p95) | k6 | TBD | — | — |
| TV update delay after click | Measured in browser | TBD | — | — |
| Simulated day (3 staff) — **simulated** | Simulator (post-MVP) | TBD | — | — |
| Wait-time estimate error — **simulated** | Simulator (post-MVP) | TBD | — | — |
| Usability | 5 testers, 3 tasks (post-MVP) | TBD | — | — |

## Not yet validated
Real clinic workflows and patient behavior.

## In a pilot I would measure
Actual waits vs. estimates, no-show rate, SMS delivery rate.

## Assumptions (for simulator, post-MVP)
Listed here before running: arrival pattern (busier 8–10 am), mean service ~6 min with some long visits, ~12% no-shows, 3 staff calling at once. These are assumptions, not observations.
