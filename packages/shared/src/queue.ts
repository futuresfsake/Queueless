import { z } from 'zod';

// US-5 / Data Privacy Act: only the minimum patient data needed to run a queue.
// There are deliberately no symptom, diagnosis or priority-reason fields.
// `consent` is a plain boolean here so the API can answer a missing tick with the specific
// CONSENT_REQUIRED error instead of a generic validation error.
export const JoinQueueBody = z.object({
  patientName: z.string().trim().min(1).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, 'digits only, optional leading +')
    .optional(),
  consent: z.boolean().default(false),
});
export type JoinQueueBody = z.infer<typeof JoinQueueBody>;

/** Staff actions on one ticket: the last path segment of POST /tickets/:id/<action>. */
export const TicketAction = z.enum(['start', 'complete', 'no-show', 'skip', 'cancel']);
export type TicketAction = z.infer<typeof TicketAction>;
