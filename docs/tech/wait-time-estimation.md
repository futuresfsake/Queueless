# Wait-Time Estimation (post-MVP)

Status: Final v1.1 · Last updated: 2026-11-05

Story: US-30. Window: Nov 22–24. Decision D-21.

## 1. Method
For a service point, let `d₁…dₙ` be the most recent `n = 10` **service durations** (`started_at → completed_at`, minutes, status `SERVED` only), `dₙ` newest.

Weighted moving average with linear weights `wᵢ = i`:
```
wma = Σ(wᵢ · dᵢ) / Σ(wᵢ)
```
Fewer than 3 samples → fall back to a configured default (`DEFAULT_SERVICE_MIN`, initial 6 — an **assumption**, labeled as such in the UI/README).

Estimated wait for a ticket with `ahead` people before it:
```
active_staff = max(1, distinct called_by in last 30 minutes at this service point)
estimate_min = round(ahead * wma / active_staff)
```
Shown to patients as a **range**, never as a promise:
- Until the tenant has **≥ 50 scored tickets**: estimate ± 25 % — an *assumption*, labeled as such.
- After that: estimate ± the tenant's **measured MAE** for that service point (self-calibrating). A clinic whose estimates are bad gets honestly wide ranges.

## 2. Recording for accuracy
When a ticket is issued, store in the `TICKET_ISSUED` event payload: `{ estimateMin, wma, ahead, activeStaff, source: "default"|"measured" }`.

## 3. Accuracy metric
For each ticket that reached `CALLED`:
```
actual_wait_min = called_at − issued_at
abs_error_min   = |estimateMin − actual_wait_min|
MAE             = mean(abs_error_min)
```
Report MAE in minutes with **n** and the data origin: `SIMULATED` or `REAL`. Also report the baseline MAE of the naive estimate (`ahead × default`) so the improvement, if any, is honest. If the WMA is not better than the baseline, say so.

## 4. Known weaknesses (to state in README)
- Ignores that the person currently being served is partway through.
- Ignores no-shows and arrival bursts.
- Simulated accuracy depends on the simulator's assumptions and says nothing about real clinics.

## 5. Implementation notes
- Pure function `estimateWait(durations, ahead, activeStaff, defaults)` — unit-tested with fixed inputs.
- Computed on read (cheap at clinic scale); no cache needed.
- Uses the injected `Clock` (D-19).

## 6. Tests
Known-input WMA values; fallback under 3 samples; staff-count edge cases; MAE calculation; payload stored on issue.

## 7. Accuracy panel (v1.1)
Admin page "Estimate accuracy": MAE, baseline MAE, n, and a predicted-vs-actual scatter/binned chart per service point, labeled **REAL** or **SIMULATED** (tenant flag). If the estimator is worse than the baseline the panel says so. Endpoint: `GET /admin/accuracy`.
