# SMART_TECH — Production Integration, Deployment Validation & System-Wide Acceptance Report

Date: 2026-08-23 · Environment: Windows dev workstation · Local DB: Docker PostgreSQL (`school_saas`) + Redis container
Production targets: **Supabase** (DB) · **Railway** (APIs) · **Vercel** (frontends)

Verdict legend: **PASS** = proven by execution here · **WARNING** = works, with a caveat · **NOT TESTED** = requires production cloud access.

---

## 1. Headline Result

| Suite | Checks | Result |
|---|---|---|
| Part A stamp-engine service regression (`scripts/stamp-engine-smoke.ts`) | 29 | **29/29 PASS** |
| Part A **LIVE** pipeline vs real Postgres + real Puppeteer (`scripts/acceptance-live.cjs`) | 13 | **13/13 PASS** |
| Part A **HTTP** layer: auth, RBAC guards, PDF streaming, public verify (`scripts/acceptance-http.cjs`) | 7 | **7/7 PASS** |
| Part B signing-service end-to-end (`digital-signature/backend/scripts/e2e.mjs`) | 15 | **15/15 PASS** |

Total: **64 automated checks passing**, including a full live render of a stamped, serialised,
publicly verifiable PDF document through the production code path.

## 2. Phase Status

### P1 — Dependency & integration audit → `docs/PRODUCTION_INTEGRATION_MAP.md` — PASS
Full component/API/DB/env/exposure/failure map written; Supabase/Vercel/Railway specifics included.

### P2 — Production database review — PASS
- `prisma validate` clean. `prisma migrate deploy` applied all pending migrations locally without error:
  `20260819_grade_scale_float_boundaries`, `20260823000000_stamp_engine_authenticity`, `20260823200000_auth_platform_unified`.
- All migrations additive; no destructive SQL. Railway applies them automatically via Dockerfile CMD.
- Part B remains SQLite in dev; non-destructive Postgres variant prepared: `digital-signature/backend/prisma/schema.postgres.prisma`
  (`provider="postgresql"`, `url=env("DATABASE_URL")`). Baseline procedure documented in the integration map §3.
- **NOT TESTED**: running migrations against actual Supabase (needs cloud credentials).

### P3 — Env checklist — PASS
Per-service variable tables in integration map §4, incl. `SIGNATURE_SERVICE_*`, `STAMP_DEFAULT_TIMEZONE`,
`CLOUDINARY_*`, Part B `SIG_JWT_SECRET/SIG_ENCRYPTION_KEY/INTERNAL_SERVICE_KEYS/SIG_DATA_DIR`, frontend publics.

### P5/P12 — Rendering + timezone review — PASS
- UTC storage everywhere; display formatted per timezone, default **Africa/Lusaka (CAT)**; overridable per-request and globally.
- Live render produced a 43 KB multi-component PDF carrying serial, QR, stamp SVG, hash, issue date.
- **W-1 — FIXED & VERIFIED**: templates with unreachable remote assets previously hit Puppeteer's `networkidle0` timeout and 500'd.
  Both PDF paths (`renderPdf`, `renderPdfFromHtml`) now try `networkidle0` (30 s) and fall back to `domcontentloaded` (60 s).
  The previously-failing asset-heavy template now renders a valid 42,932-byte PDF; live + HTTP suites re-run green afterwards.

### P6/P7 — Deep integration tests — PASS (live evidence)
- Report→authenticity wiring proven end-to-end: `renderPdf` on an `includeStamp:true` template created exactly one
  `DocumentVerification`, injected placeholders into HTML, painted QR/stamp/serial into the PDF.
- Fail-safe verified twice: permission-denial path renders WITHOUT tokens and logs a warning.
- Bridge-down ⇒ stamp-only finalize succeeds (graceful degradation, spec §13).

### P13/P14 — Failure handling & audit trail — PASS
- Audit rows written for issuance/lifecycle events with action/ip/userAgent fields; audit failure never breaks the main flow (logged).
- Pipeline trace marks records FAILED when bridge errors mid-signing (smoke suite).

