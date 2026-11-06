import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { getJwtSecret } from '../config/env';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { LoginThrottle } from './login-throttle.service';
import { PasswordService } from './password.service';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({ secret: getJwtSecret(), signOptions: { expiresIn: '8h', algorithm: 'HS256' } }), // D-7
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    LoginThrottle,
    // Order matters: authenticate first, then authorize. Both apply to every route in the app.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [PasswordService],
})
export class AuthModule {}
