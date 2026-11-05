# ADR-002: Append-only event log as source of truth

Status: Accepted · Date: 2026-11-05

## Context
We need an audit trail, analytics, and the ability to verify and rebuild queue state. Overwriting status columns loses history.

## Decision
Every ticket change inserts a row into `queue_events` (append-only) in the same transaction as the `tickets` update. `tickets` is a projection for fast reads. Append-only is enforced by role grants (INSERT/SELECT only) and a trigger rejecting UPDATE/DELETE/TRUNCATE.

## Alternatives
- **State columns only:** simple but no history.
- **Full event sourcing (derive state only by replay):** purer, but slower to build and read; overkill for the timeline.

## Consequences
+ Audit trail, wait-time analytics, simulator verification, crash-consistency checks.
+ Test can replay events and compare with `tickets.status`.
− Two writes per change (kept atomic by the transaction).
− Projection and events must never diverge — guarded by one service method and tests (INV-8).
