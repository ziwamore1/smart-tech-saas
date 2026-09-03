# Digital Signature Service — Deployment Guide

This document covers deploying the **Digital Signature Service** (Part B) which
provides Ed25519 cryptographic signing, key lifecycle, and public verification
for SMART_TECH. It is the signing half of the Institutional Document
Authenticity Platform (the Digital Stamp Engine in the main backend is the
other half).

The Digital **Stamp** Service is already running. This guide puts the Digital
**Signature** Service into production so documents can carry both an
institutional stamp **and** a cryptographic signature.

---

## 1. Architecture recap

```
Main backend :3001  ── SIGNATURE_SERVICE_URL ──▶  Digital Signature Service :4001
   (Stamp Engine)       (x-service-key header)        ── PostgreSQL (Organisation,
   SignatureBridgeService                             SigningKey, Signature, …)
```

- The **only** path from the main backend to this service is
  `SignatureBridgeService`, authenticated with `x-service-key`.
- If the signature service is unreachable/unconfigured, the main backend runs
  in **stamp-only** mode (`signatureStatus = SKIPPED`) — nothing breaks.
- Private signing keys are generated **inside** this service and encrypted at
  rest with `SIG_ENCRYPTION_KEY` (AES-256-GCM). Public keys are served via an
  internal-only endpoint.

---

## 2. Prerequisites

- Docker Engine + Docker Compose v2.
- A reachable **PostgreSQL 14+** (the compose defaults to a bundled
  `sig-postgres` container; the shared root compose uses its own `postgres`).
- Three secrets (generated once, stored securely, backed up — see §7):
  - `SIG_JWT_SECRET` — organisation-session JWT signing.
  - `SIG_ENCRYPTION_KEY` — 64 hex chars; encrypts signing keys **at rest**.
  - `INTERNAL_SERVICE_KEYS` — `id:secret` pairs for `x-service-key` auth.

---

## 3. Generating the secrets

```bash
# JWT secret (base64, long)
openssl rand -base64 48

# ENCRYPTION_KEY — EXACTLY 64 HEX CHARS (32 bytes). This key encrypts
# Ed25519 private keys. Losing it permanently breaks all existing signatures.
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4. Production database setup (PostgreSQL)

The service is pre-configured for PostgreSQL via `schema.postgres.prisma`
and ships a checked-in migration baseline under
`digital-signature/backend/prisma/migrations/`. On container start,
`prisma migrate deploy` applies it automatically — no manual DDL.

**Bundled Postgres (standalone compose, recommended):** the provided
`digital-signature/docker-compose.yml` starts its own `sig-postgres` and points
the service at it. Nothing else to do.

**Shared/root compose:** the root `docker-compose.yml` places the signature
tables in the same Postgres used by the main app (no name collisions —
signature tables are `Organisation`, `SigningKey`, `Signature`, `AuditLog`,
`VerificationEvent`, `VisualSignatureAsset`). To isolate, set `SIG_DATABASE_URL`
and `SIG_DIRECT_URL` to a dedicated DB.

> If you already ran the service against SQLite (`digital-signature/backend/.env`
> with `file:./dev.db`) and need to migrate that data to Postgres, contact the
> ops runbook — signing keys are encrypted with your `ENCRYPTION_KEY` and can be
> re-imported if the SQLite file is preserved.

---

## 5. Deploy

### 5a. Standalone Part B only (own Postgres + optional UI)

```bash
cd digital-signature

# 1. Create env from template and fill in the three secrets.
cp .env.production.example .env
#    edit .env — set SIG_JWT_SECRET, SIG_ENCRYPTION_KEY, INTERNAL_SERVICE_KEYS

# 2. Start the signature service (and its Postgres).
docker compose up -d --build

# 3. Health check.
curl http://localhost:4001/health
# → {"status":"ok","service":"digital-signature","timestamp":"..."}
```

### 5b. Full stack (root compose with the main backend + signature service)

```bash
# From the repo root.
# 1. Provide secrets in the root .env (used by `docker compose --profile authenticity`):
#    SIG_JWT_SECRET, SIG_ENCRYPTION_KEY, INTERNAL_SERVICE_KEYS
# 2. Ensure the main backend's SIGNATURE_SERVICE_KEY matches the
#    INTERNAL_SERVICE_KEYS entry (default prefix "stamp-engine:").

# 3. Bring up the stack including the signature service (Postgres + Redis boot first).
docker compose --profile authenticity up -d --build

# 4. Verify both health endpoints:
curl http://localhost:4001/health                 # signature service
curl http://localhost:3001/api/v1/health          # main backend
```

The main backend connects to the signature service at
`http://signature-service:4001` (the compose hostname on the shared network).

> ⚠️ The compose now **requires** `SIG_JWT_SECRET`, `SIG_ENCRYPTION_KEY` and
> `INTERNAL_SERVICE_KEYS`. The previous hard-coded placeholder defaults have
> been removed — deliberately. A fixed/predictable `SIG_ENCRYPTION_KEY` would
> encrypt every signing key with a widely-known key.

### 5c. Railway — single project (recommended to keep Hobby-plan costs flat)

Deploy the signature backend as a **second service inside the SAME Railway
project as the main backend** (e.g. `smarttech-prod`). No new Railway project,
no new paid database — storage reuses the external Postgres the main backend
already uses, so charges stay within the existing Hobby-plan credit envelope.

A `railway.toml` ships in `digital-signature/backend/` that pins the Dockerfile
builder, healthcheck (`/health`) and the migration+boot start command.

