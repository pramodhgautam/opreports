import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Requires the authenticated user to hold the role in `route.data['role']`.
 * Redirects to /forbidden otherwise.
 */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const required = route.data['role'] as string | undefined;

  if (!required || auth.hasRole(required)) {
    return true;
  }
  return router.parseUrl('/forbidden');
};
