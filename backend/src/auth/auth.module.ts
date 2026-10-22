import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import jwksRsa from 'jwks-rsa';
import { PrismaModule } from '../prisma/prisma.module.js';
import { JWKS_CLIENT } from './auth.constants.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { KeycloakJwtStrategy } from './keycloak-jwt.strategy.js';
import { PermissionsGuard } from './permissions.guard.js';
import { RolesGuard } from './roles.guard.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'keycloak-jwt' }), PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    KeycloakJwtStrategy,
    PermissionsGuard,
    RolesGuard,
    {
      provide: JWKS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): jwksRsa.JwksClient => {
        const issuer = config.getOrThrow<string>('KEYCLOAK_ISSUER_URL');
        return jwksRsa({
          cache: true,
          rateLimit: true,
          jwksRequestsPerMinute: 5,
          jwksUri: `${issuer}/protocol/openid-connect/certs`,
        });
      },
    },
  ],
  exports: [AuthService, PermissionsGuard, RolesGuard],
})
export class AuthModule {}
