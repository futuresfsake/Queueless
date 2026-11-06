import { Injectable } from '@nestjs/common';
import type { CreateServicePointBody, UpdateServicePointBody } from '@queueless/shared';
import { notFound } from '../common/app-error';
import { TenantPrisma } from '../db/tenant-prisma.service';

@Injectable()
export class ServicePointsService {
  constructor(private readonly tenantPrisma: TenantPrisma) {}

  /** US-3 */
  create(tenantId: string, body: CreateServicePointBody) {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.servicePoint.create({
        data: { tenantId, name: body.name, code: body.code, prefix: body.prefix, maxWaiting: body.maxWaiting },
      }),
    );
  }

  list(tenantId: string) {
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.servicePoint.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    );
  }

  async update(tenantId: string, id: string, body: UpdateServicePointBody) {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const existing = await tx.servicePoint.findFirst({ where: { id, tenantId } });
      if (!existing) throw notFound('Service point');
      return tx.servicePoint.update({
        where: { id },
        data: { name: body.name, isActive: body.isActive, maxWaiting: body.maxWaiting },
      });
    });
  }
}
