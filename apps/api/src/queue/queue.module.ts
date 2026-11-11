import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { IdempotencyService } from './idempotency.service';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';

@Module({
  controllers: [QueueController],
  providers: [EventsService, IdempotencyService, QueueService],
  exports: [QueueService, EventsService],
})
export class QueueModule {}
