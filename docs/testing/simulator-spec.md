# Simulator Spec (post-MVP)

Status: Final v1.0 · Last updated: 2026-11-05

Story: US-24. Window: Nov 25–27. Everything the simulator produces is labeled **SIMULATED**.

## 1. Purpose
Exercise the real queue code with realistic load to check invariants and measure wait-estimate error — without pretending it is real clinic data.

## 2. Design
- `simulator/run-day.ts`; runs the real Nest services (or API) against a real Postgres.
- Uses a **virtual `Clock`** (D-19): a simulated 4-hour morning (8:00–12:00) runs in about 2 minutes of wall time. Time compression is a parameter.
- Deterministic: seeded PRNG (`--seed`); same seed → same arrivals and outcomes.

## 3. Assumptions (all printed in the output and README)
| Parameter | Default | Note |
|---|---|---|
| Arrivals | Poisson, rate higher 8–10 am | Assumption |
| Patients | ~1,000 over the day (configurable) | |
| Service time | Lognormal, mean ≈ 6 min, with a small share of long visits | Assumption |
| No-show | ~12 % of called patients | Assumption |
| Cancellations | ~3 % of waiting patients | Assumption |
| Staff | 3 calling concurrently, random think-time 0–5 s | Exercises INV-3 |
| Double-taps | ~2 % of staff actions retried with the same idempotency key | Exercises INV-4 |

## 4. Checks (against the event log and tickets)
1. Ticket numbers unique per service point per day (INV-1).
2. Every ticket ends in exactly one final state; none stuck (INV-2).
3. No ticket called twice; no skipped call caused by a retry (INV-3, INV-4).
4. Replaying events reproduces `tickets.status` (ADR-002).
5. `booked_count ≤ capacity` for all slots (INV-5).
6. Wait-estimate MAE and baseline MAE (see wait-time-estimation.md), with n.

Output: `simulator/out/<seed>.json` + human summary. Any failed check exits non-zero (usable in CI).

## 5. Demo button ("Simulate busy morning")
Admin-only endpoint runs a **shortened** run (e.g. 150 patients) into a dedicated `sim-demo` tenant, then shows results with a visible **SIMULATED** banner. It never writes into real/demo-clinic tenants.

## 6. Reporting rules
- Results go into `validation-results.md` with date, seed, parameters, commit SHA.
- No sentence implies real usage. README wording: "In a simulated day of N patients (seed S, assumptions listed), …".

## 7. Tests
Same seed ⇒ identical output hash; invariants hold for 5 different seeds; virtual clock never moves backwards.
