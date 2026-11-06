import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@queueless/shared';
import { forbidden } from '../common/app-error';
import { IS_PUBLIC, ROLES } from './decorators';

/** Authorization. Default deny: a route must say who may call it (@Roles) or be @Public. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const allowed = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, targets);
    const user = ctx.switchToHttp().getRequest().user;
    if (!allowed?.length || !user || !allowed.includes(user.role)) throw forbidden();
    return true;
  }
}
