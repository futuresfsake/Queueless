import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { PublicController } from './public.controller';
import { PublicRateLimitGuard } from './public-rate-limit.guard';
import { PublicService } from './public.service';

@Module({
  imports: [QueueModule],
  controllers: [PublicController],
  providers: [PublicService, PublicRateLimitGuard],
  exports: [PublicService],
})
export class PublicModule {}
