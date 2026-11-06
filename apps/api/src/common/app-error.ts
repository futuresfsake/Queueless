import { HttpException } from '@nestjs/common';

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'CONFLICT'
  | 'TOO_MANY_ATTEMPTS'
  | 'INTERNAL_ERROR';

/** Business/API error that renders as `{ error: { code, message, details } }` (conventions.md). */
export class AppError extends HttpException {
  constructor(
    status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super({ error: { code, message, details } }, status);
  }
}

export const unauthorized = () => new AppError(401, 'UNAUTHORIZED', 'Invalid credentials or token');
export const forbidden = (message = 'You do not have access to this resource') =>
  new AppError(403, 'FORBIDDEN', message);
export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`);
