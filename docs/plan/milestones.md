# Milestones

Status: Draft · Last updated: 2026-11-05

Deadline: **Nov 14, 2026** (submit). Interviews Dec 1–7. Today: Nov 5 → 9 days.
Plan keeps **Nov 13 as buffer** and **Nov 14 for submission only**.

| Day | Date | Milestone | Stories | Exit criteria |
|---|---|---|---|---|
| 1 | Thu Nov 5 | **M0 Docs** | — | Docs pushed to GitHub |
| 2 | Fri Nov 6 | **M1 Scaffold** | US-22 | Monorepo, Docker Compose (Postgres), API + web boot, `/health`, CI skeleton green |
| 3 | Sat Nov 7 | **M2 Data & Auth** | US-1..4, US-21 | Prisma schema + RLS migration, roles, `TenantPrisma`, login + RBAC, RLS isolation test passes |
| 4 | Sun Nov 8 | **M3 Queue core** | US-5, 7, 10..14, 19, 20 | Issue ticket, call-next with SKIP LOCKED, transitions, events, idempotency; Jest integration tests |
| 5 | Mon Nov 9 | **M4 Real-time + Staff UI** | US-9 | Socket.IO rooms, staff queue screen live, reconnect refetch |
| 6 | Tue Nov 10 | **M5 Patient + TV + Booking** | US-6, 8, 16, 17 | Patient ticket page, TV page, slot booking with lock, seed script (US-23) |
| 7 | Wed Nov 11 | **M6 Proof** | US-17, 18 | k6 tests (200 → 1 success; 3 call-next → 3 tickets), CI runs tests, validation table filled with real results |
| 8 | Thu Nov 12 | **M7 Deploy + README** | — | Live demo URL, demo accounts, README with architecture diagram and validation table |
| 9 | Fri Nov 13 | **M8 Demo + buffer** | — | 2–3 min demo video (incl. kill-server recovery), bug fixes, final checks |
| 10 | Sat Nov 14 | **Submit** | — | Application submitted. No new features. |

## Post-MVP (Nov 15 – Nov 30)
| Window | Milestone | Stories |
|---|---|---|
| Nov 15–18 | P1 Redis + BullMQ + SMS outbox | US-26..28 |
| Nov 19–21 | P2 Multi-stage visits | US-29 |
| Nov 22–24 | P3 Wait-time estimates + accuracy | US-30 |
| Nov 25–27 | P4 Simulator + "Simulate busy morning" | US-24 |
| Nov 28–30 | P5 Chaos tests, usability test, README update | US-31, 32 |

## Rules
- A milestone is done only when its exit criteria are verified, not when code is written.
- If a day slips, cut using [risks-and-cuts](risks-and-cuts.md); never cut M6 (the proof).
- Update [STATUS](../STATUS.md) every session.
