# Digital Document Authenticity Platform — Architecture Map

> Phase 1 deliverable. Documents what exists in SMART_TECH today and what is reused vs newly
> built for the Digital Stamp Engine (Part A) and Digital Signature Service (Part B).

## 1. Existing infrastructure — REUSED (never duplicated)

| Concern | Existing asset | Location | Reuse strategy |
|---|---|---|---|
| Authentication | `JwtAuthGuard` → `req.user { id, schoolId, roles[], platformRoles[], schoolRoles[], isSuperAdmin }` | `backend/src/auth/guards/jwt-auth.guard.ts` | Stamp engine endpoints use it directly |
| Role authorization | `RolesGuard`, `@Roles()` decorator (JWT fast path + DB fallback) | `backend/src/auth/guards/roles.guard.ts` | Director/Head Teacher defaults for stamp permissions |
| Granular permissions | `UserPermissionOverride` (per `SchoolUser` membership) already used by class-access | `prisma` model + `src/common/access/class-access.service.ts` | New `DOCUMENT_STAMP_*` permission keys checked through the same table — no new permission system |
| Subscription gating | `FeatureLockService.checkAccess(schoolId, key)` tiers BASIC/STANDARD/PREMIUM; existing keys `stamps.view/apply/create/verify/signatures/blockchain/approvals` | `backend/src/feature-lock/feature-lock.service.ts` | Additive keys only (`stamps.designer`, `stamps.qrVerification`, `stamps.serials`, `stamps.revocation`) |
| File storage | `CloudinaryService.upload/uploadBuffer/delete` with local fallback | `backend/src/cloudinary/cloudinary.service.ts` | Stamp assets, signature assets, rendered stamp PNG/SVG |
| PDF pipeline | Puppeteer + Handlebars (`TemplateRendererService.renderPdfFromHtml/renderPdf`) | `backend/src/report-template-builder/template-renderer.service.ts` | Finalized documents render through the same pipeline; no `window.print()` |
| QR codes | `qrcode` npm lib; base URL from `VERIFICATION_URL` env | `backend/src/qr-service/qr.service.ts` | Same lib + URL base for serial-based QR |
| Queues/workers | BullMQ global `QueuesModule` + centralized `RedisProvider`; private Railway Redis in production | `backend/src/queues/redis.config.ts` | Batch stamping and background jobs use the same REDIS_URL |
| DB | Prisma + PostgreSQL (Supabase in prod), timestamped SQL migrations | `backend/prisma` | Additive models + one migration folder |
| Existing stamp models | `DigitalStamp`, `TemplateStamp`, `StampVerification`, `DocumentStamp`, `ApprovalRequest/Workflow/Step/AuditLog`, `DocumentSignature`, `DigitalSignature` | schema.prisma:3649-3930 | Kept untouched for backward compatibility; new engine composes alongside |
| Report templates | `ReportTemplate` (+components, layoutJson, version fields) | schema.prisma:2139 | Authenticity tokens resolved at render time |
| Public verification page | `frontend/app/verify/[hash]/page.tsx` | frontend | Extended to resolve serial numbers / short codes |

## 2. What was missing → built now

### Runtime infrastructure

- PostgreSQL is the authoritative persistent database.
- Redis is a disposable production infrastructure layer for BullMQ, caching, rate limiting, sessions/state, and future real-time fan-out where required.
- Railway deploys Redis as a separate private `smarttech-redis` service. The API and future `smarttech-worker` receive its `REDIS_URL` through Railway reference variables.
- Business logic is provider-agnostic: moving Redis to another private managed service requires changing `REDIS_URL`, not application code.

1. **Layer-based `StampTemplate`** with JSON config (canvas/shape/rings/layers/effects),
   draft→published→archived lifecycle, immutable `StampTemplateVersion` snapshots + rollback.
   The old `DigitalStamp.svgContent` flow remains functional but is not configurable per-layer.
