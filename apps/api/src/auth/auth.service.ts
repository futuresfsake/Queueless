import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { LoginResponse } from '@queueless/shared';
import { unauthorized } from '../common/app-error';
import { Tx, TenantPrisma } from '../db/tenant-prisma.service';
import type { JwtPayload, RequestUser } from './auth.types';
import { LoginThrottle } from './login-throttle.service';
import { PasswordService } from './password.service';

@Injectable()
export class AuthService {
  // A real hash to verify against when the email is unknown, so timing does not reveal which emails exist.
  private dummyHash?: Promise<string>;

  constructor(
    private readonly tenantPrisma: TenantPrisma,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly throttle: LoginThrottle,
  ) {}

  async login(email: string, password: string, ip: string): Promise<LoginResponse> {
    this.throttle.assertAllowed(email, ip);

    const user = await this.tenantPrisma.runForLogin(email, (tx) =>
      tx.user.findUnique({ where: { email }, include: { tenant: true } }),
    );

    this.dummyHash ??= this.passwords.hash('not-a-real-password');
    const passwordOk = await this.passwords.verify(password, user?.passwordHash ?? (await this.dummyHash));

    // Same generic answer for: unknown email, wrong password, deactivated user, deactivated clinic.
    if (!user || !passwordOk || !user.isActive || (user.tenant && !user.tenant.isActive)) {
      this.throttle.recordFailure(email, ip);
      throw unauthorized();
    }

    this.throttle.recordSuccess(email);
    const payload: JwtPayload = { sub: user.id, role: user.role, tenantId: user.tenantId };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId },
    };
  }

  /**
   * Called on EVERY authenticated request: a valid signature is not enough. Re-reading the user means
   * deactivating a staff member (US-2) or a clinic takes effect immediately, not when the 8 h token expires.
   */
  async resolveUser(payload: JwtPayload): Promise<RequestUser | null> {
    const read = (tx: Tx) => tx.user.findUnique({ where: { id: payload.sub }, include: { tenant: true } });

    const user =
      payload.role === 'SUPER_ADMIN' || !payload.tenantId
        ? await this.tenantPrisma.runAsSuperAdmin(read)
        : await this.tenantPrisma.run(payload.tenantId, read);

    if (!user || !user.isActive || (user.tenant && !user.tenant.isActive)) return null;
    // The token's claims must still match the database (e.g. role or tenant changed after issue).
    if (user.role !== payload.role || user.tenantId !== payload.tenantId) return null;
    return { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId };
  }
}
