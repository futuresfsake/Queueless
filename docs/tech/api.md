# API Spec (planned)

Status: Final v1.1 · Last updated: 2026-11-05

The authoritative spec will be generated from NestJS (Swagger/OpenAPI at `/docs`) once built. This file is the plan; update it if endpoints change.

## Conventions
- Base path `/api/v1`. JSON.
- Auth: `Authorization: Bearer <JWT>` for staff/admin. Public endpoints need none.
- Queue-changing endpoints require `Idempotency-Key: <uuid>`; missing → `400 IDEMPOTENCY_KEY_REQUIRED`.
- Same key + different body → `422 IDEMPOTENCY_KEY_REUSED`. Concurrent duplicates wait, then replay the first response (no error state; see ADR-004). Only successful results are stored; business errors roll back so a retry re-evaluates.
- Error shape: `{ "error": { "code", "message", "details" } }`.

## Auth
| Method | Path | Role | Story |
|---|---|---|---|
| POST | `/auth/login` | public | US-4 |
| GET | `/auth/me` | any | US-4 |

## Admin
| Method | Path | Role | Story |
|---|---|---|---|
| POST/GET | `/tenants` | SUPER_ADMIN | US-1 |
| POST/GET/PATCH | `/users` | CLINIC_ADMIN | US-2 |
| POST/GET/PATCH | `/service-points` | CLINIC_ADMIN | US-3 |
| POST/GET | `/slots` | CLINIC_ADMIN | US-8 |
| GET | `/events?ticketId=&servicePointId=` | CLINIC_ADMIN | US-20 |

## Staff queue
| Method | Path | Role | Story |
|---|---|---|---|
| GET | `/queue/:servicePointId` | STAFF+ | US-9 |
| POST | `/queue/:servicePointId/call-next` | STAFF+ | US-10 |
| POST | `/tickets/:id/start` | STAFF+ | US-11 |
| POST | `/tickets/:id/complete` | STAFF+ | US-12 |
| POST | `/tickets/:id/no-show` | STAFF+ | US-13 |
| POST | `/tickets/:id/skip` | STAFF+ | US-14 |
| POST | `/tickets/:id/cancel` | STAFF+ | US-7 |
| POST | `/queue/:servicePointId/tickets` (walk-in by staff) | STAFF+ | US-5 |

`call-next` responses: `200 { ticket }`, or `409 QUEUE_EMPTY` (decision D-2, final).

## Public (patient / TV)
| Method | Path | Notes | Story |
|---|---|---|---|
| GET | `/public/c/:tenantSlug/service-points` | list active service points | US-5 |
| POST | `/public/c/:tenantSlug/service-points/:code/tickets` | body: `{ patientName, phone?, consent: true }` → `{ ticket, accessToken }` | US-5 |
| GET | `/public/c/:tenantSlug/slots?servicePointCode=&date=` | open slots with remaining capacity | US-8 |
| POST | `/public/c/:tenantSlug/slots/:slotId/book` | same body as above | US-8 |
| GET | `/public/t/:token` | ticket status + people ahead | US-6 |
| POST | `/public/t/:token/cancel` | | US-7 |
| GET | `/public/display/:servicePointId` | now serving + next few numbers (no names) | US-16 |

Rate limiting on all `/public` POSTs.

## System
| Method | Path | |
|---|---|---|
| GET | `/health` | API + DB status | US-22 |

## Socket.IO
| Event (server → client) | Room | Payload |
|---|---|---|
| `queue.updated` | `sp:{servicePointId}` | `{ servicePointId, version }` — client refetches snapshot |
| `ticket.updated` | `ticket:{ticketId}` | `{ ticketId, status, version }` |

Join: `join.servicePoint` (JWT or public display id), `join.ticket` (token).

## Error codes
`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`, `CONSENT_REQUIRED`, `QUEUE_EMPTY`, `INVALID_TRANSITION`, `SLOT_FULL`, `SERVICE_POINT_INACTIVE`, `IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_KEY_REUSED`, `RATE_LIMITED`, `QUEUE_FULL`, `TOO_MANY_ATTEMPTS`.

## Additions (v1.1)
| Method | Path | Role | Story |
|---|---|---|---|
| GET | `/admin/audit` | CLINIC_ADMIN (own tenant) | US-33 — runs the invariant auditor, returns per-check results |
| GET | `/admin/audit/runs` | CLINIC_ADMIN | US-33 — stored runs |
| GET | `/admin/accuracy` | CLINIC_ADMIN | US-30 — estimate accuracy panel (post-MVP) |

Guest token validity: a ticket token works until 24 h after the ticket reaches a final state; after that `/public/t/:token` returns `404 NOT_FOUND`.
`POST /public/.../tickets` returns `409 QUEUE_FULL` when the service point has `max_waiting` WAITING tickets.
`POST /auth/login` returns `429 TOO_MANY_ATTEMPTS` after repeated failures (see security-privacy.md); failed logins always return the same generic `UNAUTHORIZED`.
