import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Requires the authenticated user to hold the permission in
 * `route.data['permission']`. Redirects to /forbidden otherwise.
 */
export const permissionGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const required = route.data['permission'] as string | undefined;

  if (!required || auth.hasPermission(required)) {
    return true;
  }
  return router.parseUrl('/forbidden');
};
