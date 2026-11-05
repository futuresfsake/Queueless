# ADR-005: No Redis in the MVP

Status: Accepted · Date: 2026-11-05

## Context
The full design uses Redis for BullMQ (SMS outbox worker), the Socket.IO Redis adapter, caching, and SMS rate limits. The MVP has 9 days and no SMS.

## Decision
MVP runs a single API server with in-memory Socket.IO and in-memory throttling. Redis, BullMQ, and the adapter are added post-MVP together with the SMS outbox, or when running more than one server.

## Alternatives
- **Include Redis now:** more infra, more CI/deploy work, no MVP feature needs it.

## Consequences
+ Less to build, deploy, and debug before Nov 14.
+ State lives only in Postgres; API restarts are safe (clients reconnect and refetch).
− Cannot scale to multiple API instances yet (documented limitation).
− Throttling resets on restart (acceptable for demo).

Revisit: when starting US-26..28 (SMS) or multi-instance hosting.
