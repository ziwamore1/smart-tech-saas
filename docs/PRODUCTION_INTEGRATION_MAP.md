# SMART_TECH — Production Integration Map (Digital Document Authenticity Platform)

> Status: **Integration-complete** (see `PRODUCTION_ACCEPTANCE_REPORT.md` for live test evidence).
> Scope: how every component of the authenticity platform integrates with the wider SMART_TECH system,
> and what production (Supabase / Vercel / Railway) requires.

---

## 1. Component Inventory & Responsibilities

| Component | Location | Responsibility | Runtime deps |
|---|---|---|---|
| **Main API backend** ("Part A") | `/backend` (NestJS, port 3001) | All business features + **Stamp Engine** (templates, issuance/finalize, public verification, audit trail, permissions) | PostgreSQL (Supabase in prod), Redis (caching), Cloudinary (assets), Puppeteer (PDF) |
| **School web app** | `/frontend` (Next 14) | Staff UI incl. Digital Stamps hub (`/dashboard/digital-stamps`, issue page, designer) + public verify page `/v/[code]` | Part A REST |
| **Staff portal mirror** | `/frontend/apps/app-portal` (Next 14) | Byte-identical copy of stamp UI for the portal build target | Part A REST |
| **Digital Signature service** ("Part B") | `/digital-signature/backend` (NestJS, port 4001) | Ed25519 cryptographic signing of document hashes; key lifecycle; internal-only REST | SQLite (dev) → PostgreSQL (prod-ready path below); persistent key store volume |
| **Part B frontend scaffold** | `/digital-signature/frontend` (Next 14, standalone Docker build) | Optional dedicated verify UI for the signing service | Part B REST |

## 2. Integration Points (how the platform touches the existing system)

### 2.1 Report rendering pipeline (Phase 6 wiring — LIVE)
- `TemplateRendererService.renderPdf()` (`backend/src/report-template-builder/template-renderer.service.ts`)
  calls `maybeAttachAuthenticity(schoolId, templateId, data)` before HTML assembly.
- If the `ReportTemplate.includeStamp === true`:
  1. Feature-lock entitlement check (`school.subscriptionTier`),
  2. `VerificationService.finalize()` issues serial + hash + QR + stamp SVG (**one** `DocumentVerification` row),
  3. Placeholders injected as `data.authenticity`: `{{digital_stamp}} {{document_serial}} {{verification_qr}} {{document_hash}} {{issued_date}} {{issued_timestamp}} {{digital_signature}}`.
- **Failure policy**: any error ⇒ `logger.warn("Authenticity skipped …")` and rendering continues WITHOUT tokens. A broken authenticity subsystem can never block report generation or fake-authenticate a document.
- System actor used by the pipeline: `{ userId: 'report-pipeline', roles: [], isSuperAdmin: true }` (permission catalog has no role-name bypass; super-admin flag is the sanctioned internal path).

### 2.2 Legacy decorative stamps (parallel system — untouched)
`DigitalStamp`/`TemplateStamp`/`StampVerification` models + `digital-stamp.service.ts` overlay injection remain fully functional. The new platform is additive; no legacy behavior was modified.

### 2.3 Internal signing contract (Part A ⇄ Part B)
- `POST /internal/signatures/sign`, `POST /internal/signatures/verify`,
  `GET /internal/signatures/public-key/:keyId` — authenticated by `x-service-key`
  (constant-time compare; accepts `<secret>` or `<id>:<secret>`).
- Canonical payload: deep stable stringify of `{orgId, docType, docHash, issuedAt, metadata}`.
- Bridge degrades gracefully: if `SIGNATURE_SERVICE_URL` unset/unreachable ⇒ **stamp-only mode**
  (finalize still succeeds; `signatureStatus = SKIPPED`). Proven live.
- Rotation: `POST /internal/keys/rotate` returns `{rotatedFrom, activeKey}`; old records stay verifiable via pinned `publicKey`.

### 2.4 Public verification
- API: `GET /api/v1/public/verification/:code` (anonymous, safe-metadata payload only — no documentData, no signature blobs).
- Web: `/v/[code]` page in BOTH frontends (mirrored).

### 2.5 Permissions & tenancy
- Catalog `DOCUMENT_STAMP_*` + `DOCUMENT_REVOKE`; role defaults in `stamp-engine.types.ts`
  (`Director`, `Head Teacher`, `Admin` ⇒ all; `Deputy` partial; teachers view/verify only).
- Every service method re-checks ownership via `schoolId` scoping (`getOwned`) — tenant isolation enforced at data-access layer.

## 3. Database (Supabase production notes)

