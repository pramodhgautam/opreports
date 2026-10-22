# Operations Reporting Portal

Internal reporting portal for the Operations department. This repository contains
**authentication + authorization only** (v1): Keycloak OIDC login, a NestJS resource
server, and PostgreSQL RBAC. Reporting features are intentionally out of scope.

## Architecture

```
┌──────────────┐   OIDC Authorization Code + PKCE   ┌──────────────┐
│ Angular SPA  │ ─────────────────────────────────▶ │   Keycloak   │
│ (public client)│                                    │   (IdP)      │
└──────┬───────┘                                    └──────────────┘
       │ Bearer access token (JWT)
       ▼
┌──────────────┐   validates signature/iss/aud      ┌──────────────┐
│ NestJS       │ ────────── JWKS ─────────────────▶ │  Keycloak    │
│ Resource Svr │                                    │  /certs      │
└──────┬───────┘                                    └──────────────┘
       │ roles/permissions resolved per request
       ▼
┌──────────────┐
│ PostgreSQL   │  users, roles, permissions, user_roles, role_permissions
│ `opreports`  │
└──────────────┘
```

Authorization is **Postgres-RBAC-only**. Keycloak `realm_access.roles` /
`resource_access` are never used for authorization decisions.

## Repository layout

- `backend/` — NestJS resource server (`/api`)
- `frontend/` — Angular SPA (`http://localhost:4200`)

## Prerequisites

- Node.js `>= 24.15.0` (Angular CLI 22 requirement)
- PostgreSQL with the `opreports` database and its five existing tables
- Keycloak with an `opreports` realm

---

## Keycloak configuration

### 1. Realm

Create/use the realm `opreports`. The backend expects
`KEYCLOAK_ISSUER_URL=http://localhost:8080/realms/opreports`.

### 2. Angular SPA client

Create a client for the SPA:

- **Client type**: `Public`
- **Standard flow enabled**: `ON`
- **Direct access grants enabled**: `OFF`
- **Valid Redirect URIs**: `http://localhost:4200/*` (add any production origin too)
- **Web Origins**: `http://localhost:4200` (exact origin — scheme + host + port, **no trailing slash**)
- **Proof Key for Code Exchange (PKCE)**: `Required` (or `S256`)
- No client secret — this is a public client; the SPA never holds a secret.

### 3. Audience mapper (CRITICAL — read carefully)

Keycloak access tokens may omit the `aud` claim by default. The backend **requires**
`aud == OIDC_AUDIENCE` and returns 401 (with a warning log) when it is missing.

Add the mapper using the **"Included Custom Audience"** free-text field (no second
Keycloak client is needed):

1. `Clients` → `<your-spa-client>` → `Client scopes` → `<client>-dedicated` → `Mappers`
2. `Add mapper` → `By configuration` → `Audience`
3. `Included Custom Audience`: `opreports-api` (the value of `OIDC_AUDIENCE`)
4. `Add to access token`: `ON`

> Do **not** use "Included Client Audience" here unless you also create a separate
> backend client; "Included Custom Audience" is the free-text field that sets `aud`
> directly.

### 4. Users

Users are auto-provisioned on first login (default role `VIEWER`). The seed script
does **not** create users. To grant a human an elevated role, insert a `user_roles`
row after their first login (or assign via your own tooling).

---

## Environment variables

### Backend (`backend/.env`, copy from `.env.example`)

| Variable              | Required | Example                                              |
| --------------------- | -------- | ---------------------------------------------------- |
| `KEYCLOAK_ISSUER_URL` | yes      | `http://localhost:8080/realms/opreports`             |
| `KEYCLOAK_CLIENT_ID`  | no       | `opreports-spa`                                      |
| `OIDC_AUDIENCE`       | yes      | `opreports-api`                                      |
| `DATABASE_URL`        | yes      | `postgresql://user:pass@localhost:5432/opreports`    |
| `CORS_ORIGIN`         | yes      | `http://localhost:4200`                              |
| `PORT`                | no       | `3000`                                               |

