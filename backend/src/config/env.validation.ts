export interface EnvConfig {
  KEYCLOAK_ISSUER_URL: string;
  KEYCLOAK_CLIENT_ID?: string;
  OIDC_AUDIENCE: string;
  DATABASE_URL: string;
  CORS_ORIGIN: string;
  PORT: number;
}

const REQUIRED = ['KEYCLOAK_ISSUER_URL', 'OIDC_AUDIENCE', 'DATABASE_URL', 'CORS_ORIGIN'] as const;

/**
 * Fail fast at boot when a required environment variable is missing.
 * Returns a normalized, typed config object consumed via ConfigService.
 */
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const missing = REQUIRED.filter((key) => {
    const value = config[key];
    return typeof value !== 'string' || value.trim() === '';
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Copy backend/.env.example to backend/.env and fill in real values.',
    );
  }

  const rawPort = typeof config.PORT === 'string' && config.PORT !== '' ? config.PORT : '3000';
  const port = Number.parseInt(rawPort, 10);
  if (Number.isNaN(port)) {
    throw new Error('PORT must be a valid number.');
  }

  return {
    // Normalize a trailing slash so `${issuer}/protocol/...` never double-slash.
    KEYCLOAK_ISSUER_URL: (config.KEYCLOAK_ISSUER_URL as string).trim().replace(/\/+$/, ''),
    KEYCLOAK_CLIENT_ID: (config.KEYCLOAK_CLIENT_ID as string | undefined)?.trim() || undefined,
    OIDC_AUDIENCE: (config.OIDC_AUDIENCE as string).trim(),
    DATABASE_URL: (config.DATABASE_URL as string).trim(),
    CORS_ORIGIN: (config.CORS_ORIGIN as string).trim().replace(/\/+$/, ''),
    PORT: port,
  };
}
