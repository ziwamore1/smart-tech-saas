# Institutional Document Authenticity Platform

Complete technical reference for document issuance, digital stamping, cryptographic signing,
and public verification in SMART_TECH.

---

## 1. Architecture Overview

Two logically independent services cooperate through a **secure internal API contract**.
Neither service shares a database or user sessions with the other.

```
┌──────────────────────────────────────────────────────────────────────┐
│                        MAIN PLATFORM (Part A)                        │
│  Next.js frontends (app + app-portal)                                │
│        │  /api/v1 (user JWT)                                         │
│  NestJS backend :3001                                                │
│    └─ stamp-engine module                                            │
│         ├─ AuthenticationPipelineService   ← orchestration saga      │
│         ├─ CanonicalPayloadService         ← canonical SHA-256       │
│         ├─ SignatureBridgeService ─────┐   ← ONLY egress to Part B   │
│         ├─ VerificationService         │                             │
│         └─ SerialNumberService …       │                             │
│  PostgreSQL: StampTemplate(+Version), StampInstance,                 │
│              DocumentVerification, DocumentAuthentication,           │
│              AuthVerificationEvent, DocumentAuditLog                 │
└──────────────────────────────────────┬───────────────────────────────┘
                                       │ POST /internal/signatures/*
                                       │ header: x-service-key (+ x-correlation-id)
┌──────────────────────────────────────▼───────────────────────────────┐
│                  DIGITAL SIGNATURE SERVICE (Part B)                  │
│  NestJS backend :4001 (independent deploy)                           │
│    ├─ ServiceAuthGuard (constant-time key check)                     │
│    ├─ SignaturesService                                              │
│    │    ├─ SigningKey lifecycle (ACTIVE→ROTATED→REVOKED)             │
│    │    ├─ Ed25519 sign/verify over canonical hashes                 │
│    │    └─ VerificationEvent tracking                                │
│    └─ AuthController (organisation tenancy, JWT)                     │
│  SQLite dev / Postgres prod: Organisation, SigningKey, Signature,    │
│  VisualSignatureAsset, VerificationEvent, AuditLog                   │
└──────────────────────────────────────────────────────────────────────┘

Public verification: GET /api/v1/stamp-engine/public/verification/{code}
                     → institutional portal page at /v/{code} (no login)
```

**Isolation rule:** Part B never receives user JWTs. The only trust boundary is
`x-service-key`. Part A degrades gracefully if Part B is unreachable — stamp-only
issuance still works and is recorded as such in `pipelineTrace`.

---

## 2. Crypto Model (§Crypto)

### 2.1 What is signed — CanonicalDocumentPayload

The signature never covers raw bytes of the PDF. It covers a **canonical JSON payload**
built by `CanonicalPayloadService`:

```jsonc
{
  "documentId": "uuid",
  "documentVersion": 1,
  "organizationId": "uuid",
  "documentType": "TRANSCRIPT",
  "serialNumber": "STU-TRN-2026-000123",
  "verificationCode": "a1b2c3d4e5",
  "issuedAt": "2026-08-23T10:15:30.000Z",     // server UTC time, fixed once
  "contentHash": "<sha256 pre-stamp content>",
  "stampInstanceId": "uuid",                  // binds the exact rendered stamp
  "signerIdentities": ["registrar@school"],   // sorted; order-invariant
  "templateVersion": 3
}
```

Canonicalisation = recursive stable stringify (object keys sorted at **every depth**;
array order preserved because it is semantically meaningful), then UTF-8 SHA-256.

Three distinct hashes are stored:

| Hash | Covers | Purpose |
|---|---|---|
| `originalHash` | pre-stamp source content | tamper evidence of source |
| `finalHash` (= canonical hash) | payload incl. `stampInstanceId` | what Ed25519 signs |
| `finalPdfHash` | final PDF bytes after stamping | file-level integrity check |

### 2.2 Ordering guarantee

Issuance is strictly ordered. A signature can never cover visuals that changed later:

```
content → stamp rendered & persisted (StampInstance)
        → stampInstanceId exists
        → canonical payload built (embeds stampInstanceId) → SHA-256
        → Ed25519 sign (one signature per signer, all over SAME finalHash)
        → QR / metadata written from stored values only
        → status VALID
```

Any post-signing edit to the visual stamp produces a new `StampInstance`; the old
authentication record's `finalHash` no longer matches ⇒ detected on verify.

### 2.3 Visual vs cryptographic signatures

- **VisualSignatureAsset** (Part B): a polished handwritten-style image. Purely
  presentational. Carries zero authenticity weight.
