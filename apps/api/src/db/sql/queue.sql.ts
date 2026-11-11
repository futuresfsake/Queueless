import type { Tx } from '../tenant-prisma.service';

// Raw SQL for the queue (conventions.md: raw SQL lives here, each with the reason Prisma's
// query builder is not enough). All statements run inside TenantPrisma.run(), so RLS applies;
// the explicit tenant_id filters are the second, app-level layer (rule 2).

/**
 * INV-1: next ticket sequence for a service point and clinic-local day.
 *
 * Why raw: this must be ONE atomic statement. `INSERT ... ON CONFLICT DO UPDATE` takes the
 * counter row's lock, so concurrent issuers queue up and each gets a distinct value. Prisma's
 * upsert can fall back to SELECT-then-INSERT, which races.
 *
 * Side effect we rely on: the row lock is held until COMMIT, so everything the caller does
 * afterwards in the same transaction is serialized per service point per day.
 */
export async function nextTicketSeq(tx: Tx, tenantId: string, servicePointId: string, queueDate: string): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ last_seq: number }>>`
    INSERT INTO ticket_counters (service_point_id, queue_date, tenant_id, last_seq)
    VALUES (${servicePointId}::uuid, ${queueDate}::date, ${tenantId}::uuid, 1)
    ON CONFLICT (service_point_id, queue_date)
    DO UPDATE SET last_seq = ticket_counters.last_seq + 1
    RETURNING last_seq
  `;
  return rows[0].last_seq;
}

/**
 * INV-3 / ADR-003: pick and lock the next WAITING ticket.
 *
 * Why raw: Prisma has no `FOR UPDATE SKIP LOCKED`. With it, three staff pressing "Call next"
 * at once each lock a DIFFERENT row instead of waiting on (and then double-calling) the same one.
 */
export async function lockNextWaitingTicket(
  tx: Tx,
  tenantId: string,
  servicePointId: string,
  queueDate: string,
): Promise<{ id: string; slotId: string | null } | undefined> {
  const rows = await tx.$queryRaw<Array<{ id: string; slot_id: string | null }>>`
    SELECT id, slot_id FROM tickets
    WHERE tenant_id = ${tenantId}::uuid
      AND service_point_id = ${servicePointId}::uuid
      AND queue_date = ${queueDate}::date
      AND status = 'WAITING'
    ORDER BY seq
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  `;
  return rows[0] && { id: rows[0].id, slotId: rows[0].slot_id };
}

/**
 * INV-4 / ADR-004: claim an idempotency key inside the caller's transaction.
 * Returns true if this transaction now owns the key, false if a COMMITTED row already exists.
 *
 * Why raw: a plain INSERT that hits the unique key raises an error, and in Postgres any error
 * aborts the whole transaction (the tenant setting and all later queries are lost).
 * `ON CONFLICT DO NOTHING` does not raise. If another transaction holds the same key
 * uncommitted, this statement WAITS for it: commit -> we get false; rollback -> we get true.
 */
export async function claimIdempotencyKey(
  tx: Tx,
  row: { tenantId: string; key: string; endpoint: string; requestHash: string },
): Promise<boolean> {
  const inserted = await tx.$executeRaw`
    INSERT INTO idempotency_keys (tenant_id, key, endpoint, request_hash)
    VALUES (${row.tenantId}::uuid, ${row.key}, ${row.endpoint}, ${row.requestHash})
    ON CONFLICT (tenant_id, key) DO NOTHING
  `;
  return inserted === 1;
}

/** INV-5 / D-29: lock a slot row before changing booked_count. Why raw: Prisma has no FOR UPDATE. */
export async function lockSlot(tx: Tx, tenantId: string, slotId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM slots WHERE id = ${slotId}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE`;
}