**1. Add the service (Railway dashboard)**
- Open `smarttech-prod` → **New → Service**.
- Choose **“Deploy from GitHub repo”** → select `ziwamore1/smart-tech-saas`.
- Root directory: set to **`digital-signature/backend`**.
- Railway detects `railway.toml` (Dockerfile builder) and pairs the service
  automatically. Create the service.

**2. Add the shared variables**
On the new service's **Variables** tab set:
```
DATABASE_URL=<your external Postgres URL with ?schema=signatures>
JWT_SECRET=<long random base64>
ENCRYPTION_KEY=<64 hex chars — generated once, backed up>
INTERNAL_SERVICE_KEYS=stamp-engine:<shared-secret>
NODE_ENV=production
```
- For the external Postgres (Supabase) URL, append **`?schema=signatures`** so
  the signature tables live in their own schema and never collide with the
  school schema. Prisma creates the schema on first `migrate deploy`.
  (Omitting `?schema=` also works — tables land in `public` under distinct
  names — but a dedicated schema is cleaner.)
- `ENCRYPTION_KEY` is the AES-256-GCM master key for signing keys **at rest**.
  Losing it permanently breaks all existing signatures. Backup it now.

**3. Enable private networking for the service**
- Variables → add **`RAILWAY_PRIVATE_DOMAIN=true`** (or Service Settings →
  Private Networking → enable private domain). Copy the generated private URL,
  e.g. `https://signature-service.up.railway.internal`.

**4. Point the main backend at it**
On the **main backend service** (`smart-tech-saas`) set these variables:
```
SIGNATURE_SERVICE_URL=<private URL from step 3, e.g. http://signature-service.up.railway.internal>
SIGNATURE_SERVICE_KEY=stamp-engine:<shared-secret>     # MUST equal INTERNAL_SERVICE_KEYS above
SIGNATURE_SERVICE_TIMEOUT_MS=15000
```
- `SIGNATURE_SERVICE_URL` must be the **private** `*.railway.internal` URL —
  never a public domain.
- Redeploy the main backend after adding these so it starts in
  **signature-enabled** mode (it will show `signatureStatus` other than
  `SKIPPED`).

**5. Verify**
- `GET <private-url>/health` → `{"status":"ok","service":"digital-signature",…}`
  (liveness only; it is never exposed publicly).
- From the main backend, run the stamp/sign smoke suite
  (`npx tsx scripts/stamp-engine-smoke.ts`) and confirm a cryptographic
  signature is produced and verifies.

> All three secrets above (`JWT_SECRET`, `ENCRYPTION_KEY`,
> `INTERNAL_SERVICE_KEYS`) plus the backend's `SIGNATURE_SERVICE_KEY` are set
> only in Railway's secret store — never in a committed `.env`.

---

## 6. Optional operator UI (Part B frontend)

A minimal Next.js issuer/verify UI ships in `digital-signature/frontend`.
The standalone compose wires it at `http://localhost:3100`. It is optional —
the signature service is fully usable through the internal API and the main
platform's stamp/sign pipeline.

---

## 7. Backup & recovery (critical)

- Back up **`SIG_ENCRYPTION_KEY` AND the database together.** They are a pair:
  - without the DB you cannot find signatures; without the key you cannot
    decrypt private keys to sign new documents or prove key material.
- If using a separate Postgres: use its standard backup (e.g. `pg_dump`).
- Store the key in your secret vault **and** an offline backup (same vault as
  database backups), per the platform disaster-recovery runbook.
- Restore drill: restore the DB to staging, attach the key, confirm
  `GET /signatures/keys` lists ACTIVE keys and a signature verifies.

---

## 8. Verification & smoke test (after every deploy)

```bash
# Part B self-check (15 checks) — expects a live server + seeded org:
#   E2E_EMAIL / E2E_PASSWORD from your .env; INTERNAL_SERVICE_KEYS exported.
cd digital-signature/backend
export INTERNAL_SERVICE_KEYS="stamp-engine:my-secret"
node scripts/e2e.mjs http://localhost:4001
# → ==== RESULT: 15 passed, 0 failed ====

# Main platform (29 checks) for the full stamp+sign pipeline:
cd backend
npx tsx scripts/stamp-engine-smoke.ts
```

Confirm the main stamp/issue flow now reports a **cryptographic signature**
(`signatureStatus` other than `SKIPPED`) and the public verification page shows
the signature as present/valid.

---

## 9. Rotating the service key

- **Internal service credential** (`INTERNAL_SERVICE_KEYS`): append a new
  `id:secret` pair, deploy, then remove the old pair. Both work during overlap.
- **Organisation signing keys**: `POST /signatures/keys/rotate`. Old signatures
  remain verifiable because each `Signature` row pins its own `publicKey`.

---

## 10. Rollback

- Redeploy the previous build/image. Migrations are additive — an older image
  works against the newer schema. Do **not** roll back the DB migrations.
- The main backend tolerates the signature service being down (stamp-only
  mode), so you can also deploy Part B independently at any time.

---

## 11. Security notes

- `/internal/*` endpoints are **only** reachable with a valid `x-service-key`
  and must never be published publicly or put behind the user-facing reverse
  proxy. Keep the service on an internal network.
- `GET /health` is the only unauthenticated endpoint (harmless liveness).
- Private keys: plaintext only in-process; encrypted AES-256-GCM at rest.
- Never put `SIG_*`, `INTERNAL_SERVICE_KEYS`, or `SIGNATURE_SERVICE_KEY` in a
  frontend or a committed `.env`.
