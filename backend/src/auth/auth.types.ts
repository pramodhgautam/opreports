import type { Request } from 'express';

/** Decoded Keycloak access token claims we rely on. */
export interface KeycloakJwtPayload {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  iss: string;
  aud?: string | string[];
  azp?: string;
  exp: number;
  iat?: number;
  nbf?: number;
}

/** JWT-derived identity attached to `request.user` by the strategy. */
export interface AuthUser {
  idpSubject: string;
  email: string | null;
  name: string | null;
}

/** DB-backed authorization context (roles/permissions resolved from Postgres). */
export interface UserContext {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
  permissions: string[];
}

/** Request-local cache key so one request only resolves the user context once. */
export const REQUEST_USER_CONTEXT: unique symbol = Symbol('request.userContext');

export type RequestWithUserContext = Request & { [REQUEST_USER_CONTEXT]?: UserContext };
