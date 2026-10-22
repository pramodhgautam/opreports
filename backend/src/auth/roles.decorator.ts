import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Requires at least ONE of the listed roles (OR semantics).
 * When used together with @RequirePermissions on the same handler, both must pass (AND).
 */
export const RequireRoles = (...roles: string[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