- **Signature rows** (Ed25519): the only cryptographic proof. Portal pages report
  both statuses separately and never conflate them.

### 2.4 Keys & rotation

- Each organisation has exactly one ACTIVE Ed25519 `SigningKey`; private keys are
  encrypted at rest with AES-256-GCM (`ENCRYPTION_KEY`, 64-hex).
- Rotation creates a new ACTIVE key and flips the old one to ROTATED (never deleted).
- Every `Signature` row pins its own `publicKey` + `keyId`, so historical documents
  remain verifiable forever even after rotation.
- REVOKED keys fail verification with explicit `keyStatus`.

---

## 3. Internal API Contract (Part A ↔ Part B)

Base URL: `SIGNATURE_SERVICE_URL` (e.g. `http://localhost:4001/internal/signatures`)
Auth header: `x-service-key: <id>:<secret>` — validated constant-time against
`INTERNAL_SERVICE_KEYS="stamp-engine:<secret>"` (bare `<secret>` also accepted).
Every request carries `x-correlation-id`, echoed into AuditLog.

### POST /internal/signatures/sign
```jsonc
// req
{ "organizationId": "...", "documentId": "...", "documentType": "TRANSCRIPT",
  "documentHash": "<64-hex sha256 of canonical payload>",
  "signerId": "user-uuid", "signerRole": "REGISTRAR", "metadata": {} }
// res 201
{ "signatureId": "...", "algorithm": "Ed25519", "keyId": "...",
  "keyFingerprint": "...", "signature": "<base64>", "canonicalHash": "...",
  "signedAt": "ISO", "signedBy": { "id": "...", "email": "..." },
  "verificationCode": "..." }
```

### POST /internal/signatures/verify
```jsonc
// req
{ "documentHash": "<64-hex>", "signature": "<base64>", "keyId": "optional" }
// res 200/400
{ "valid": true|false, "status": "VALID"|"INVALID"|"KEY_REVOKED"|...,
  "reason"?: "...", "keyId": "...", "keyStatus": "ACTIVE"|"ROTATED"|"REVOKED",
  "algorithm": "Ed25519", "signedAt": "ISO", "signer": "...", "signerRole": "...",
  "organisation": "...", "signatureId": "..." }
```
Tampered `documentHash` ⇒ `valid:false` (cryptographic failure, not an error).

### GET /internal/signatures/public-key/:keyId
Returns PEM public key (for external verifiers).

Rotating the service key pair for *this contract*: append new `id:secret` to
`INTERNAL_SERVICE_KEYS` before removing the old entry — both work during overlap.

---

## 4. Public API Surface

### Main backend — `/api/v1/stamp-engine/document-authentication/*` (user JWT)
| Method & path | Permission | Purpose |
|---|---|---|
| GET `/capabilities?templateId=` | DOCUMENT_STAMP_VIEW | marketplace flags (requiresStamp/requiresSignature/requiresVerification merged with template include flags) |
| POST `/prepare` | DOCUMENT_STAMP_CREATE | validate entitlement/perm/template; returns issue plan |
| POST `/issue` | DOCUMENT_STAMP_CREATE | full pipeline; 90 s client timeout |
| GET `/records?status=` | DOCUMENT_STAMP_VIEW | list authentications |
| GET `/:idOrSerial` | scoped | accept UUID, serial, or verification code |
| GET `/:idOrSerial/pipeline-trace` | DOCUMENT_STAMP_APPROVE | saga trace steps |
| POST `/:idOrSerial/revoke` | DOCUMENT_REVOKE | cascade revocation |
| POST `/:idOrSerial/supersede` | DOCUMENT_STAMP_EDIT | link replacement version |

### Public (no auth)
`GET /api/v1/stamp-engine/public/verification/:code` — safe view (no internal JSON blobs),
increments `verificationCount`/`lastVerifiedAt`, writes `AuthVerificationEvent`
(channel PUBLIC/PORTAL/INTERNAL, IP, UA). Unknown codes still recorded as NOT_FOUND.

### Part B organisation-facing (org JWT, port 4001)
`POST /auth/register · /auth/login` · `GET/POST/PATCH /signatures…` ·
`GET /signatures/:id/verification-events` · `POST /signatures/keys · keys/rotate · keys/:keyId/revoke · GET /signatures/keys`

---

## 5. Data Model Summary

**Part A (PostgreSQL)** — see `backend/prisma/migrations/20260823200000_auth_platform_unified`:
- `DocumentAuthentication(status PENDING|VALID|EXPIRED|REVOKED|SUPERSEDED|FAILED,
  originalHash, finalHash, finalPdfHash, signaturesJson[], signingKeyId,
  pipelineTrace{correlationId,steps}, verificationCount, lastVerifiedAt)`
