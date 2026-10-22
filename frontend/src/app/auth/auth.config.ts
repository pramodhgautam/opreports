import { AuthConfig } from 'angular-oauth2-oidc';
import { environment } from '../../environments/environment';

/**
 * OIDC Authorization Code Flow + PKCE against Keycloak.
 * The Angular SPA is a *public* client — no client secret is configured here.
 */
export const authConfig: AuthConfig = {
  issuer: `${environment.keycloakUrl}/realms/${environment.keycloakRealm}`,
  clientId: environment.keycloakClientId,
  redirectUri: `${window.location.origin}/callback`,
  postLogoutRedirectUri: `${window.location.origin}/`,
  responseType: 'code',
  scope: 'openid profile email offline_access',
  useSilentRefresh: true,
  silentRefreshRedirectUri: `${window.location.origin}/silent-refresh.html`,
  silentRefreshTimeout: 5000,
  showDebugInformation: !environment.production,
  // Local dev runs over plain HTTP; set to true (or 'remoteOnly') in production.
  requireHttps: false,
  // Keycloak's discovery document can carry a slightly different issuer shape.
  strictDiscoveryDocumentValidation: false,
  sessionChecksEnabled: false,
  clearHashAfterLogin: true,
  oidc: true,
};
