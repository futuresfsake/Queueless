# User Stories

Status: Final v1.0 · Last updated: 2026-11-05

Each story has an ID. Tests and commits reference these IDs. Priority: **P0** = must ship Nov 14, **P1** = ship if time, **PM** = post-MVP.

## Tenants and access
**US-1 (P0)** As a Super Admin, I create a clinic (tenant) and its first Clinic Admin.
- AC: tenant created with unique slug; admin can log in; admin sees only own tenant.

**US-2 (P0)** As a Clinic Admin, I create and deactivate Staff accounts.
- AC: staff belongs to my tenant; deactivated staff cannot log in.

**US-3 (P0)** As a Clinic Admin, I create service points (name, ticket prefix).
- AC: prefix unique per tenant; inactive service points reject new tickets.

**US-4 (P0)** As any user, I log in with email/password and get role-based access.
- AC: JWT; wrong role gets 403; no token gets 401.

## Patient
**US-5 (P0)** As a patient, I join a queue with a name/nickname (phone optional) after ticking consent.
- AC: consent required; ticket number like `A-023`; consent logged; no symptom/diagnosis fields exist.

**US-6 (P0)** As a patient, I see my ticket status and how many are ahead, updating live.
- AC: page opened via unguessable token link; updates without refresh; shows people ahead (count, not time estimate in MVP).

**US-7 (P0)** As a patient, I cancel my ticket while it is WAITING or CALLED.
- AC: becomes CANCELLED; event logged; cannot cancel after SERVING.

**US-8 (P0)** As a patient, I book an appointment slot.
- AC: slot shows remaining capacity; booking decrements atomically; full slot rejects with `SLOT_FULL`.

## Staff
**US-9 (P0)** As staff, I see the live queue of my service point.
- AC: waiting, called, serving lists; updates via Socket.IO; refetch after reconnect.

**US-10 (P0)** As staff, I click "Call next" to call the next waiting patient.
- AC: lowest sequence WAITING ticket becomes CALLED; event `CALLED`; empty queue returns `QUEUE_EMPTY`.

**US-11 (P0)** As staff, I mark a called patient as started (SERVING).

**US-12 (P0)** As staff, I mark a serving patient as SERVED.

**US-13 (P0)** As staff, I mark a called patient as NO_SHOW.

**US-14 (P1)** As staff, I SKIP a called patient (final state for MVP).

## TV
**US-16 (P0)** As a waiting-room screen, I show "Now Serving" for a service point.
- AC: public read-only URL per service point; updates live; no patient names (ticket numbers only).

## Correctness and quality
**US-17 (P0)** Booking is concurrency-safe: 200 concurrent bookings for 1 slot → exactly 1 success. (INV-5)

**US-18 (P0)** Call-next is concurrency-safe: 3 simultaneous calls → 3 different tickets. (INV-3)

**US-19 (P0)** Every queue-changing request is idempotent: same key → same response, one effect. (INV-4)

**US-20 (P0)** Every state change appends exactly one event in the same transaction. (INV-6, INV-8)

**US-21 (P0)** Tenant isolation is enforced by RLS and verified by a test. (INV-7)

**US-22 (P0)** `GET /health` reports API and DB status.

**US-23 (P0)** A seed script creates a demo tenant, accounts, service points, and slots.

**US-25 (P1)** Phone numbers older than 30 days are purged by a scheduled job. (INV-9)

## Post-MVP
**US-24 (PM)** "Simulate busy morning" demo button runs the simulator and reports results labeled as simulated.
**US-26 (PM)** Patient joins by SMS (`PILA BHC-LAHUG`) and receives a ticket reply.
**US-27 (PM)** Patient receives an SMS when their turn is near (outbox + worker).
**US-28 (PM)** Patient replies `CANCEL` to cancel by SMS.
**US-29 (PM)** Multi-stage visits: transfer a patient from Triage to Doctor to Pharmacy.
**US-30 (PM)** Wait-time estimate from weighted moving average; accuracy reported as average error in minutes.
**US-31 (PM)** Chaos tests: API/Redis restart and 2s lag keep state consistent.
**US-32 (PM)** 5-person usability test report.

## Traceability (fill as built)
| Story | Endpoint(s) | Test | Status |
|---|---|---|---|
| US-1..US-4 | `/auth/*`, `/tenants`, `/users` | TBD | Not started |
| US-5..US-8 | `/public/*` | TBD | Not started |
| US-9..US-14 | `/staff/*` | TBD | Not started |
| US-16 | `/public/display/:id` | TBD | Not started |
| US-17..US-21 | n/a | k6 + Jest | Not started |
