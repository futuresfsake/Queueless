/**
 * Invariant auditor checks (docs/tech/invariant-auditor.md). Each check is plain SQL that returns
 * one row per violation, with a `ref` column that never holds a patient name or phone (ticket
 * numbers and slot ids only). Deliberately NOT built on the services: a bug in the code that
 * writes the data must not be able to hide itself from the code that checks it.
 *
 * Parameters: $1 = tenant id, $2 = window start (tickets issued before it are not examined).
 */
export interface AuditCheck {
  id: string;
  title: string;
  invariant: string;
  sql: string;
}

// Status a ticket must have after its last event (ADR-002: queue state is a projection of the log).
const EVENT_TO_STATUS = `(CASE e.type::text
    WHEN 'TICKET_ISSUED' THEN 'WAITING' WHEN 'CALLED' THEN 'CALLED' WHEN 'STARTED' THEN 'SERVING'
    WHEN 'SERVED' THEN 'SERVED' WHEN 'SKIPPED' THEN 'SKIPPED' WHEN 'NO_SHOW' THEN 'NO_SHOW'
    WHEN 'CANCELLED' THEN 'CANCELLED' ELSE 'UNKNOWN' END)`;

export const TENANT_CHECKS: AuditCheck[] = [
  {
    id: 'A-1',
    title: 'No duplicate ticket numbers per service point per day',
    invariant: 'INV-1',
    sql: `SELECT t.number AS ref
          FROM tickets t
          WHERE t.tenant_id = $1::uuid AND t.issued_at >= $2::timestamptz
          GROUP BY t.service_point_id, t.queue_date, t.seq, t.number
          HAVING count(*) > 1`,
  },
  {
    id: 'A-2',
    title: 'Every ticket status equals the status replayed from its events',
    invariant: 'INV-8 / ADR-002',
    sql: `SELECT t.number AS ref
          FROM tickets t
          LEFT JOIN LATERAL (
            SELECT e.type, ${EVENT_TO_STATUS} AS expected
            FROM queue_events e WHERE e.ticket_id = t.id ORDER BY e.id DESC LIMIT 1
          ) e ON true
          WHERE t.tenant_id = $1::uuid AND t.issued_at >= $2::timestamptz
            AND (e.expected IS NULL OR e.expected <> t.status::text)`,
  },
  {
    id: 'A-3',
    title: 'Events per ticket follow the state machine, start with TICKET_ISSUED, nothing follows a final state',
    invariant: 'INV-2',
    sql: `WITH ordered AS (
            SELECT e.ticket_id, e.type::text AS type,
                   lag(e.type::text) OVER (PARTITION BY e.ticket_id ORDER BY e.id) AS prev
            FROM queue_events e
            JOIN tickets t ON t.id = e.ticket_id
            WHERE t.tenant_id = $1::uuid AND t.issued_at >= $2::timestamptz
          )
          SELECT DISTINCT t.number AS ref
          FROM ordered o JOIN tickets t ON t.id = o.ticket_id
          WHERE (o.prev IS NULL AND o.type <> 'TICKET_ISSUED')
             OR (o.prev IS NOT NULL AND (o.prev, o.type) NOT IN (
                  ('TICKET_ISSUED','CALLED'), ('TICKET_ISSUED','CANCELLED'),
                  ('CALLED','STARTED'), ('CALLED','NO_SHOW'), ('CALLED','SKIPPED'), ('CALLED','CANCELLED'),
                  ('STARTED','SERVED')))`,
  },
  {
    id: 'A-4',
    title: 'Slot booked_count equals the non-cancelled tickets holding the slot, and never exceeds capacity',
    invariant: 'INV-5',
    sql: `SELECT s.id::text AS ref
          FROM slots s
          LEFT JOIN (
            SELECT slot_id, count(*) AS n FROM tickets
            WHERE tenant_id = $1::uuid AND slot_id IS NOT NULL AND status <> 'CANCELLED' GROUP BY slot_id
          ) h ON h.slot_id = s.id
          WHERE s.tenant_id = $1::uuid AND (s.booked_count <> coalesce(h.n, 0) OR s.booked_count > s.capacity)`,
  },
  {
    id: 'A-5',
    title: 'No ticket was called twice',
    invariant: 'INV-3',
    sql: `SELECT t.number AS ref
          FROM queue_events e JOIN tickets t ON t.id = e.ticket_id
          WHERE t.tenant_id = $1::uuid AND t.issued_at >= $2::timestamptz AND e.type = 'CALLED'
          GROUP BY t.id, t.number HAVING count(*) > 1`,
  },
  {
    id: 'A-7',
    title: 'No patient name or phone kept longer than 30 days',
    invariant: 'INV-9',
    sql: `SELECT t.number AS ref
          FROM tickets t
          WHERE t.tenant_id = $1::uuid AND t.issued_at < now() - interval '30 days'
            AND (t.phone IS NOT NULL OR t.patient_name IS NOT NULL)`,
  },
  {
    id: 'A-8',
    title: 'Every timestamped status change has exactly one event',
    invariant: 'INV-8',
    sql: `SELECT t.number AS ref
          FROM tickets t
          LEFT JOIN (
            SELECT ticket_id,
                   count(*) FILTER (WHERE type = 'CALLED') AS called,
                   count(*) FILTER (WHERE type = 'STARTED') AS started,
                   count(*) FILTER (WHERE type IN ('SERVED','NO_SHOW','SKIPPED','CANCELLED')) AS finished
            FROM queue_events WHERE tenant_id = $1::uuid GROUP BY ticket_id
          ) e ON e.ticket_id = t.id
          WHERE t.tenant_id = $1::uuid AND t.issued_at >= $2::timestamptz
            AND ( (t.called_at IS NOT NULL) <> (coalesce(e.called, 0) = 1) OR coalesce(e.called, 0) > 1
               OR (t.started_at IS NOT NULL) <> (coalesce(e.started, 0) = 1) OR coalesce(e.started, 0) > 1
               OR (t.completed_at IS NOT NULL) <> (coalesce(e.finished, 0) = 1) OR coalesce(e.finished, 0) > 1 )`,
  },
];

/** A-6 runs once per environment, not per tenant: it audits how the database is configured. */
export const SECURITY_CHECK = { id: 'A-6', title: 'Security posture of the database', invariant: 'INV-6 / INV-7' };

/** Tenant tables that must have row-level security enabled AND forced. */
export const RLS_TABLES = [
  'service_points',
  'slots',
  'ticket_counters',
  'tickets',
  'queue_events',
  'consents',
  'idempotency_keys',
  'audit_runs',
];
