# Milestones

Status: Final v1.2 · Last updated: 2026-11-06

Deadline: **Nov 14, 2026** (submit). Interviews Dec 1–7. Today: Nov 6 → 8 days.
Plan keeps **Nov 13 as buffer** and **Nov 14 for submission only**.

**Principle (v1.2):** M0 is the foundation. Nothing feature-shaped starts until the database, auth, third-party platforms, CI and a deployed hello-world are proven. Every later milestone builds on a base that already runs in production-like conditions.

| Day | Date | Milestone | Stories | Exit criteria |
|---|---|---|---|---|
| 1–3 | Thu Nov 5 – Sat Nov 7 | **M0 Foundation** (F1..F6, below) | US-1..4, 21, 22 | Docs final; scaffold + CI green; platform accounts ready; DB migrations applied and RLS proven by tests; login + RBAC working; hello-world deployed (API as app role + DB + WebSocket + web) |
| 4 | Sun Nov 8 | **M1 Queue core** | US-5, 7, 10..14, 19, 20 | Issue ticket, call-next with SKIP LOCKED, transitions, events, idempotency; Jest integration tests. (Also the slip day for M0 F6.) |
| 5 | Mon Nov 9 | **M2 Real-time + Staff UI** | US-9 | Socket.IO rooms, staff queue screen live, reconnect refetch |
| 6 | Tue Nov 10 | **M3 Patient + TV + Booking** | US-6, 8, 16, 17 | Patient ticket page, TV page, slot booking with lock, seed script (US-23) |
| 7 | Wed Nov 11 | **M4 Proof** | US-17, 18, 33, 36 | k6 tests (200 → 1 success; 3 call-next → 3 tickets), invariant auditor green after k6 (CLI in CI), CI runs tests, validation table filled with real results |
| 8 | Thu Nov 12 | **M5 Deploy + README** | — | Live demo URL (already deployed since M0 F6; this is the real app), demo accounts, README with architecture diagram and validation table |
| 9 | Fri Nov 13 | **M6 Demo + buffer** | — | 2–3 min demo video (incl. kill-server recovery), bug fixes, final checks |
| 10 | Sat Nov 14 | **Submit** | — | Application submitted. No new features. |

## M0 Foundation phases
| Phase | What | Status | Exit criteria |
|---|---|---|---|
| F1 Docs | PRD, TRD, schema, ADRs, plans, test plan | Done (v1.1) | Pushed, reviewed |
| F2 Scaffold | pnpm workspace, NestJS, React/Vite/Tailwind, Compose, CI | Done | CI green on `main` |
| F3 Platform & third-party | Docker Desktop running; Railway + Vercel accounts and projects; GitHub Actions secrets; k6 installed; SMS gateway lead-time items started (SIM/Semaphore account — used post-MVP, D-20) | **Next** | `docker compose up -d postgres` works; Railway Postgres reachable; Vercel project exists; `k6 version` runs |
| F4 Database | Apply init + RLS migrations as owner; set app role password; `TenantPrisma.run()`; injectable `Clock`; Testcontainers harness | Not started | Migrations apply cleanly; app role is non-owner/no-BYPASSRLS; T-1..T-3 pass |
| F5 Auth & tenancy | Login (JWT 8 h), `RolesGuard`, `@Roles()`, login throttle, tenants / users / service-points CRUD, minimal seed (Super Admin) | Not started | RBAC tests pass; cross-tenant access impossible via API |
| F6 Hello-world deploy (D-4 gate) | Deploy API + Postgres (Railway) and web (Vercel): migrations as owner, API as `queueless_app`, `/health` checks DB, a WebSocket echo, CORS | Not started | Live URL; A-6 posture check (`rolsuper`/`rolbypassrls` false/false) on the deployed app connection; WebSocket connects from the Vercel origin |

If F6 fails (role provisioning, WebSockets), apply the fallback in [risks-and-cuts](risks-and-cuts.md) R4/R9 on Nov 8 morning, before starting M1.

## Post-MVP (Nov 15 – Nov 30)
| Window | Milestone | Stories |
|---|---|---|
| Nov 15–18 | P1 Redis + BullMQ + SMS outbox | US-26..28 |
| Nov 19–21 | P2 Multi-stage visits | US-29 |
| Nov 22–24 | P3 Wait-time estimates + accuracy panel; priority lanes | US-30, US-35 |
| Nov 25–27 | P4 Simulator + "Simulate busy morning" | US-24 |
| Nov 28–30 | P5 Chaos tests (auditor must stay green), usability test, Cebuano patient page/SMS, README update | US-31, 32, 34 |

## Rules
- A milestone is done only when its exit criteria are verified, not when code is written.
- If a day slips, cut using [risks-and-cuts](risks-and-cuts.md); never cut M4 (the proof) or M0 (the foundation).
- Update [STATUS](../STATUS.md) every session.

## Interview window (Dec 1–7)
No new features. Refresh README with real results only, re-run CI and k6, verify demo link and accounts, rehearse. See [interview-notes](interview-notes.md).

## Post-MVP design docs
| Milestone | Design doc |
|---|---|
| P1 SMS | [sms-outbox-design](../tech/sms-outbox-design.md) |
| P2 Multi-stage | [multi-stage-visits](../tech/multi-stage-visits.md) |
| P3 Estimates | [wait-time-estimation](../tech/wait-time-estimation.md), [priority-lanes](../tech/priority-lanes.md) |
| M4 Proof | [invariant-auditor](../tech/invariant-auditor.md) |
| P4 Simulator | [simulator-spec](../testing/simulator-spec.md) |
| P5 Chaos | [chaos-test-plan](../testing/chaos-test-plan.md) |

Decision gates: hosting hello-world **end of Nov 7, hard stop Nov 8 morning** (D-4, moved up by D-32); SMS gateway inbound check **Nov 15** (D-20); feature freeze **Nov 13** (D-24).

Old → new numbering (v1.1 → v1.2): M1 Scaffold and M2 Data & Auth → M0 (F2, F4, F5); M3 → M1; M4 → M2; M5 → M3; M6 → M4; M7 → M5; M8 → M6.
