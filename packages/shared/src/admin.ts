import { z } from 'zod';

// Shared by API (validation) and web (forms). Keep in sync with docs/tech/api.md and schema.md CHECKs.

export const Role = z.enum(['SUPER_ADMIN', 'CLINIC_ADMIN', 'STAFF']);
export type Role = z.infer<typeof Role>;

const email = z.string().trim().toLowerCase().email().max(254);
// Length beats complexity rules. Upper bound stops hashing-DoS with huge inputs.
const newPassword = z.string().min(10, 'at least 10 characters').max(128);

export const LoginBody = z.object({
  email,
  password: z.string().min(1).max(128),
});
export type LoginBody = z.infer<typeof LoginBody>;

export const AuthUser = z.object({
  id: z.string().uuid(),
  email: z.string(),
  role: Role,
  tenantId: z.string().uuid().nullable(),
});
export type AuthUser = z.infer<typeof AuthUser>;

export const LoginResponse = z.object({ accessToken: z.string(), user: AuthUser });
export type LoginResponse = z.infer<typeof LoginResponse>;

// US-1: a tenant is created together with its first Clinic Admin.
export const CreateTenantBody = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase letters, digits and dashes').min(2).max(40),
  name: z.string().trim().min(1).max(120),
  admin: z.object({ email, password: newPassword }),
});
export type CreateTenantBody = z.infer<typeof CreateTenantBody>;

// US-2: Clinic Admin creates STAFF only.
export const CreateUserBody = z.object({ email, password: newPassword });
export type CreateUserBody = z.infer<typeof CreateUserBody>;

export const UpdateUserBody = z
  .object({ isActive: z.boolean(), password: newPassword })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');
export type UpdateUserBody = z.infer<typeof UpdateUserBody>;

// US-3. Matches the DB CHECKs: prefix ^[A-Z]{1,3}$, code ^[a-z0-9-]{1,40}$.
export const CreateServicePointBody = z.object({
  name: z.string().trim().min(1).max(80),
  code: z.string().regex(/^[a-z0-9-]{1,40}$/),
  prefix: z.string().regex(/^[A-Z]{1,3}$/),
  maxWaiting: z.number().int().min(1).max(1000).optional(),
});
export type CreateServicePointBody = z.infer<typeof CreateServicePointBody>;

export const UpdateServicePointBody = z
  .object({
    name: z.string().trim().min(1).max(80),
    isActive: z.boolean(),
    maxWaiting: z.number().int().min(1).max(1000),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');
export type UpdateServicePointBody = z.infer<typeof UpdateServicePointBody>;
