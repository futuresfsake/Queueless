# Product Requirements Document (PRD)

Status: Final v1.0 · Last updated: 2026-11-05

## 1. Problem
Patients in Philippine clinics and barangay health centers stand in line for hours with no idea when they will be served. Staff track queues on paper or shouting. Many patients have only basic phones and weak signal.

## 2. Product
**Queueless** is a multi-tenant, real-time queue and appointment system. Patients wait anywhere and are called by web (MVP) or SMS (post-MVP). Staff run the queue live; a TV shows "Now Serving".

## 3. Positioning (honest)
Queue systems are a very common IT capstone topic. The idea is not the differentiator. The differentiators are:
1. Proven correctness under concurrency and crashes (row locking, idempotency, event log).
2. Designing for Filipino users (SMS-first, basic phones, weak signal) — post-MVP.
3. Honest, measured validation (no invented numbers).

## 4. Users and roles
| Role | Who | Can do |
|---|---|---|
| Super Admin | Platform owner | Create/disable tenants, create first Clinic Admin |
| Clinic Admin | Clinic manager | Manage staff, service points, slots for own tenant; view event log |
| Staff | Nurse/receptionist | Operate the queue for service points of own tenant |
| Patient (guest) | Walk-in / booking patient | Join queue, book slot, view/cancel own ticket. No account. |
| TV display | Public screen | Read-only "Now Serving" for a service point |

## 5. Goals
- G1: A patient gets a ticket in under 30 seconds with only a name (phone optional) and consent.
- G2: Staff can call the next patient with one click; double clicks and simultaneous staff never skip or double-call a patient.
- G3: Updates reach the TV and the patient page without refresh.
- G4: Tenants can never see each other's data.
- G5: Every claim in the README is backed by a test or measurement.

## 6. MVP scope (Nov 14, 2026)
In:
- Multi-tenant setup, RLS, RBAC
- Service points with one queue each
- Walk-in ticket issuing (web), slot booking (web)
- Staff screen: live queue, call next, start, complete, no-show, skip
- TV display page
- Patient ticket page (live status, cancel)
- Append-only event log
- Idempotent, concurrency-safe call-next and booking
- Jest/Testcontainers tests, k6 concurrency test, GitHub Actions CI
- Docker Compose setup, deployed demo, README with validation table

Out of MVP (post-MVP, by Dec 1): two-way SMS + outbox, multi-stage visits, wait-time estimates, simulator + "Simulate busy morning" button, chaos tests, usability test, Redis/BullMQ.

## 7. Non-goals
Medical records, diagnoses, payments, native mobile apps.

## 8. Non-functional requirements
| ID | Requirement | Target |
|---|---|---|
| NFR-1 | Correctness | Invariants INV-1..INV-9 hold under concurrency (see schema doc) |
| NFR-2 | Latency | Call-next p95 — **TBD** (measure with k6; no target claimed until measured) |
| NFR-3 | Real-time | TV/patient update after staff click — **TBD** (measure) |
| NFR-4 | Privacy | Name/nickname + phone only; consent logged; phone purged after 30 days |
| NFR-5 | Setup | `docker compose up` starts the full stack |
| NFR-6 | Resilience | API restart does not lose or corrupt queue state (state is in Postgres) |

## 9. Success criteria
- k6: 200 concurrent bookings for 1 slot → exactly 1 success.
- k6: 3 simultaneous call-next → 3 different tickets.
- Replaying the same Idempotency-Key never produces a second effect.
- RLS test: a tenant-A session cannot read or write tenant-B rows.
- CI green on every push; live demo reachable.

## 10. Assumptions and limitations
- No real clinic has validated the workflow. **Not yet validated:** real clinic workflows and patient behavior.
- Single API server for MVP; horizontal scaling needs the Redis adapter (post-MVP).
- In a pilot we would measure: actual waits vs. estimates, no-show rate, SMS delivery rate.

## 11. Related docs
[user-stories](user-stories.md) · [app-flow](app-flow.md) · [TRD-HLD](../tech/TRD-HLD.md) · [schema](../tech/schema.md)
