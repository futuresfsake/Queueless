import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateTenantBody } from '@queueless/shared';
import { Roles } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TenantsService } from './tenants.service';

@Roles('SUPER_ADMIN')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Post()
  create(@Body(new ZodValidationPipe(CreateTenantBody)) body: CreateTenantBody) {
    return this.tenants.create(body);
  }

  @Get()
  list() {
    return this.tenants.list();
  }
}