Migrations (all additive, applied & verified locally):
1. `20260823000000_stamp_engine_authenticity` — `StampTemplate`, `StampAsset`, `DocumentSerialCounter`, `DocumentVerification`, `DocumentApprovalConfig`, `DocumentAuditLog` (+ indexes)
2. `20260823200000_auth_platform_unified` — `SigningKey`, `SignatureRecord`, `AuthVerificationEvent` (Part B domain, mirrored in Part A schema for Part-A-side reads)
3. Earlier `20260819_grade_scale_float_boundaries`.

**Railway deploys auto-run `prisma migrate deploy` (backend Dockerfile CMD).** For Supabase use the pooled connection string in `DATABASE_URL` and the direct one in `DIRECT_URL`. No destructive operations exist in any stamp-engine migration.

**Part B storage**: dev uses SQLite file. For production Postgres: switch `provider = "postgresql"` in `digital-signature/backend/prisma/schema.prisma` and run `npx prisma migrate dev --name init_postgres` ONCE against the new database to generate the baseline (non-destructive; local `dev.db` remains untouched). Keep keys in the `sig_data` volume / managed secret, never in the DB alone.

## 4. Environment Variable Checklist (production)

### Part A (Railway backend)
| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` / `DIRECT_URL` | ✔ | Supabase pooled / direct |
| `JWT_SECRET` | ✔ | existing |
| `CLOUDINARY_*` | ✔ | asset uploads (falls back to local disk otherwise — NOT viable on Railway ephemeral FS) |
| `STAMP_DEFAULT_TIMEZONE` | recommended | defaults `Africa/Lusaka` (CAT) |
| `VERIFICATION_PUBLIC_BASE` / `VERIFICATION_URL_BASE` | recommended | absolute base for `/v/:code` links inside QR payloads |
| `SIGNATURE_SERVICE_URL` | optional | enables cryptographic mode; absent ⇒ stamp-only |
| `SIGNATURE_SERVICE_KEY` | w/ URL | internal service key |
| `SIGNATURE_SERVICE_TIMEOUT_MS` | optional | default sane timeout |
| Redis URL | optional | caching only; system functions without it |

### Part B (Railway service, opt-in `authenticity` profile in root compose)
`SIG_JWT_SECRET`, `SIG_ENCRYPTION_KEY`, `INTERNAL_SERVICE_KEYS`, `SIG_DATA_DIR` (persistent volume!), `PORT=4001`. Health probe: `GET /health`.

### Frontends (Vercel)
`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_DSIG_API_URL` (portal/sig UI only). **Never** expose signing keys or service keys to the browser.

## 5. Exposure Matrix

| Surface | Public? | Guard |
|---|---|---|
| `/api/v1/public/verification/:code` | YES | none by design — rate-limit at edge/proxy recommended (finding R-3) |
| `/v/[code]` pages | YES | static shell + anonymous fetch |
| `/api/v1/stamp-engine/*`, `/template-builder/*` | NO | JWT + role permission + tenant scope |
| Part B `/internal/*` | NO | `x-service-key`; do NOT expose through router (bind internal / Railway private network) |
| Part B `/health` | YES (harmless) | liveness only |

## 6. Failure Behavior Summary (verified)

| Failure | Behavior |
|---|---|
| Bridge unconfigured/down | Stamp-only finalize succeeds; `SKIPPED` signature state (proven live) |
| Authenticity pipeline throws during render | Warn + render without tokens (proven live) |
| Invalid `status` query on documents list | Ignored safely post-hardening (was Prisma 500) — fix committed |
| Serial allocation race | Atomic SQL upsert counter — 5-way concurrent burst produced unique serials/codes (proven live) |
| Audit log write failure | Logged, primary operation unaffected |
| Puppeteer navigation hang (asset-heavy templates) | `networkidle0` 30s → `domcontentloaded` fallback; render succeeds with embedded content only (fixed & verified live) |

## 7. Timezone Policy
Storage always UTC (`stampedAt`). Display fields (`stampDate`, `stampTime`) formatted per
`resolveTimezone(input.timezone)` with default **Africa/Lusaka (CAT)**; labels map CAT/SAST/EAT.
Override per request via `timezone` input; global override via `STAMP_DEFAULT_TIMEZONE`.

## 8. Regression Suites
- Part A: `npx tsx scripts/stamp-engine-smoke.ts` → **29 checks**
- Part A live: `node scripts/acceptance-live.cjs` → **13 checks** (real DB + Puppeteer)
- Part A HTTP: `node scripts/acceptance-http.cjs` → **7 checks** (auth/RBAC/PDF/public)
- Part B: `node scripts/e2e.mjs` (in `digital-signature/backend`) → **15 checks**

Run all four after any change to the stamp engine, auth pipeline, or renderer wiring.
