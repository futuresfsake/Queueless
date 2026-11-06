import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { DbModule } from './db/db.module';
import { HealthController } from './health.controller';
import { ServicePointsController } from './service-points/service-points.controller';
import { ServicePointsService } from './service-points/service-points.service';
import { TenantsController } from './tenants/tenants.controller';
import { TenantsService } from './tenants/tenants.service';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [HealthController, TenantsController, UsersController, ServicePointsController],
  providers: [
    TenantsService,
    UsersService,
    ServicePointsService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
