import { Global, Module } from '@nestjs/common';
import { Clock, SystemClock } from '../clock/clock';
import { PrismaService } from './prisma.service';
import { TenantPrisma } from './tenant-prisma.service';

@Global()
@Module({
  providers: [
    { provide: PrismaService, useFactory: () => new PrismaService() },
    TenantPrisma,
    { provide: Clock, useClass: SystemClock },
  ],
  exports: [PrismaService, TenantPrisma, Clock],
})
export class DbModule {}
