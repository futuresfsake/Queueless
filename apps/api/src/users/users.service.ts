import { Injectable } from '@nestjs/common';
import type { CreateUserBody, UpdateUserBody } from '@queueless/shared';
import { PasswordService } from '../auth/password.service';
import { forbidden, notFound } from '../common/app-error';
import { TenantPrisma } from '../db/tenant-prisma.service';

const SAFE = { id: true, email: true, role: true, isActive: true, createdAt: true } as const; // never passwordHash

@Injectable()
export class UsersService {
  constructor(
    private readonly tenantPrisma: TenantPrisma,
    private readonly passwords: PasswordService,
  ) {}

  /** US-2: a Clinic Admin creates STAFF in their own clinic. The tenant comes from the JWT, never the body. */
  async create(tenantId: string, body: CreateUserBody) {
    const passwordHash = await this.passwords.hash(body.password);
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.user.create({ data: { tenantId, email: body.email, passwordHash, role: 'STAFF' }, select: SAFE }),
    );
  }

  list(tenantId: string) {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.user.findMany({ where: { tenantId }, select: SAFE, orderBy: { createdAt: 'asc' } }),
    );
  }

  /** Deactivate/reactivate a STAFF member or reset their password. Other tenants' users are simply "not found". */
  async update(tenantId: string, id: string, body: UpdateUserBody) {
    const passwordHash = body.password ? await this.passwords.hash(body.password) : undefined;
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const target = await tx.user.findFirst({ where: { id, tenantId } });
      if (!target) throw notFound('User');
      if (target.role !== 'STAFF') throw forbidden('Only STAFF accounts can be managed here');
      return tx.user.update({
        where: { id },
        data: { isActive: body.isActive, passwordHash },
        select: SAFE,
      });
    });
  }
}
