# Multi-Stage Visits (post-MVP)

Status: Final v1.0 · Last updated: 2026-11-05

Story: US-29. Window: Nov 19–21.

## 1. Goal
A patient's visit moves through ordered stages (e.g. Triage → Doctor → Pharmacy). Each stage is a service point with its own queue; staff transfer the patient forward with one action.

## 2. Data model additions
```
visit_flows        (id, tenant_id, name)
visit_flow_stages  (flow_id, position int, service_point_id)  PK (flow_id, position)
visits             (id, tenant_id, flow_id, patient_name, phone NULL, access_token UNIQUE, started_at, completed_at NULL)
tickets            + visit_id uuid NULL, + stage_position int NULL
```
- A ticket not belonging to a flow has `visit_id = NULL` (MVP behavior unchanged).
- The patient's guest link moves from the ticket token to the **visit** token (one link for the whole visit).
- RLS policies identical to other tenant tables.

## 3. Transfer
Staff action `POST /tickets/:id/transfer` (idempotency key required). In one transaction:
1. Guard: ticket is `SERVING` and a next stage exists.
2. Mark current ticket `TRANSFERRED` (new final state) + event `TRANSFERRED` (payload: next service point).
3. Issue a new `WAITING` ticket at the next stage's service point (counter upsert, new number, same `visit_id`, `stage_position+1`) + event `TICKET_ISSUED` (payload: `fromTicket`).
4. Commit, then emit sockets for both service points.
Last stage: normal `SERVED` completes the visit (`visits.completed_at`).

State machine change: `SERVING → TRANSFERRED` (final for that ticket). INV-2 still holds per ticket; add **INV-10: a visit has at most one non-final ticket at any time** (checked by test and by a partial unique index on `(visit_id) WHERE status IN ('WAITING','CALLED','SERVING')`).

## 4. Ordering
Transferred patients join the next queue by new sequence (FIFO by transfer time). No priority lanes in v1.

## 5. UI
- Staff screen: "Send to next stage" button when serving.
- Patient page: stage progress (e.g. 2 of 3), current number, ahead count.
- TV: per service point, unchanged.

## 6. SMS
One message per stage change; `dedupe_key = visit:<id>:stage:<n>:<template>`.

## 7. Tests
Transfer atomicity (kill between steps → either both or neither), INV-10 under concurrent double transfer (idempotency + partial unique index), last-stage completion, RLS on new tables, event replay rebuilds visit state.

## 8. Cut rule
If behind, ship transfer API + staff button only; skip patient progress UI.
