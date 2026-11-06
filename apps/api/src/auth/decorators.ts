import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@queueless/shared';
import { forbidden } from '../common/app-error';
import type { RequestUser } from './auth.types';

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

/** Explicitly opt a route OUT of authentication. Everything else is default-deny. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Roles allowed on this route. A route with neither @Public nor @Roles is rejected (403). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestUser => {
  return ctx.switchToHttp().getRequest().user;
});

/** Tenant of a CLINIC_ADMIN/STAFF user. The DB CHECK guarantees non-null for them; this guards the type. */
export function tenantOf(user: RequestUser): string {
  if (!user.tenantId) throw forbidden('This action needs a clinic account');
  return user.tenantId;
}
