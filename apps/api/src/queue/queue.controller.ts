import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { JoinQueueBody, TicketAction } from '@queueless/shared';
import type { RequestUser } from '../auth/auth.types';
import { CurrentUser, Roles, tenantOf } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { QueueService } from './queue.service';

/** Staff queue API (docs/tech/api.md "Staff queue"). Every POST needs an Idempotency-Key (rule 4). */
@Controller()
export class QueueController {
  constructor(private readonly queue: QueueService) {}

  /** US-9 */
  @Roles('STAFF', 'CLINIC_ADMIN')
  @Get('queue/:servicePointId')
  list(@CurrentUser() user: RequestUser, @Param('servicePointId', new ParseUUIDPipe()) servicePointId: string) {
    return this.queue.list(tenantOf(user), servicePointId);
  }

  /** US-5: walk-in registered by staff at the desk. */
  @Roles('STAFF', 'CLINIC_ADMIN')
  @Post('queue/:servicePointId/tickets')
  issue(
    @CurrentUser() user: RequestUser,
    @Param('servicePointId', new ParseUUIDPipe()) servicePointId: string,
    @Body(new ZodValidationPipe(JoinQueueBody)) body: JoinQueueBody,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.queue.issueTicket(
      tenantOf(user),
      servicePointId,
      body,
      { kind: 'STAFF', userId: user.id },
      idempotencyKey,
    );
  }

  /** US-10 */
  @Roles('STAFF', 'CLINIC_ADMIN')
  @Post('queue/:servicePointId/call-next')
  @HttpCode(200)
  callNext(
    @CurrentUser() user: RequestUser,
    @Param('servicePointId', new ParseUUIDPipe()) servicePointId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.queue.callNext(tenantOf(user), servicePointId, user.id, idempotencyKey);
  }

  /** US-11 start, US-12 complete, US-13 no-show, US-14 skip, US-7 cancel. */
  @Roles('STAFF', 'CLINIC_ADMIN')
  @Post('tickets/:id/:action')
  @HttpCode(200)
  act(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) ticketId: string,
    @Param('action', new ZodValidationPipe(TicketAction)) action: TicketAction,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.queue.act(tenantOf(user), ticketId, action, user.id, idempotencyKey);
  }
}
