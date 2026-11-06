import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { unauthorized } from '../common/app-error';
import type { JwtPayload } from './auth.types';
import { AuthService } from './auth.service';
import { IS_PUBLIC } from './decorators';

/** Authentication. Global; skipped only for @Public() routes. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;

    const req = ctx.switchToHttp().getRequest();
    const [scheme, token] = String(req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw unauthorized();

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, { algorithms: ['HS256'] });
    } catch {
      throw unauthorized();
    }

    const user = await this.auth.resolveUser(payload);
    if (!user) throw unauthorized();
    req.user = user;
    return true;
  }
}
