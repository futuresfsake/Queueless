# Docs Changelog

Docs are edited only with a dated entry here (or a new ADR).

## v1.2 — 2026-11-06 — Milestone restructure (foundation first)
Product-owner feedback: M0 should be the foundation (auth, database, third-party tools), not just docs.

- **M0 is now Foundation**, phases F1..F6: docs, scaffold, platform/third-party setup (new), database, auth & tenancy, hello-world deploy.
- Old M1 Scaffold and M2 Data & Auth fold into M0. Old M3..M8 renumbered M1..M6 (mapping at the bottom of `plan/milestones.md`).
- **Deploy gate moved earlier (D-32):** hello-world deploy with DB, app role and WebSockets is now the last step of M0 (end of Nov 7, hard stop Nov 8 morning) instead of Nov 8.
- Added a third-party/accounts checklist (Docker, Railway, Vercel, GitHub secrets/branch protection, k6, SMS lead-time items).
- Login throttle moved to F5 (with auth); `/health` DB check moved to F4.
- Updated references in decisions-log (D-4, D-13, D-22, new D-32), risks-and-cuts, invariant-auditor, deployment-runbook. Session log 2026-11-05 is historical and keeps the old numbering.

## v1.1 — 2026-11-05 — Senior review
A critical engineering review of v1.0. Defects fixed, gaps closed, and differentiators added.

### Defects fixed
1. **Idempotency design was inconsistent (ADR-004).** The `IN_PROGRESS` state and `409 REQUEST_IN_PROGRESS` error could never be observed: the key is inserted inside the same transaction as the effect, so a concurrent duplicate simply blocks on the unique index until the first transaction finishes, then replays the stored response (or runs itself if the first rolled back). Removed the dead state, error code, status column, and fixed test T-11. Also clarified that only *successful* results are stored; failures roll back so a retry re-evaluates.
2. **Privacy promise was incomplete (INV-9).** Only the phone number was purged after 30 days; the patient name was kept forever. Both are now cleared. `tickets.patient_name` is nullable.
3. **Cancelling a booked ticket never released its slot.** Cancellation now decrements `booked_count` under the slot lock (D-29); the auditor checks it.
4. **Queue spam and brute force were unaddressed.** Added per-service-point queue cap, per-IP join cap, login throttling, and guest-token expiry.
5. **Estimate ranges used an arbitrary ±15 %.** Ranges now start at a labeled assumption and become the tenant's *measured* error once enough tickets are scored.
6. **A subtle real-time pitfall was undocumented.** Event IDs are not commit-ordered, so a cursor-based "events after id N" stream can miss rows. Documented why clients refetch snapshots (D-15) instead.
7. **No stated capacity envelope.** Added an explicit, assumption-labeled scale envelope.
8. **Provisioning roles on a managed Postgres** was an unstated risk; added a provisioning step and fallback.

### Added
- `tech/invariant-auditor.md` — executable, continuously-run integrity checks (US-33, D-26).
- `tech/priority-lanes.md` — Philippine-specific senior/PWD/pregnant priority with a starvation guard (US-35, D-25).
- Decisions D-25..D-29; Cebuano-first localization plan (D-16 updated).
- Stories US-33..US-36; tests T-21..T-26.
- Schema: `audit_runs`, `service_points.max_waiting`; Prisma schema and initial migration regenerated (never applied to any database yet).
