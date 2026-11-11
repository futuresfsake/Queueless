import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CreateSlotBody } from '@queueless/shared';
import type { RequestUser } from '../auth/auth.types';
import { CurrentUser, Roles, tenantOf } from '../auth/decorators';
import { AppError, notFound } from '../common/app-error';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TenantPrisma } from '../db/tenant-prisma.service';

/** US-8: Clinic Admin manages slots. Patients read and book them through /public. */
@Controller('slots')
export class SlotsController {
  constructor(private readonly tenantPrisma: TenantPrisma) {}

  @Roles('CLINIC_ADMIN')
  @Post()
  create(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(CreateSlotBody)) body: CreateSlotBody) {
    const tenantId = tenantOf(user);
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const point = await tx.servicePoint.findFirst({ where: { id: body.servicePointId, tenantId } });
      if (!point) throw notFound('Service point');
      return tx.slot.create({
        data: { tenantId, servicePointId: point.id, startsAt: new Date(body.startsAt), capacity: body.capacity },
      });
    });
  }

  @Roles('CLINIC_ADMIN')
  @Get()
  list(@CurrentUser() user: RequestUser, @Query('servicePointId') servicePointId?: string) {
    const tenantId = tenantOf(user);
    if (servicePointId !== undefined && !/^[0-9a-f-]{36}$/i.test(servicePointId)) {
      throw new AppError(400, 'VALIDATION_FAILED', 'servicePointId must be a UUID');
    }
    return this.tenantPrisma.run(tenantId, (tx) =>
      tx.slot.findMany({
        where: { tenantId, ...(servicePointId ? { servicePointId } : {}) },
        orderBy: { startsAt: 'asc' },
      }),
    );
  }
}
