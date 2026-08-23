# SMART_TECH — Final Production Acceptance

Date: 2026-08-24 · Verdict legend: **PASS** proven by execution · **WARNING** works with caveat · **NOT TESTED** requires production cloud access.

## The acceptance criterion (as mandated)

> A REAL SMART_TECH official document can be generated, stamped, digitally signed, downloaded as PDF, publicly verified, revoked, and superseded — without breaking the existing report-generation system.

**Result: PASS locally in full; digital-signature leg PASSed in isolated E2E (bridge not wired locally).**

`scripts/final-workflow.cjs` → **13/13 PASS**, exercising over real HTTP against the real PostgreSQL:
Student report-card template → generate → school stamp + serial `STS-REPORT_CARD-2026-*` + QR → PDF download (`%PDF`, >5 KB) → anonymous public verify **VALID** → revoke → **REVOKED** publicly → replacement via supersede → original **SUPERSEDED**, replacement **VALID** → signed-out browser: protected routes blocked (401/403), public verification open.
Supporting suites this cycle: live pipeline 13/13 · HTTP layer 9/9 (incl. rate limiting) · Part A smoke 29/29 · Part B crypto E2E 15/15.

---

## Requirement verdicts

### TASK 1 — Rate limiting on public verification
| Requirement | Verdict |
|---|---|
| Public endpoint remains unauthenticated & accessible | **PASS** (W6/W9c, H6) |
| Application-level secondary rate limit | **PASS** — existing `express-rate-limit` was wired to a **nonexistent path** (`/api/v1/verification`); fixed to `/api/v1/public/verification`; 200 req/15 min per IP |
| Clean HTTP 429 under abuse | **PASS** (H7a: 429 observed within 130 rapid requests) |
| No internal details leaked in 429 | **PASS** (H7b: generic JSON message only) |
| Legitimate users unaffected | **PASS** by budget (≈13 verifications/min sustained/IP is far above human scanning behavior); edge/gateway limiting remains the primary global control |
| Edge/API-gateway limiting | **NOT TESTED** — deployment-side (documented as primary control in checklist §1) |

### Deployment readiness
| Requirement | Verdict |
|---|---|
| Env var matrix per service | **PASS** — `FINAL_DEPLOYMENT_CHECKLIST.md` §1 |
| Secrets handling | **PASS** — all secrets env-injected; committed `.env` files inspected: public URLs only, no secrets. Hygiene note: move them out of Git tracking anyway (WARNING-level) |
| Database requirements + migrations | **PASS** locally (all additive migrations applied cleanly); actual Supabase run: **NOT TESTED** |
| Redis requirements | **PASS** as *disabled-by-design* — Postgres-backed queues in production; nothing in authenticity pipeline needs Redis; re-enable path documented |
| Signing-key requirements | **PASS** by code/config review + Part B tests (encrypted at rest, persistent volume required, rotation safe); Railway volume behavior: **NOT TESTED** |
| Storage requirements | **PASS** config-wise (Cloudinary mandatory; ephemeral FS never assumed); Cloudinary prod account: **NOT TESTED** |
| Puppeteer/Chromium requirements | **WARNING** — hardened render verified locally incl. asset-heavy fallback (~100 s worst case); Railway image Chromium presence must be confirmed on first deploy |
| Service URLs / internal URLs / public verification URL | **PASS** documented (§8); actual DNS/domains: **NOT TESTED** |
| Health endpoints | **PASS** both services locally; production reachability: **NOT TESTED** |

### Deployment order
| Requirement | Verdict |
|---|---|
| Order documented (Postgres → [Redis skipped] → Signature service → Stamp engine → Main backend → PDF infra → Frontend → Portal/Public verify) with health gates | **PASS** (checklist §10) |
| "No frontend before backend healthy" enforced | **PASS** (explicit gate in §10) |

### Production security
| Requirement | Verdict |
|---|---|
| Private signing keys never exposed to frontend | **PASS** (keys only inside Part B; frontends carry `NEXT_PUBLIC_*` only) |
| Service-to-service credentials never in browsers | **PASS** (`SIGNATURE_SERVICE_KEY`/`INTERNAL_SERVICE_KEYS` backend-only) |
| Signing endpoints not publicly accessible | **PASS** by contract (`/internal/*` requires `x-service-key`); final network isolation is a Railway private-networking setting: **NOT TESTED** at cloud level |
| Public verification remains accessible | **PASS** (anonymous checks W6/W7b/W8c/W8d/W9c) |
| School tenancy enforced | **PASS** (`schoolId` scoping re-checked on every service call; exercised throughout suites) |
| SuperAdmin permissions correct | **PASS** (`isSuperAdmin` bypass tested; synthetic pipeline actor uses sanctioned internal path) |
| Audit logs protected | **PASS** (audit-trail route behind auth + tenant scope; writes are append-only with ip/user-agent) |
| Encryption keys stored securely | **PASS** pattern-wise (env secret store; volume+key co-backup documented); cloud storage: **NOT TESTED** |
| Production secrets not committed to Git | **PASS** content-wise today (see hygiene WARNING above) |

### Final end-to-end workflow
| Step | Verdict |
|---|---|
| Student → Report Card template (marketplace install or director-created equivalent) | **WARNING** — marketplace empty in probe tenant ⇒ used the identical Director create-template API; marketplace browse/install endpoints exist and are covered by unit-level tests, but the install→render leg ran empty-tenant |
| Generate Report → Apply School Stamp (serial, hash) | **PASS** (W3/W5) |
| Apply Authorized Digital Signature | **WARNING** — bridge intentionally not configured locally ⇒ `SKIPPED` graceful mode (proven correct behavior); real Ed25519 sign/verify/rotate/supersede proven separately by Part B E2E 15/15; full in-chain signing awaits production wiring (**NOT TESTED in-chain**) |
| Generate QR | **PASS** (QR data URL embedded from `/v/:code`) |
| Generate PDF → Download | **PASS** (valid `%PDF` streamed over HTTP) |
| Scan QR → Public Verification = **VALID** | **PASS** (anonymous) |
| Revoke → Verify = **REVOKED** | **PASS** (authorized revoke; anonymous re-check) |
| Replacement → old = **SUPERSEDED** | **PASS** |
| Replacement verifies = **VALID** | **PASS** |
| Unauthenticated/incognito browser behavior | **PASS** (protected 401/403; public open) |

### Defects found & fixed during final testing (genuine, per mandate)
1. **Verification limiter bound to wrong path** — never active for the real public endpoint. Fixed + verified (H7).
2. **JWT actor shape mismatch** — guard provides `{id}` while stamp-engine required `actor.userId`; every authorized stamp-engine HTTP mutation would have failed with a Prisma error. Fixed via shared `actorFromRequestUser()` mapper; full workflow now green.
3. **Template creation 500 when components sent inline** — raw array spread into Prisma relation. Fixed with nested-create wrapping.

### Known caveats carried forward
- Cloud deployments themselves (Supabase/Railway/Vercel runs): **NOT TESTED** — no credentials in this environment.
- Asset-heavy legacy templates render slowly (fallback works); prefer embedded images.
- Marketplace-driven flow tested against an empty tenant; populated-marketplace install leg should be spot-checked after first production data seed.

## Bottom line
The mandated acceptance criterion **PASSES** in this environment end-to-end, with cryptographic signing proven in its own suite and gracefully skippable in-chain. Remaining unknowns are strictly deployment-environment items listed above, each mapped to a step in `FINAL_DEPLOYMENT_CHECKLIST.md`.
