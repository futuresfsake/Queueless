import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { AuthUser, LoginBody, LoginResponse } from '@queueless/shared';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { ALL_ROLES, RequestUser } from './auth.types';
import { CurrentUser, Public, Roles } from './decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(LoginBody)) body: LoginBody, @Req() req: Request): Promise<LoginResponse> {
    return this.auth.login(body.email, body.password, req.ip ?? 'unknown');
  }

  @Roles(...ALL_ROLES)
  @Get('me')
  me(@CurrentUser() user: RequestUser): AuthUser {
    return { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId };
  }
}
