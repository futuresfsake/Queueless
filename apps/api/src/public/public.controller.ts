import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JoinQueueBody } from '@queueless/shared';
import { Public } from '../auth/decorators';
import { AppError } from '../common/app-error';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PublicRateLimitGuard } from './public-rate-limit.guard';
import { PublicService } from './public.service';

const TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/;
const checkToken = (token: string) => {
  if (!TOKEN_RE.test(token)) throw new AppError(404, 'NOT_FOUND', 'Ticket not found');
  return token;
};

/** Unauthenticated patient and TV routes (api.md "Public"). Writes are rate limited per IP (US-36). */
@Public()
@Controller('public')
export class PublicController {
  constructor(private readonly service: PublicService) {}

  @Get('c/:slug/service-points')
  servicePoints(@Param('slug') slug: string) {
    return this.service.listServicePoints(slug);
  }

  @UseGuards(PublicRateLimitGuard)
  @Post('c/:slug/service-points/:code/tickets')
  join(
    @Param('slug') slug: string,
    @Param('code') code: string,
    @Body(new ZodValidationPipe(JoinQueueBody)) body: JoinQueueBody,
    @Headers('idempotency-key') key: string | undefined,
  ) {
    return this.service.join(slug, code, body, key);
  }

  @Get('c/:slug/service-points/:code/slots')
  slots(@Param('slug') slug: string, @Param('code') code: string, @Query('date') date?: string) {
    if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new AppError(400, 'VALIDATION_FAILED', 'date must be YYYY-MM-DD');
    }
    return this.service.listSlots(slug, code, date);
  }

  @UseGuards(PublicRateLimitGuard)
  @Post('c/:slug/slots/:slotId/book')
  book(
    @Param('slug') slug: string,
    @Param('slotId', new ParseUUIDPipe()) slotId: string,
    @Body(new ZodValidationPipe(JoinQueueBody)) body: JoinQueueBody,
    @Headers('idempotency-key') key: string | undefined,
  ) {
    return this.service.book(slug, slotId, body, key);
  }

  @Get('c/:slug/service-points/:code/display')
  display(@Param('slug') slug: string, @Param('code') code: string) {
    return this.service.display(slug, code);
  }

  @Get('t/:token')
  ticket(@Param('token') token: string) {
    return this.service.ticketStatus(checkToken(token));
  }

  @UseGuards(PublicRateLimitGuard)
  @Post('t/:token/cancel')
  @HttpCode(200)
  cancel(@Param('token') token: string) {
    return this.service.cancel(checkToken(token));
  }
}
