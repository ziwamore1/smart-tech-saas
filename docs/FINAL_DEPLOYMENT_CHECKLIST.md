# SMART_TECH — Final Production Deployment Checklist

Target topology: **Supabase** (PostgreSQL) · **Railway** (APIs) · **Vercel** (frontends)
Companion documents: `PRODUCTION_INTEGRATION_MAP.md`, `FINAL_PRODUCTION_ACCEPTANCE.md`

---

## 1. Required Environment Variables

### Main Backend (Railway)
| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase **pooled** connection string |
| `DIRECT_URL` | ✅ | Supabase **direct** connection (migrations) |
| `JWT_SECRET` | ✅ | Auth token signing |
| `CLOUDINARY_CLOUD_NAME` / `API_KEY` / `API_SECRET` | ✅ | Document/asset storage (local-disk fallback is NOT viable on Railway) |
| `STAMP_DEFAULT_TIMEZONE` | recommended | Defaults `Africa/Lusaka` (CAT) |
| `VERIFICATION_PUBLIC_BASE` or equivalent base used for `/v/:code` links | recommended | Absolute URL embedded in QR codes — must be the PRODUCTION frontend domain |
| `SIGNATURE_SERVICE_URL` | optional* | Enables cryptographic signatures; omit ⇒ stamp-only mode |
| `SIGNATURE_SERVICE_KEY` | with URL | Internal service credential |
| `SIGNATURE_SERVICE_TIMEOUT_MS` | optional | Bridge timeout |
| `REDIS_URL` | ❌ disabled | See §3 — Postgres-backed queues in use; enable later if a cost-effective provider is chosen |
| `SENTRY_DSN` | optional | Error tracking |

\* The platform is fully functional without Part B: issuance/verification/QR/stamp all work; `signatureStatus = SKIPPED`.

### Digital Signature Service (Railway, private service)
| Variable | Required |
|---|---|
| `DATABASE_URL` (Postgres when migrated from SQLite) / `SIG_DATA_DIR` persistent volume | ✅ |
| `SIG_JWT_SECRET` | ✅ |
| `SIG_ENCRYPTION_KEY` | ✅ — key-encryption key; losing it loses all signing keys |
| `INTERNAL_SERVICE_KEYS` | ✅ — `<keyId>:<secret>` pairs accepted by main backend |
| `PORT` (=4001 locally) | ✅ |

### Frontends (Vercel)
`NEXT_PUBLIC_API_URL`, portal additionally `NEXT_PUBLIC_SOCKET_URL`; signature UI scaffold: `NEXT_PUBLIC_DSIG_API_URL`.
**Only `NEXT_PUBLIC_*` values ever reach the browser.**

## 2. Required Secrets (never in Git)
- `JWT_SECRET`, `SIG_JWT_SECRET` — strong random (≥32 chars).
- `SIG_ENCRYPTION_KEY` — store in Railway/Vercel secret store; back it up in the same vault as database backups (see §9).
- `INTERNAL_SERVICE_KEYS`, `SIGNATURE_SERVICE_KEY` — rotate via documented rotation procedure (`AUTHENTICATION_PLATFORM.md`); rotation keeps old records verifiable.
- `CLOUDINARY_API_SECRET`.
- Verified this cycle: no `.env` file containing secrets is tracked in Git (committed env files contain public URLs only). Keep it that way.

## 3. Database Requirements
- PostgreSQL 14+ (Supabase). Migrations auto-apply on backend boot (`prisma migrate deploy` in Dockerfile CMD) — all stamp-engine/auth-platform migrations are additive.
- **Queues run on Postgres while Redis is disabled.** Ensure default `statement_timeout`/pool limits accommodate queue polling; use the pooled connection for app traffic and `DIRECT_URL` for migrations.
- Tenancy: every authenticity row carries `schoolId`; all access paths re-check ownership (verified).

## 4. Redis Requirements
**Currently DISABLED in production** (Upstash cost/predictability). Impact:
- Caching features degrade gracefully; queues already moved to Postgres.
- If re-enabled later: set `REDIS_URL`, confirm `[RedisProvider] connected` at boot, and load-test before enabling for hot paths. Nothing in the authenticity pipeline requires Redis.

