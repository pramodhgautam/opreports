import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import jwksRsa from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWKS_CLIENT } from './auth.constants.js';
import type { AuthUser, KeycloakJwtPayload } from './auth.types.js';

@Injectable()
export class KeycloakJwtStrategy extends PassportStrategy(Strategy, 'keycloak-jwt') {
  private readonly logger = new Logger(KeycloakJwtStrategy.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(JWKS_CLIENT) private readonly jwksClient: jwksRsa.JwksClient,
  ) {
    const issuer = config.getOrThrow<string>('KEYCLOAK_ISSUER_URL');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // `iss` is validated strictly by jsonwebtoken (must equal KEYCLOAK_ISSUER_URL).
      issuer,
      algorithms: ['RS256'],
      // Resolve the signing key from Keycloak's JWKS on demand (cached by jwks-rsa).
      secretOrKeyProvider: (
        _request: unknown,
        rawJwtToken: string,
        done: (err: Error | null, secretOrKey?: string | Buffer) => void,
      ): void => {
        const kid = KeycloakJwtStrategy.extractKid(rawJwtToken);
        if (!kid) {
          done(new UnauthorizedException('JWT is missing a `kid` header; cannot select a JWKS key'));
          return;
        }
        this.jwksClient.getSigningKey(kid, (err, key) => {
          if (err) {
            // Log the reason only (never the token).
            this.logger.warn(`Failed to resolve JWKS signing key for kid=${kid}: ${err.message}`);
            done(err);
            return;
          }
          if (!key) {
            done(new Error(`JWKS did not return a signing key for kid=${kid}`));
            return;
          }
          done(null, key.getPublicKey());
        });
      },
      // Clock skew tolerance: ≤ 60s (also applies to `nbf`).
      jsonWebTokenOptions: { clockTolerance: 60 },
    });
  }

  /**
   * Runs after passport-jwt has verified signature, `iss`, `exp` and `nbf`.
   * `aud` is validated here (not via the passport `audience` option) so we can
   * return an actionable 401 when the Keycloak audience mapper is missing.
   */
  validate(payload: KeycloakJwtPayload): AuthUser {
    if (!payload.sub) {
      this.logger.warn('Access token is missing the `sub` claim');
      throw new UnauthorizedException('Access token is missing the required `sub` claim');
    }

    const audience = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
    const expectedAudience = this.config.getOrThrow<string>('OIDC_AUDIENCE');

    if (audience.length === 0) {
      this.logger.warn(
        `Access token (sub=${payload.sub}) is missing the \`aud\` claim. ` +
          'Add an Audience mapper in Keycloak: Clients -> <spa-client> -> Client scopes -> ' +
          '<client>-dedicated -> Mappers -> Add mapper -> By configuration -> Audience -> ' +
          '"Included Custom Audience" = OIDC_AUDIENCE, "Add to access token" = ON.',
      );
      throw new UnauthorizedException(
        'Access token is missing the `aud` (audience) claim. Configure the Keycloak ' +
          'Audience mapper and set OIDC_AUDIENCE to the expected value.',
      );
    }

    if (!audience.includes(expectedAudience)) {
      this.logger.warn(
        `Access token (sub=${payload.sub}) audience [${audience.join(', ')}] does not ` +
          `include OIDC_AUDIENCE=${expectedAudience}.`,
      );
      throw new UnauthorizedException('Access token audience does not match the expected OIDC_AUDIENCE.');
    }

    const email = typeof payload.email === 'string' && payload.email.length > 0 ? payload.email : null;
    const name =
      (typeof payload.name === 'string' && payload.name.length > 0 ? payload.name : payload.preferred_username) ??
      null;

    return { idpSubject: payload.sub, email, name };
  }

  private static extractKid(token: string): string | null {
    try {
      const headerSegment = token.split('.')[0];
      const decoded = Buffer.from(headerSegment, 'base64url').toString('utf8');
      const header = JSON.parse(decoded) as { kid?: unknown };
      return typeof header.kid === 'string' && header.kid.length > 0 ? header.kid : null;
    } catch {
      return null;
    }
  }
}