2. **`StampAsset`** — institution-uploaded logos/emblems/coats of arms (PNG/SVG/WebP, transparency preserved). No bundled government insignia.
3. **Authoritative timestamps** — `stampedAt`, `timezone`, visual `stampDate`/`stampTime` generated server-side (default `Africa/Lusaka`). Never client-supplied.
4. **Serial numbers** — `SerialSequence` atomic row (`UPDATE … RETURNING`) + unique `DocumentSerial.serialNumber`. Configurable prefix/type/year/padding. Concurrency-safe.
5. **Canonical document hashing** — deterministic canonical JSON → SHA-256 (`DocumentHashService`). Hash stored in `DocumentVerification`; recomputed if payload changes (versioning, never silent mutation).
6. **QR verification** — QR encodes short opaque code (`/{code}`) not sensitive data; resolves via public endpoint.
7. **Public verification service** — unauthenticated `GET /api/v1/public/verification/:code` returning only safe metadata (status VALID/REVOKED/EXPIRED/SUPERSEDED/INVALID).
8. **Revocation** — status change with immutable audit entry (who/when/reason/before/after).
9. **Permissions** — `DOCUMENT_STAMP_VIEW/CREATE/EDIT/DELETE/APPLY/APPROVE/VERIFY/REVOKE` catalog; role defaults (Director/Head Teacher/Admin) overridable via `UserPermissionOverride`.
10. **Configurable approval workflows** — `ApprovalWorkflowConfig` per school/documentType (JSON steps); replaces hardcoded step creation for new flows while legacy workflows keep working.
11. **Audit logging** — `DocumentAuditLog` for SIGNATURE_*, STAMP_*, DOCUMENT_* actions incl. IP/user-agent where available.
12. **Template authenticity placeholders** — `{{digital_stamp}} {{digital_signature}} {{document_serial}} {{verification_qr}} {{document_hash}} {{issued_date}} {{issued_timestamp}}` resolved by the renderer when callers inject an authenticity context.

## 3. New Prisma models

```
StampTemplate        school-scoped designer template (configJson layers)
StampTemplateVersion immutable config snapshots (rollback support)
StampAsset           uploaded logo/emblem/coat-of-arms/signature graphics
SerialSequence       atomic per-school counters (unique [schoolId, scopeKey])
DocumentSerial       issued serial number (unique serialNumber)
DocumentVerification finalized record: hash, serial, status, stampedAt/tz, qr token, template snapshot
ApprovalWorkflowConfig  per-school configurable approval chains
DocumentAuditLog     security-sensitive action trail
```

All are additive; School gains back-relations; User relations avoided (plain id columns like existing models) to minimize migration risk.

## 4. Module layout

```
backend/src/stamp-engine/
├── stamp-engine.module.ts
├── stamp-engine.controller.ts          (authed: templates/assets/apply/finalize/revoke)
├── public-verification.controller.ts   (unauthenticated, rate-limit friendly)
├── dto/
├── stamp-permission.service.ts         DOCUMENT_STAMP_* catalog + checks
├── stamp-template.service.ts           CRUD + publish/version/rollback/default
├── stamp-asset.service.ts              Cloudinary upload, PNG/SVG/WebP validation
├── stamp-renderer.service.ts           layer-based SVG renderer (shapes, rings,
│                                       curved text, images, date/serial, effects)
├── serial-number.service.ts            atomic allocation + format policy
├── document-hash.service.ts            canonical JSON + SHA-256
├── verification.service.ts             finalize/verify/revoke/supersede/expiry
└── approval-config.service.ts          per-school workflow configuration
```

## 5. Workflow

```
Draft → Preview → Review (approval config) → Sign (existing signing-service) 
      → Apply Stamp Engine finalize:
          serial (atomic) → canonical hash → QR(short code) → DocumentVerification(VALID)
          → audit log → PDF via Puppeteer → store
Finalized docs are immutable: material changes create a NEW version/hash/serial per policy;
previous record becomes SUPERSEDED (audit kept).
```

## 6. Security model

Visual stamp = institutional representation only.
Authenticity = identity + authorization + SHA-256 integrity + unique serial + audit trail +
public verification endpoint + tenant isolation (school/org scoped queries everywhere).
Legal disclaimer text is institution-configurable ("Digitally issued and electronically verified document.").

## 7. Part B — SMART_TECH Digital Signature Service (independent)

`digital-signature/backend` (Express + own Prisma schema: Organization/OrgUser/DigitalSignature/
SignatureVersion/SignatureUsage/AuditLog/ApiKey) and `digital-signature/frontend` (Next.js).
Own JWT auth; SMART_TECH SSO via signed service tokens exchanged with API keys — **no shared DB
credentials**. Signature processing pipeline uses sharp (grayscale → threshold → alpha transparency,
trim, normalize) preserving handwriting characteristics; uploaded-handwritten vs generated-style
assets are explicitly distinguished.

## 8. Phases

