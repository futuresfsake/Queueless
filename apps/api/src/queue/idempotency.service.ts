import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { AppError } from '../common/app-error';
import { claimIdempotencyKey } from '../db/sql/queue.sql';
import type { Tx } from '../db/tenant-prisma.service';

export interface IdempotentRequest {
  tenantId: string;
  /** Raw `Idempotency-Key` header. */
  key: string | undefined;
  method: 'POST';
  /** Route template, e.g. `/queue/:servicePointId/call-next` (stored for debugging). */
  route: string;
  /** Concrete path with ids filled in; part of the request hash. */
  path: string;
  body?: unknown;
}

const MAX_KEY_LENGTH = 200;

/** JSON with object keys sorted, so `{a,b}` and `{b,a}` hash the same. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/** ADR-004: SHA-256 of method + path + canonical JSON body. */
export function requestHash(method: string, path: string, body: unknown): string {
  return createHash('sha256').update(`${method} ${path}\n${canonicalJson(body)}`).digest('hex');
}

/**
 * INV-4 / US-19 / ADR-004: same key -> one effect, same response.
 *
 * This is a service called INSIDE the request transaction, not a NestJS interceptor: the key
 * row must commit or roll back together with the queue change, and an interceptor runs outside
 * that transaction.
 *
 * - First request: claims the key, runs `work`, stores the response, all in one transaction.
 * - Replay: returns the stored response; `work` does not run.
 * - `work` throws (QUEUE_EMPTY, INVALID_TRANSITION...): the transaction rolls back, key included,
 *   so a retry with the same key is evaluated again (T-22).
 * - There is no IN_PROGRESS state: an uncommitted key is invisible, and a concurrent duplicate
 *   blocks on it in the database (T-11).
 */
@Injectable()
export class IdempotencyService {
  async run<T>(tx: Tx, req: IdempotentRequest, work: () => Promise<T>): Promise<T> {
    const key = req.key?.trim();
    if (!key) throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required');
    if (key.length > MAX_KEY_LENGTH) {
      throw new AppError(400, 'VALIDATION_FAILED', `Idempotency-Key must be at most ${MAX_KEY_LENGTH} characters`);
    }

    const hash = requestHash(req.method, req.path, req.body);
    const owned = await claimIdempotencyKey(tx, {
      tenantId: req.tenantId,
      key,
      endpoint: `${req.method} ${req.route}`,
      requestHash: hash,
    });

    if (!owned) {
      const existing = await tx.idempotencyKey.findUnique({ where: { tenantId_key: { tenantId: req.tenantId, key } } });
      // Only possible if the 24 h purge deleted the row between our two statements.
      if (!existing) throw new AppError(409, 'CONFLICT', 'Please retry the request');
      if (existing.requestHash !== hash) {
        throw new AppError(422, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency-Key was already used for a different request');
      }
      return existing.responseBody as T;
    }

    // Round-trip through JSON so the first response and every replay are byte-for-byte the same
    // (e.g. Date -> ISO string), and so only plain JSON is stored.
    const body = JSON.parse(JSON.stringify(await work())) as T;
    await tx.idempotencyKey.update({
      where: { tenantId_key: { tenantId: req.tenantId, key } },
      data: { responseStatus: 200, responseBody: body as Prisma.InputJsonValue },
    });
    return body;
  }
}
