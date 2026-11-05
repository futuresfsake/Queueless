# Glossary

Status: Final v1.0 · Last updated: 2026-11-05

Use these terms consistently in docs, code, and SMS text.

| Term | Meaning |
|---|---|
| **Tenant** | One clinic or health center. All data is isolated per tenant. |
| **Service point** | A place where patients are served and called (e.g. Triage, Doctor, Pharmacy). Has its own queue. |
| **Visit flow** | The ordered stages of a visit (e.g. Triage → Doctor → Pharmacy). Post-MVP. |
| **Stage** | One step in a visit flow; each stage is its own queue. |
| **Ticket** | A patient's place in a queue, with a number like `A-023`. |
| **Queue event** | An append-only record of something that happened to a ticket (`TICKET_ISSUED`, `CALLED`, `SKIPPED`, `SERVED`, `NO_SHOW`, `CANCELLED`, `TRANSFERRED`). |
| **Projection** | The current queue state derived from the event log. Can be rebuilt from events. |
| **Call next** | Staff action that calls the next waiting ticket. Must be concurrency-safe and idempotent. |
| **Idempotency key** | A client-supplied key so repeating the same action returns the same result instead of acting twice. |
| **Row locking** | `SELECT … FOR UPDATE` to prevent two transactions changing the same row (double-booking, double-calling). |
| **RLS** | PostgreSQL row-level security. Policies restrict rows to the current tenant via `app.tenant_id`. |
| **Outbox** | Table of messages written in the same transaction as the queue change; a worker sends them later. Post-MVP. |
| **No-show** | A called patient who did not arrive in time. |
| **TV display** | Public screen showing "Now Serving". |
| **Guest patient** | A patient with no account, identified by ticket and phone number. |
| **Simulated data** | Data from the simulator. Always labeled as simulated, never presented as real usage. |
