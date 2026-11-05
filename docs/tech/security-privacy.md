# Security & Privacy

Status: Final v1.1 · Last updated: 2026-11-05

## 1. Data minimization (Data Privacy Act of 2012)
- Collected: name or nickname, optional phone number, ticket metadata.
- **Never collected:** symptoms, diagnoses, medical notes, government IDs. No such fields exist in the schema or API.
- Consent: checkbox required before issuing a ticket; logged in `consents` with text version and time.
- Retention: patient **name and phone** nulled 30 days after issue (INV-9); idempotency keys deleted after 24 h. Ticket numbers, timestamps, and events remain (no personal data).
- TV display shows ticket numbers only.
- Event payloads carry no names or phones.
- Patient rights: documented contact for deletion requests (README limitation: manual process in MVP).

## 2. Authentication & authorization
- Passwords hashed (argon2 or bcrypt); JWT access token, 8 h expiry, no refresh tokens in MVP (D-7); secret from env.
- `RolesGuard` on every controller; default deny.
- Staff can act only inside their tenant; tenant comes from the JWT, never from request body.
- Guest patient access via unguessable token (≥128-bit random) in the URL; token grants access to that one ticket only and **expires 24 h after the ticket reaches a final state**. The token is never logged (log the ticket id instead).
- Priority-lane requests store only the lane, never the reason (no disability or pregnancy data). See priority-lanes.md.

## 3. Tenant isolation (defense in depth)
1. Postgres RLS with FORCE and a non-owner app role (primary).
2. `TenantPrisma.run` sets `app.tenant_id` transaction-locally.
3. App code also filters by `tenantId` and validates that referenced IDs belong to the tenant.
4. Integration test: tenant A session reads/writes tenant B rows → zero rows / error.
5. Fail closed: unset tenant → no rows.

## 4. Threat model (MVP)
| Threat | Mitigation |
|---|---|
| Cross-tenant data leak | RLS + tests (INV-7) |
| Double-click / retry skips a patient | Idempotency keys (INV-4) |
| Race: two staff call same patient | `SKIP LOCKED` (INV-3) |
| Overbooking | Row lock + CHECK (INV-5) |
| Ticket spam from anonymous users | Per-service-point queue cap (`max_waiting`, default 200 → `QUEUE_FULL`), per-IP join cap (default 10/hour), throttling, consent |
| Credential stuffing / brute force on login | Throttle: 5 failed attempts per 15 min per email+IP → `429 TOO_MANY_ATTEMPTS`; same generic error for unknown user and wrong password; constant-time hash comparison |
| Guessing ticket tokens | 128-bit random tokens; rate limit on `/public/t` |
| Tampering with history | Append-only events (INV-6) |
| Secrets in repo | `.env` in `.gitignore`, `.env.example` only; CI secrets |
| SQL injection | Prisma parameterization; raw SQL only with bound params |
| XSS | React escaping; no `dangerouslySetInnerHTML`; patient names rendered as text |
| JWT theft | HTTPS only; short expiry |

## 5. Secrets and config
`.env.example` documents: `DATABASE_URL` (app role), `MIGRATION_DATABASE_URL` (owner role), `JWT_SECRET`, `CORS_ORIGINS`. Never commit real values.

## 6. Out of scope for MVP
Penetration testing, SMS abuse protection (post-MVP with Redis), formal DPO process. Listed as limitations in the README.

## Continuous verification (v1.1)
The security posture claims here are checked by the invariant auditor (A-6, A-7): RLS enabled and forced on all tenant tables, the app role is not an owner and cannot bypass RLS, `queue_events` is not updatable by the app role, and no personal data older than 30 days remains. See invariant-auditor.md.
