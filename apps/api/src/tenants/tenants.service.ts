import { Injectable } from '@nestjs/common';
import type { CreateTenantBody } from '@queueless/shared';
import { PasswordService } from '../auth/password.service';
import { TenantPrisma } from '../db/tenant-prisma.service';

@Injectable()
export class TenantsService {
  constructor(
    private readonly tenantPrisma: TenantPrisma,
    private readonly passwords: PasswordService,
  ) {}

  /** US-1: a clinic and its first Clinic Admin are created together or not at all. */
  async create(body: CreateTenantBody) {
    const passwordHash = await this.passwords.hash(body.admin.password);
    return this.tenantPrisma.runAsSuperAdmin(async (tx) => {
      const tenant = await tx.tenant.create({ data: { slug: body.slug, name: body.name } });
      const admin = await tx.user.create({
        data: { tenantId: tenant.id, email: body.admin.email, passwordHash, role: 'CLINIC_ADMIN' },
      });
      return {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        isActive: tenant.isActive,
        admin: { id: admin.id, email: admin.email, role: admin.role },
      };
    });
  }

  list() {
    return this.tenantPrisma.runAsSuperAdmin((tx) =>
      tx.tenant.findMany({
        select: { id: true, slug: true, name: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }
}
