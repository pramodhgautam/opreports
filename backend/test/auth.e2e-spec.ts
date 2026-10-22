import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { JWKS_CLIENT } from './../src/auth/auth.constants.js';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

const ISSUER = 'http://localhost:8080/realms/opreports';
const AUDIENCE = 'opreports-api';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

  const existingUser = {
    id: '11111111-1111-1111-1111-111111111111',
    idpSubject: 'test-user-sub',
    email: 'user@example.com',
    name: 'Test User',
    userRoles: [
      {
        role: {
          name: 'VIEWER',
          rolePermissions: [{ permission: { name: 'report:read' } }],
        },
      },
    ],
  };

  const prismaMock = {
    user: { findUnique: () => Promise.resolve(existingUser) },
    role: { findUnique: () => Promise.resolve({ id: 4, name: 'VIEWER' }) },
    userRole: { create: () => Promise.resolve({}) },
    $transaction: (fn: (tx: unknown) => unknown) => fn(prismaMock),
    $connect: () => Promise.resolve(),
    $disconnect: () => Promise.resolve(),
  };

  const fakeJwksClient = {
    getSigningKey: (
      _kid: string | null | undefined,
      cb: (err: Error | null, key?: { getPublicKey(): string }) => void,
    ): void => cb(null, { getPublicKey: () => publicKeyPem }),
  };

  beforeEach(async () => {
    process.env.KEYCLOAK_ISSUER_URL = ISSUER;
    process.env.OIDC_AUDIENCE = AUDIENCE;
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/opreports';
    process.env.CORS_ORIGIN = 'http://localhost:4200';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(JWKS_CLIENT)
      .useValue(fakeJwksClient)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/auth/whoami without a token -> 401', () => {
    return request(app.getHttpServer()).get('/api/auth/whoami').expect(401);
  });

  it('GET /api/auth/whoami with a valid Keycloak JWT -> 200 with roles/permissions', async () => {
    const token = jwt.sign(
      { sub: 'test-user-sub', email: 'user@example.com', name: 'Test User' },
      privateKeyPem,
      {
        algorithm: 'RS256',
        keyid: 'test-kid',
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresIn: '1h',
      },
    );

    const response = await request(app.getHttpServer())
      .get('/api/auth/whoami')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: existingUser.id,
      email: 'user@example.com',
      name: 'Test User',
      roles: ['VIEWER'],
      permissions: ['report:read'],
    });
  });
});