## 5. Signing-Key Requirements
- Ed25519 keys generated inside Part B at first boot per org; encrypted at rest with `SIG_ENCRYPTION_KEY`.
- `SIG_DATA_DIR` MUST be a persistent Railway volume (or Postgres storage after migration) — ephemeral storage destroys key material.
- Private keys never leave Part B; only public keys are served, internal-only endpoint.

## 6. Storage Requirements
- Cloudinary account with adequate bandwidth for PDFs (folder `system/render-templates` among others).
- No filesystem persistence assumed anywhere (Railway/Vercel ephemeral FS).

## 7. Puppeteer / Chromium Requirements
- Railway backend image must include Chromium + fonts (Dockerfile installs them; verify build once).
- Rendering hardened: `networkidle0`(30 s) → `domcontentloaded`(60 s) fallback; asset-heavy templates succeed but slowly (~100 s worst case) — prefer embedded images in templates.

## 8. Service URLs
| URL | Where set |
|---|---|
| Public site + `/v/[code]` verification page | Vercel domain → set as `VERIFICATION_PUBLIC_BASE` on backend |
| Main API | Railway → `NEXT_PUBLIC_API_URL` on both frontends |
| Signature service (internal) | Railway private networking → `SIGNATURE_SERVICE_URL` on backend. **Never expose publicly / never put in frontends.** |

## 9. Health Endpoints
| Service | Endpoint | Expect |
|---|---|---|
| Main backend | `GET /api/v1/health` | 200 JSON |
| Signature service | `GET /health` | `{status:'ok',service:'digital-signature'}` |

## 10. Deployment Order (strictly sequential; wait for green health at each step)
1. **PostgreSQL (Supabase)** — project up; pooled + direct URLs noted; PITR/backups enabled.
2. **Redis** — skipped (disabled). Revisit only if a provider is approved.
3. **Digital Signature Service** — deploy with volume + secrets; check `/health`. (Optional if starting stamp-only.)
4. **Stamp Engine** — ships inside main backend image; nothing separate to deploy; verified via migration logs + smoke suites.
5. **Main Backend** — deploy; watch `prisma migrate deploy` succeed; check `/api/v1/health`; verify `SIGNATURE_SERVICE_*` reachability if Part B deployed.
6. **Report/PDF infrastructure** — confirm Chromium present in image; render one test PDF (see §12 workflow).
7. **Frontend** — deploy school web app AFTER backend healthy; verify login + stamps dashboard loads data.
8. **Portal / Public verification** — deploy portal + confirm anonymous `/v/[code]` resolves against production API.

Do **not** deploy step n+1 before step n reports healthy.

## 11. Rollback Procedure
1. **Frontends**: Vercel instant rollback to previous deployment (UI/API mismatch is the usual trigger).
2. **Main backend**: Railway "Redeploy" previous successful build. Migrations are additive — an older image keeps working against newer schema; do NOT attempt to roll back migrations.
3. **Signature service**: redeploy previous build; key volume is untouched — old signatures remain verifiable.
4. **Supabase**: point-in-time restore is last resort; additive migrations make it unnecessary for app rollbacks.
5. After any rollback, re-run §12 workflow to confirm VALID/REVOKED/SUPERSEDED behavior.

## 12. Backup Procedure
- **Supabase**: enable automated daily backups + PITR. Contains all business data incl. `DocumentVerification`, audit trail, serial counters.
- **Signature service**: back up the `SIG_DATA_DIR` volume AND `SIG_ENCRYPTION_KEY` together (encrypted backups useless without the key, and vice versa). Losing either invalidates future verification of existing signatures.
- **Cloudinary**: vendor-managed durability; record account recovery contacts.
- Restore drill: quarterly, restore Supabase backup into staging + attach a copy of sig volume; run `scripts/final-workflow.cjs` equivalents.

## 13. Pre-flight Verification (run after every full deploy)
1. Both health endpoints 200.
2. `npx prisma migrate status` clean (via Railway shell or CI job).
3. Full workflow test (§ FINAL_PRODUCTION_ACCEPTANCE): generate → stamp → QR → PDF → public VALID → revoke → REVOKED → replacement → SUPERSEDED/VALID.
4. Anonymous browser: protected routes 401/403; `/v/[code]` works.
5. Rate limit: >200 rapid public verifications from one IP produce clean 429.