- `StampInstance(configSnapshot, renderedSvgHash, status)` — immutable snapshot of
  the exact stamp applied; templates may evolve, instances never.
- `AuthVerificationEvent(outcome, channel, ip, userAgent)`

**Part B (SQLite/Postgres)** — `digital-signature/backend/prisma/schema.prisma`:
`Organisation`, `SigningKey`, `Signature`, `VisualSignatureAsset`,
`VerificationEvent`, `AuditLog(actor, correlationId, ip, userAgent, result)`.

---

## 6. Environment Variables

### Main backend (.env)
| Var | Example | Notes |
|---|---|---|
| `SIGNATURE_SERVICE_URL` | `http://localhost:4001` | unset ⇒ stamp-only mode |
| `SIGNATURE_SERVICE_KEY` | `stamp-engine:dev-internal-service-secret` | must match Part B allow-list |
| `SIGNATURE_SERVICE_TIMEOUT_MS` | `15000` | bridge AbortController timeout |

### Signature service (digital-signature/backend/.env)
| Var | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite dev; Postgres URL in prod |
| `JWT_SECRET` | long random | org-session JWTs |
| `ENCRYPTION_KEY` | 64 hex chars | AES-256-GCM master key for private keys |
| `PORT` | `4001` | |
| `CORS_ORIGIN` | `http://localhost:3100` | Part B frontend origin |
| `INTERNAL_SERVICE_KEYS` | `stamp-engine:dev-internal-service-secret` | comma-separated `id:secret` pairs |

⚠️ Prisma's implicit .env loading is partial — Part B imports `dotenv/config` as the
first line of `main.ts`. Keep it there.

---

## 7. Deployment Topology

```
docker compose up -d          # from repo root
  main-backend      :3001  (needs DATABASE_URL, SIGNATURE_SERVICE_*)
  signature-service :4001  (own DB volume; INTERNAL_SERVICE_KEYS shared secret)
  frontend          :3000  (NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1)
  portal            :3100  (same build, different origin; CORS_ORIGIN allows it)
```

Secrets are injected via environment only — never baked into images. Rotate
`INTERNAL_SERVICE_KEYS` per §3; rotate org signing keys via
`POST /signatures/keys/rotate` (old signatures stay valid).

---

## 8. Workflows

### 8.1 Issue an official document (admin)
1. Dashboard ▸ Digital Stamps ▸ **📜 Issue Document**
2. Select template → page auto-detects capabilities (stamp/signature/QR).
3. Checklist executes server-side: generate content → finalize stamp → persist
   StampInstance → canonical hash → bridge sign(s) → register authentication.
4. Result card shows serial, verification code, timestamps, `finalHash`, stamp SVG;
   actions: View Verification (`/v/{code}`), Copy Link.
5. Failure anywhere ⇒ record marked FAILED with `PIPELINE_FAILED` step +
   correlation id; nothing half-valid ever reaches users.

### 8.2 Revoke / supersede
Revoke cascades to the underlying `DocumentVerification` (status + reason + actor).
Supersede marks old SUPERSEDED, links `supersededBy`; the public portal renders the
successor banner automatically via status themes.

### 8.3 Public verification
Anyone opens `/v/{code}` (or scans QR): portal shows institution, document type,
serial, issue date, integrity reference (`finalHash` prefix), and separate pills for
digital-signature validity and institutional-stamp status, plus a disclaimer that
server time is authoritative. Every lookup is auditable (counters + events).

---

## 9. Security Review Notes
- Tenant isolation: every Part A query filters by `schoolId`; Part B scopes by
  `organisationId` from the JWT.
- SVG stamps are sanitised at upload/designer save (script/onload stripped); preview
  uses server-rendered output.
- Private signing keys exist in plaintext only in memory of Part B; encrypted
  AES-256-GCM at rest; master key supplied via env/KMS.
- Audit logs are append-only; verification events capture IP/UA/correlation ids.
- Rate limiting and WAF belong to the edge gateway (out of scope here).

## 10. Test Suites
| Suite | Command | Expectation |
|---|---|---|
| Part A smoke (29 checks) | `cd backend && npx tsx scripts/stamp-engine-smoke.ts` | `29 passed, 0 failed` |
| Part B E2E (15 checks) | start `dist/main.js`, run inline E2E script | `ALL PASS` |

(jest hangs in this environment by design — use the tsx runners above.)
