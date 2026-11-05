import { z } from 'zod';

export const TicketStatus = z.enum([
  'WAITING', 'CALLED', 'SERVING', 'SERVED', 'SKIPPED', 'NO_SHOW', 'CANCELLED',
]);
export type TicketStatus = z.infer<typeof TicketStatus>;

export const FINAL_STATUSES: TicketStatus[] = ['SERVED', 'SKIPPED', 'NO_SHOW', 'CANCELLED'];

export const HealthResponse = z.object({
  status: z.enum(['ok', 'degraded']),
  db: z.enum(['up', 'down']),
  uptimeSeconds: z.number(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
