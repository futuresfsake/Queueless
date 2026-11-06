import type { Role } from '@queueless/shared';

export interface JwtPayload {
  sub: string; // user id
  role: Role;
  tenantId: string | null;
}

/** Attached to the request by AuthGuard after the user was re-checked as active. */
export interface RequestUser {
  id: string;
  email: string;
  role: Role;
  tenantId: string | null;
}

export const ALL_ROLES: Role[] = ['SUPER_ADMIN', 'CLINIC_ADMIN', 'STAFF'];
