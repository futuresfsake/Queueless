# Docs Index

Start here to find the right doc. All docs are **Draft** until reviewed; each has its own status line.

| Question | Doc |
|---|---|
| Where are we right now? | [STATUS.md](STATUS.md) |
| What does this term mean? | [glossary.md](glossary.md) |
| How do we name, structure, commit, and test? | [conventions.md](conventions.md) |
| What are we building and why? | [product/PRD.md](product/PRD.md) |
| What are the user stories and acceptance criteria? | [product/user-stories.md](product/user-stories.md) |
| How do users move through screens? | [product/app-flow.md](product/app-flow.md) |
| What is the architecture (HLD) and tech constraints (TRD)? | [tech/TRD-HLD.md](tech/TRD-HLD.md) |
| What are the tables, constraints, RLS policies, locks, invariants? | [tech/schema.md](tech/schema.md) |
| What states can a ticket be in? | [tech/state-machine.md](tech/state-machine.md) |
| What are the endpoints and sockets? | [tech/api.md](tech/api.md) |
| Privacy, tenant isolation, threats? | [tech/security-privacy.md](tech/security-privacy.md) |
| What is the day-by-day plan? | [plan/milestones.md](plan/milestones.md) |
| What tasks, in what order? | [plan/implementation-plan.md](plan/implementation-plan.md) |
| What do we cut if behind? | [plan/risks-and-cuts.md](plan/risks-and-cuts.md) |
| Why did we decide X? | [decisions/](decisions/) — ADR-001 RLS, 002 event log, 003 locking, 004 idempotency, 005 no Redis |
| How do we test? | [testing/test-plan.md](testing/test-plan.md) |
| What are the measured results? | [testing/validation-results.md](testing/validation-results.md) |
| How do we deploy and recover? | [ops/deployment-runbook.md](ops/deployment-runbook.md) |
| What is the demo video script? | [ops/demo-script.md](ops/demo-script.md) |

## ID schemes
- Stories: `US-n` ([user-stories](product/user-stories.md))
- Invariants: `INV-n` ([schema](tech/schema.md))
- Tests: `T-n` ([test-plan](testing/test-plan.md))
- Risks: `R-n` ([risks-and-cuts](plan/risks-and-cuts.md))
- NFRs: `NFR-n` ([PRD](product/PRD.md))

## Conventions for docs
- Each doc starts with a status (Draft / Approved / Stale) and last-updated date.
- Diagrams are Mermaid inside Markdown.
- When code and a doc disagree, update the doc in the same change.
- Never put unmeasured numbers in docs; use `TBD`.
