import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CreateServicePointBody, UpdateServicePointBody } from '@queueless/shared';
import type { RequestUser } from '../auth/auth.types';
import { CurrentUser, Roles, tenantOf } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ServicePointsService } from './service-points.service';

@Controller('service-points')
export class ServicePointsController {
  constructor(private readonly servicePoints: ServicePointsService) {}

  @Roles('CLINIC_ADMIN')
  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(CreateServicePointBody)) body: CreateServicePointBody,
  ) {
    return this.servicePoints.create(tenantOf(user), body);
  }

  // Staff need the list to pick the queue they work on.
  @Roles('CLINIC_ADMIN', 'STAFF')
  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.servicePoints.list(tenantOf(user));
  }

  @Roles('CLINIC_ADMIN')
  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateServicePointBody)) body: UpdateServicePointBody,
  ) {
    return this.servicePoints.update(tenantOf(user), id, body);
  }
}
