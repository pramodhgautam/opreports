import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';

/** Blocks navigation for unauthenticated users and redirects to Keycloak. */
export const authGuard: CanActivateFn = (): boolean => {
  const oauthService = inject(OAuthService);
  if (oauthService.hasValidAccessToken()) {
    return true;
  }
  oauthService.initCodeFlow();
  return false;
};
