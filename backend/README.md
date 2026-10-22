# Operations Reporting Portal — Backend (NestJS Resource Server)

NestJS resource server for the Operations Reporting Portal. It validates Keycloak
JWTs against the realm's JWKS and enforces authorization from the PostgreSQL RBAC
tables. It does **not** trust Keycloak `realm_access.roles` / `resource_access` for
authorization — roles and permissions are resolved from Postgres on every request.

## Stack

- NestJS 12 (ESM, TypeScript 6, Vitest, oxlint)
- Prisma 6 (PostgreSQL, database `opreports`)
- `passport-jwt` + `jwks-rsa` for JWT validation against Keycloak JWKS
- `@nestjs/throttler` (10 req/min/IP) + `helmet`

## Prerequisites

- Node.js `>= 24.15.0` (Angular CLI 22 requires it; the backend also runs on 22.x)
- PostgreSQL with the `opreports` database and the five pre-existing tables
- A reachable Keycloak realm (see root README for client + audience-mapper setup)

## Setup

```bash
npm install
cp .env.example .env      # then fill in real values (DATABASE_URL etc.)
npm run prisma:generate   # generate the Prisma client (no DB connection needed)
```

### Introspect the existing tables (read-only)

The five tables already exist and are managed **outside** Prisma. Reconcile the
hand-written schema against the live database:

```bash
npm run prisma:pull       # npx prisma db pull
```

> Do **not** run `prisma migrate` — there are no migrations in this repo and the
> existing tables must not be altered or renamed.

### Seed roles / permissions / mappings (idempotent)

```bash
npm run db:seed           # npx prisma db seed
```

Re-running is safe: roles/permissions are upserted by unique key and mappings are
inserted with `skipDuplicates`. No users are seeded — users are auto-provisioned on
first OIDC login with the default `VIEWER` role.

## Run

```bash
npm run start:dev         # watch mode, http://localhost:3000/api
npm run build && npm run start:prod
```

## Endpoints

- `GET /api/health` — liveness probe (unauthenticated)
- `GET /api/auth/whoami` — `{ id, email, name, roles: string[], permissions: string[] }` (JWT protected)
- `GET /api/auth/permissions` — `{ permissions: string[] }` (JWT protected)

## Checks

```bash
npm run build             # tsc type-check via nest build
npm run lint              # oxlint (0 warnings/errors)
npm run test:e2e          # Vitest e2e: 401 without token, 200 with a valid JWT
```

## Environment variables

| Variable             | Required | Description                                                            |
| -------------------- | -------- | ---------------------------------------------------------------------- |
| `KEYCLOAK_ISSUER_URL` | yes      | Realm root, e.g. `http://localhost:8080/realms/opreports`               |
| `KEYCLOAK_CLIENT_ID` | no       | SPA client id (kept for consistency; the backend does not use it)        |
| `OIDC_AUDIENCE`      | yes      | Expected `aud` claim (must match the Keycloak Audience mapper)          |
| `DATABASE_URL`       | yes      | `postgresql://.../opreports`                                             |
| `CORS_ORIGIN`        | yes      | Browser origin, e.g. `http://localhost:4200` (no trailing slash)        |
| `PORT`               | no       | HTTP port (default `3000`)                                              |

Missing required variables fail fast at boot with a clear error.

## Notes

- **JWT validation**: signature (JWKS, cached by `jwks-rsa`), `iss`, `aud`, `exp`,
  `nbf`, and ≤ 60s clock skew. A token missing `aud` returns 401 with a message that
  names the Keycloak Audience mapper (and a warning is logged).
- **Logging**: the request logger logs only method/path/status/duration — headers
  (including `Authorization`) and bodies are never logged.
- **Prisma version**: pinned to `6.19.3` (stable) so `prisma db pull` / `prisma db seed` /
  `prisma-client-js` work exactly as documented. `prisma generate` prints a note that
  `package.json#prisma` is deprecated in Prisma 7; upgrading is out of scope for v1.
