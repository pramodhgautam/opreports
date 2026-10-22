import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import type { AuthUser } from './auth.types.js';
import { PERMISSIONS_KEY } from './permissions.decorator.js';

/**
 * Enforces @RequirePermissions(...). OR semantics within the decorator; no
 * decorator metadata means "any authenticated user". When used together with
 * RolesGuard (both decorators), both must pass (AND across decorators).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = request.user;
    if (!user) {
      return false;
    }

    const userContext = await this.authService.resolveUserContext(user, request);
    const authorized = required.some((permission) => userContext.permissions.includes(permission));

    if (!authorized) {
      throw new ForbiddenException(`Missing required permission (one of: ${required.join(', ')})`);
    }
    return true;
  }
}
