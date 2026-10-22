import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from './auth.types.js';

/** Injects the authenticated JWT identity (`request.user`) set by the strategy. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    return request.user as AuthUser;
  },
);
