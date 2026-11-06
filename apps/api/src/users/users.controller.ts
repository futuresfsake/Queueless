import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CreateUserBody, UpdateUserBody } from '@queueless/shared';
import type { RequestUser } from '../auth/auth.types';
import { CurrentUser, Roles, tenantOf } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { UsersService } from './users.service';

@Roles('CLINIC_ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(CreateUserBody)) body: CreateUserBody) {
    return this.users.create(tenantOf(user), body);
  }

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.users.list(tenantOf(user));
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateUserBody)) body: UpdateUserBody,
  ) {
    return this.users.update(tenantOf(user), id, body);
  }
}