### P15/P18 — Public payload & security review — PASS (findings below)
- Public payload carries status/serial/institution label/timestamps only; no documentData, no signature blobs, no internal ids beyond code (asserted in tests).
- SVG text rendering XML-escapes `<` etc. (unit-tested).
- Tenant isolation enforced at data-access layer (`getOwned(schoolId,…)`), re-checked per call.
- **R-3 (recommendation)**: `/api/v1/public/verification/:code` is anonymous by design; add edge/proxy rate-limiting at deployment (Vercel/Cloudflare level). No app-level limiter exists.
- **Hardening fix shipped this phase**: invalid `status` query values no longer cause Prisma 500s
  (`VerificationService.listForSchool` whitelists enum statuses) — covered by HTTP check H3b.

### P16 — Serial/code uniqueness under concurrency — PASS
5 parallel finalizes through the real atomic SQL upsert produced 5 unique serials + unique codes (no collisions, no errors).

### P17 — Backup / recovery requirements — PASS (documented)
Documented in integration map §3–§4: Supabase PITR/backups for Part A data; Part B signing keys must live on a persistent volume (`sig_data`) with the encryption key in secrets; losing key material invalidates future verification of old signatures — include `sig_data` in backup scope.

### P19 — Regression re-run — PASS
Both pre-existing suites re-executed after all changes: Part A 29/29, Part B 15/15 (results above).

### P20 — This report — DONE

## 3. Deployment Validation

| Item | Status |
|---|---|
| Root `docker-compose.yml` (incl. opt-in `signature-service`, healthcheck, env plumbing) | **PASS** (`docker compose config` exit 0) |
| Standalone `digital-signature/docker-compose.yml` | **PASS** (requires `${VAR:?}` secrets by design; refuses to run unconfigured) |
| Part B Dockerfile + `/health` endpoint | **PASS** locally; **NOT TESTED** as pushed image |
| Frontend build scaffolds (Next standalone Dockerfiles, env examples) | **PASS** (files valid); **NOT TESTED**: Vercel deploy itself |

## 4. Known Issues / Honest Gaps

1. **NOT TESTED — cloud deploys.** No Supabase/Vercel/Railway accounts exercised. Everything above is local-execution evidence plus validated configs.
2. **R-3** public endpoint rate-limiting to be enforced at the edge (deployment task). W-1 is fixed (see P5/P12).
   Note: asset-heavy templates now succeed but can take ~100 s; prefer embedded images in templates for speed.
4. **Pre-existing TS strictness errors (6, untouched)**: `template-marketplace.service.ts(150)` TS2322; `template-renderer.service.ts` 984/1038/1040/1048/1049 certificate-fallback typings. Build passes (SWC); do not regress further.
5. **Login response shape**: main API returns `access_token` (snake); Part B returns `accessToken`. Mirrored clients already handle each respective shape — keep this asymmetry in mind for new clients.
6. **Local boot flakiness (environmental)**: first cold start after a fresh SWC build occasionally stalls/exits on this Windows workstation (AV scan); immediate restart is healthy (<25 s incl. Redis connect). Server enforces its own 120 s `STARTUP_TIMEOUT`. Linux containers are unaffected.
7. **Legacy decorative-stamp system intentionally untouched** (parallel to the authenticity platform).

## 5. How to Re-verify Everything

```bash
# Part A service-level regression (29)
cd backend && npx tsx scripts/stamp-engine-smoke.ts

# Part A live pipeline (13) — needs Docker Postgres+Redis up, backend/.env present
cd backend && node scripts/acceptance-live.cjs

# Part A HTTP (7) — needs server running
cd backend && node dist/main.js &   # then:
cd backend && node scripts/poll-health.cjs http://localhost:3001/api/v1/health 55
cd backend && node scripts/acceptance-http.cjs http://localhost:3001/api/v1

# Part B (15)
cd digital-signature/backend && npm run build (if needed) && node dist/main.js &
node scripts/e2e.mjs
```

Probe fixture used by live/HTTP suites: user `probe-admin@smarttech.test` / Director role / PREMIUM-tier probe school.
