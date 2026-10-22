import { Injectable } from '@angular/core';
import { OAuthLogger } from 'angular-oauth2-oidc';

const SENSITIVE_KEYS = new Set(['access_token', 'refresh_token', 'id_token', 'authorization', 'code']);

const looksLikeJwt = (value: string): boolean =>
  /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);

/** Recursively masks token values (JWTs and sensitive keys) before logging. */
function sanitize(value: unknown): unknown {
  if (typeof value === 'string') {
    return looksLikeJwt(value) ? '[REDACTED]' : value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = SENSITIVE_KEYS.has(key) ? '[REDACTED]' : sanitize(val);
    }
    return out;
  }
  return value;
}

/**
 * Drop-in OAuthLogger that keeps `showDebugInformation` output while ensuring
 * access/refresh/id tokens never reach `console.*`.
 */
@Injectable()
export class RedactedOAuthLogger extends OAuthLogger {
  debug(message?: unknown, ...optionalParams: unknown[]): void {
    console.debug(sanitize(message), ...optionalParams.map(sanitize));
  }

  info(message?: unknown, ...optionalParams: unknown[]): void {
    console.info(sanitize(message), ...optionalParams.map(sanitize));
  }

  log(message?: unknown, ...optionalParams: unknown[]): void {
    console.log(sanitize(message), ...optionalParams.map(sanitize));
  }

  warn(message?: unknown, ...optionalParams: unknown[]): void {
    console.warn(sanitize(message), ...optionalParams.map(sanitize));
  }

  error(message?: unknown, ...optionalParams: unknown[]): void {
    console.error(sanitize(message), ...optionalParams.map(sanitize));
  }
}
