# Queueless — Claude Working Guide

Read this first every session. Then read `docs/STATUS.md` (where we are) and use `docs/INDEX.md` to find the right doc.

## What this is
Multi-tenant, real-time queue and appointment system for clinics and barangay health centers (Philippines). Patients wait anywhere and get called by SMS or web. Staff manage the queue live; a TV shows "Now Serving".

Owner: Chelsea Colaljo (4th-year BSIT, USC Cebu). Portfolio project for the Steradium internship.

## Deadlines
- **Nov 14, 2026** — application deadline: submit the MVP.
- **Dec 1–7, 2026** — interviews: add post-MVP features before then.

## Stack
- Frontend: React + Vite + TypeScript, Tailwind, shadcn/ui, TanStack Query, Zustand, vite-plugin-pwa
- Backend: NestJS + TypeScript, Prisma, PostgreSQL 16, Socket.IO (single server for MVP), Zod (shared schemas)
- Testing: Jest, Testcontainers, Playwright, k6 (Toxiproxy for chaos, post-MVP)
- DevOps: Docker Compose, GitHub Actions
- **Post-MVP only:** Redis, BullMQ, `@socket.io/redis-adapter`, SMS gateway (httpSMS + Semaphore fallback), Python/pandas. Do NOT add these to the MVP.

## MVP scope (Nov 14)
Multi-tenant + RLS, RBAC, single queue per service point with real-time updates, staff screen, TV display, patient ticket page, concurrency-safe "Call next" (row locking + idempotency keys), append-only event log, k6 concurrency test, CI, deployed demo, strong README.

Non-goals: medical records, diagnoses, payments, native mobile apps.

## Non-negotiable rules
1. **Never invent metrics or results.** Use `TBD` placeholders. Label simulated data as simulated.
2. **Tenant isolation:** every tenant-scoped query runs inside the request transaction that calls `set_config('app.tenant_id', $1, true)`. The app connects as a non-owner DB role (owners bypass RLS). Tenant checks also exist in app code.
3. **Event log is the source of truth.** `queue_events` is append-only; current queue state is a rebuildable projection.
4. **Every staff action that changes the queue needs an idempotency key.** A double-tap must never skip a patient.
5. **Row locking** (`SELECT … FOR UPDATE`) for slot booking and "Call next".
6. **Privacy (Data Privacy Act 2012):** collect only a name/nickname and phone number. Never symptoms or diagnoses. Log consent. Phone numbers are deleted after 30 days.
7. **Docs and code stay in sync.** If code and a doc disagree, update the doc in the same change.

## How to work with Chelsea
- Act as a senior full-stack engineer: review and guide, don't just generate.
- Be honest when something is overengineered, common, or threatens the Nov 14 deadline.
- Explain the *why* behind design choices so she can defend them in interviews.
- Prefer production-grade patterns (tests, transactions, idempotency) over shortcuts.
- Prioritize what ships by Nov 14; cut everything else.

## Commands
_TBD — filled in when the project is scaffolded (install, dev, test, lint, `docker compose up`)._

## Docs
See `docs/INDEX.md`. Keep `docs/STATUS.md` updated at the end of each work session.