1 ✅ Inspect (this document) · 2 ✅ Templates/designer/renderer · 3 ✅ Serial+hash+QR+public verify ·
4 ✅ Template placeholders · 5 ✅ Permissions/revocation/audit/approval-config ·
6–7 ✅ Independent service scaffold + processing pipeline · 8 ✅ Premium feature-lock keys ·
9 ⏳ Full test matrix (unit tests included; e2e against live DB to be run in staging)

## Delivered Implementation (Part A + Part B)

### Part A — Stamp Engine (main backend)
- backend/src/stamp-engine/ (11 services/controllers/module) wired in app.module.ts
- Prisma models: StampTemplate(+Version), StampAsset, SerialSequence, DocumentSerial, DocumentVerification, ApprovalWorkflowConfig, DocumentAuditLog; migration 20260823000000
- Public verification: GET /api/v1/public/verification/:code (no auth, no-store)
- Feature gates: stamps.designer / stamps.serials / stamps.qrVerification / stamps.revocation (PREMIUM)
- Frontend (frontend/app AND frontend/apps/app-portal): lib/api.ts stampEngineApi, dashboard/digital-stamps/designer (live server-rendered preview), app/v/[code] public verify page, hub Designer link

### Part B — Independent Digital Signature Service (digital-signature/)
- NestJS + Prisma SQLite service on :4001. Org tenancy (register/login JWT), Ed25519 keypairs (private key AES-256-GCM at rest), canonical SHA-256 detached signatures, verify/revoke/supersede, audit log, public GET /public/verify/:idOrHash
- Frontend: minimal Next.js (login/sign/verify) using fetch + localStorage token
- Verified end-to-end: register -> keygen -> sign -> public verify VALID -> revoke -> verify REVOKED

---

## Integration Phase (Unified Document Authentication Pipeline)

See docs/AUTHENTICATION_PLATFORM.md for the full reference.

### Cross-service integration
- Internal contract (only egress): POST /internal/signatures/{sign,verify}, GET /internal/signatures/public-key/:keyId
  - Auth: x-service-key header, constant-time checked against INTERNAL_SERVICE_KEYS ("id:secret" pairs)
  - Correlation: x-correlation-id propagated end-to-end into both audit logs
- Part A bridge: backend/src/stamp-engine/signature-bridge.service.ts (env-gated; graceful stamp-only degradation)
- Canonical model: backend/src/stamp-engine/canonical-payload.service.ts (recursive stableStringify -> SHA-256; payload binds documentId/version/serial/code/stampInstanceId/contentHash/sorted signers/templateVersion)

### New Part A models (migration 20260823200000_auth_platform_unified)
- StampInstance: immutable snapshot of the exact rendered stamp (configSnapshot, renderedSvgHash)
- DocumentAuthentication: PENDING|VALID|EXPIRED|REVOKED|SUPERSEDED|FAILED; originalHash/finalHash/finalPdfHash; signaturesJson[]; pipelineTrace{correlationId,steps}; verificationCount/lastVerifiedAt
- AuthVerificationEvent: every public lookup recorded incl. NOT_FOUND (channel PUBLIC|INTERNAL|PORTAL)

### Orchestration saga
- authentication-pipeline.service.ts: prepare/issue/revoke/supersede/trackPublicVerification/auditTrail
  - Ordering law: content -> stamp persisted (StampInstance) -> canonical hash embeds stampInstanceId -> Ed25519 per signer over SAME finalHash -> VALID
  - Failure at any step => status FAILED + PIPELINE_FAILED trace step; nothing half-valid is exposed

### Key lifecycle (Part B)
- SigningKey ACTIVE->ROTATED->REVOKED; every Signature pins publicKey+keyId so history stays verifiable across rotation
- VisualSignatureAsset model separates polished handwritten images (presentational) from cryptographic Signature rows (proof)

### Endpoints added
- Main backend /api/v1/stamp-engine/document-authentication/*: capabilities, prepare, issue, records, :idOrSerial (+pipeline-trace), revoke (DOCUMENT_REVOKE), supersede
- Frontend (both trees): dashboard/digital-stamps/issue "Issue Official Document" page + upgraded institutional portal /v/[code] with separate digital-signature vs stamp status pills

### Deployment & docs
- docker-compose.yml root: opt-in --profile authenticity signature-service; backend gains SIGNATURE_SERVICE_* env
- digital-signature/: standalone compose + Dockerfiles (backend+frontend) + .env.production.example
- Tests: Part A smoke 29 checks (npx tsx scripts/stamp-engine-smoke.ts); Part B E2E 15 checks (incl. rotation, tamper rejection, internal auth, multi-signer, verification events)