Missing required variables fail fast at boot.

### Frontend (`frontend/src/environments/environment*.ts`)

| Key                 | Value                          |
| ------------------- | ------------------------------ |
| `keycloakUrl`       | `http://localhost:8080`        |
| `keycloakRealm`     | `opreports`                    |
| `keycloakClientId`  | `opreports-spa`                |
| `apiBaseUrl`        | `http://localhost:3000/api`    |

---

## Run both apps

### 1. Database: introspect + seed

```bash
cd backend
cp .env.example .env                # fill in the real DATABASE_URL
npm install
npm run prisma:pull                 # reconcile schema.prisma with the live tables (optional)
npm run prisma:generate
npm run db:seed                     # idempotent roles/permissions/mappings
```

### 2. Backend

```bash
cd backend
npm run start:dev                   # http://localhost:3000/api
```

### 3. Frontend

```bash
cd frontend
npm install
npm start                           # http://localhost:4200 (Angular dev server)
```

#### Dev proxy vs CORS

- **Primary dev path (proxy):** `frontend/proxy.conf.json` proxies `/api` →
  `http://localhost:3000` and is wired into `angular.json` `serve.options.proxyConfig`.
  To use it, set `apiBaseUrl` to `/api` in `environment.development.ts`.
- **Fallback (direct origin + CORS):** the default `apiBaseUrl` is the full
  `http://localhost:3000/api`; the backend enables CORS for `CORS_ORIGIN`
  (`http://localhost:4200`) with bearer tokens (no cookies).

Both paths work; the README ships with the direct-origin default and the proxy wired
for the alternative.

---

## Silent refresh caveat (third-party cookies)

The SPA uses `useSilentRefresh: true` with an iframe (`silent-refresh.html`). Some
browsers (Safari, and Chrome when third-party cookies are blocked) block that iframe.
This is **not fatal**: the HTTP interceptor performs a direct refresh-token exchange
on any 401, independently of the iframe, and forces re-login if refresh fails.
If iframe silent refresh is unreliable in your environment, either allow third-party
cookies for the Keycloak origin or switch to refresh-token rotation without an iframe.

---

## How to verify (end-to-end)

1. **Seed**: `cd backend && npm run db:seed` — re-running it twice must not error
   (idempotent upserts + `skipDuplicates`).
2. **Backend boot**: `npm run start:dev` — "Nest application successfully started".
3. **401 without token**:
   `curl -i http://localhost:3000/api/auth/whoami` → `401` with a standardized body
   `{ statusCode, message, error, timestamp, path }`.
4. **Health**: `curl http://localhost:3000/api/health` → `200 { "status": "ok" }`.
5. **Frontend login**: open `http://localhost:4200` → redirected to Keycloak → log in →
   redirected back through `/callback` → lands on `/dashboard`.
6. **whoami card**: the shell shows name/email and the whoami card lists roles and
   permissions (from Postgres).
7. **Forbidden**: log in as a non-`ADMIN` and open `/admin` → friendly "Forbidden" view.
8. **Token in header**: DevTools → Network shows `Authorization: Bearer <token>` on
   `/api/**` requests.
9. **No tokens in console**: no raw JWT is ever logged (request logger drops headers;
   only `sub` and error reasons are logged server-side).
10. **Automated checks**: `cd backend && npm run build && npm run lint && npm run test:e2e`
    and `cd frontend && npm run build && npm run lint`.

## Security notes

- PKCE is mandatory (`responseType: 'code'`, public client, no client secret).
- Backend validates `iss` **and** `aud`; tokens from other issuers are rejected.
- Roles/permissions are always resolved from Postgres, never from Keycloak roles.
- `helmet` and rate limiting (10 req/min/IP) are enabled on the backend.
- `Authorization` headers are redacted from request logs.
