# Docs Index

Start here to find the right doc. Status: **Written** = exists, **Planned** = not yet written.

| Question | Doc | Status |
|---|---|---|
| Where are we right now? | [STATUS.md](STATUS.md) | Written |
| What does this term mean? | [glossary.md](glossary.md) | Written |
| What are we building and why? | `product/PRD.md` | Planned |
| What are the user stories and acceptance criteria? | `product/user-stories.md` | Planned |
| How do users move through screens? | `product/app-flow.md` | Planned |
| What is the architecture (HLD) and tech constraints (TRD)? | `tech/TRD-HLD.md` | Planned |
| What are the tables, constraints, RLS policies, locks? | `tech/schema.md` | Planned |
| What states can a ticket be in? | `tech/state-machine.md` | Planned |
| What are the endpoints and payloads? | `tech/api.md` (generated from Swagger) | Planned |
| How do we handle privacy and tenant isolation? | `tech/security-privacy.md` | Planned |
| What is the day-by-day plan? | `plan/milestones.md` | Planned |
| In what order do we build it? | `plan/implementation-plan.md` | Planned |
| What do we cut if behind? | `plan/risks-and-cuts.md` | Planned |
| Why did we decide X? | `decisions/ADR-*.md` | Planned |
| How do we test and what are the results? | `testing/test-plan.md`, `testing/validation-results.md` | Planned |
| How do we deploy and recover? | `ops/deployment-runbook.md` | Planned |
| What is the demo video script? | `ops/demo-script.md` | Planned |

## Conventions for docs
- Each doc starts with a status (Draft / Approved / Stale) and last-updated date.
- User stories use IDs (`US-1`), invariants use IDs (`INV-1`). Tests and commits reference them.
- Diagrams are Mermaid inside Markdown.
- When code and a doc disagree, update the doc in the same change.
