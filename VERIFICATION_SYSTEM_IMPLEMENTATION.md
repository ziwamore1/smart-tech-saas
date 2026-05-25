# SMART_TECH SAAS SYSTEM - Educational Document Intelligence Platform

## Implementation Report: Advanced Security & Verification Systems

**Date:** May 19, 2026  
**Version:** 2.0.0  
**Status:** ✅ Complete

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Backend Services](#backend-services)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Frontend Pages](#frontend-pages)
- [Security Features](#security-features)
- [Dependencies](#dependencies)
- [Environment Configuration](#environment-configuration)
- [Quick Start](#quick-start)
- [Verification Flow](#verification-flow)
- [Enterprise Use Cases](#enterprise-use-cases)

---

## Overview

SMART_TECH SAAS SYSTEM has been evolved from a school management system into a **fully verified educational document intelligence platform** with enterprise-grade security standards suitable for:

- Schools
- Universities
- Examination Boards
- Ministries of Education
- Accreditation Institutions

### Core Capabilities

✅ Certificates cannot be forged  
✅ Reports are tamper-proof  
✅ Approvals are traceable  
✅ Educational documents are verifiable online  
✅ Institutional trust is strengthened

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SMART_TECH SAAS SYSTEM                    │
│         Educational Intelligence Platform v2.0               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Frontend   │  │   Backend    │  │   Database       │  │
│  │   (Next.js)  │  │  (NestJS)    │  │  (PostgreSQL)    │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │            │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌────────▼─────────┐  │
│  │ Verification │  │  Services    │  │   Prisma ORM     │  │
│  │   Portal     │  │  Layer       │  │                  │  │
│  └──────────────┘  └──────┬───────┘  └──────────────────┘  │
│                           │                                 │
│  ┌────────────────────────▼──────────────────────────────┐  │
│  │              Verification Services Layer               │  │
│  ├────────────┬────────────┬────────────┬───────────────┤  │
│  │  Signing   │ Blockchain │  Ministry  │   Approval    │  │
│  │  Service   │  Service   │  Gateway   │   Service     │  │
│  ├────────────┼────────────┼────────────┼───────────────┤  │
│  │    QR      │ Certificate│ Verification│   Socket.IO   │  │
│  │  Service   │ Validation │  Service   │   Gateway     │  │
│  └────────────┴────────────┴────────────┴───────────────┘  │
│                           │                                 │
│  ┌────────────────────────▼──────────────────────────────┐  │
│  │              External Integrations                     │  │
│  ├────────────┬────────────┬────────────┬───────────────┤  │
│  │  Polygon   │ Ethereum   │  Ministry  │  Government   │  │
│  │  Network   │  Network   │    APIs    │   Systems     │  │
│  └────────────┴────────────┴────────────┴───────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Backend Services

### 1. Cryptographic PDF Signing Service

**Location:** `backend/src/signing-service/`

**Features:**
- SHA256 document hashing
- PKCS#12 institutional certificate generation (2048-bit RSA)
- PDF metadata embedding with verification tokens
- Digital seal verification
- Signature validation and revocation
- Document integrity checking

**Files:**
- `signing.service.ts` - Core signing logic
- `signing.controller.ts` - REST API endpoints
- `signing.module.ts` - NestJS module configuration

**Flow:**
```
Generate Report → Render PDF → Generate Hash → Apply Certificate → Sign PDF → Store Metadata → Generate Verification ID
```

---

### 2. Blockchain Certificate Verification Service

**Location:** `backend/src/blockchain-service/`

**Features:**
- Multi-network support (Polygon, Ethereum, BSC, Hyperledger)
- SHA256 hash storage on blockchain
- Transaction verification
- Smart contract integration
- Only hashes stored on-chain (not full certificates)

**Files:**
- `blockchain.service.ts` - Blockchain operations
- `blockchain.controller.ts` - REST API endpoints
- `blockchain.module.ts` - Module configuration

**Flow:**
```
Certificate Generated → Generate SHA256 Hash → Store Hash on Blockchain → Receive TX ID → Attach Metadata → Generate QR
```

---

### 3. Ministry Verification API Gateway

**Location:** `backend/src/ministry-gateway/`

**Features:**
- Modular design for country-specific ministry APIs
- OAuth2 and JWT authentication
- HMAC-signed API requests
- Encrypted communication
- Institution registration capability
- Audit logging

**Files:**
- `ministry-gateway.service.ts` - Ministry API integration
- `ministry-gateway.controller.ts` - REST API endpoints
- `ministry-gateway.module.ts` - Module configuration

**Architecture:**
```
SMART_TECH → Verification Service → Ministry API Gateway → Government Validation Systems
```

---

### 4. Digital Approval Chains Service

**Location:** `backend/src/approval-service/`

**Features:**
- Sequential multi-stage approvals
- Role-based authorization
- Rejection workflows
- Approval comments and audit trails
- Real-time Socket.IO notifications
- Approval tracking and history

**Files:**
- `approval.service.ts` - Approval workflow logic
- `approval.controller.ts` - REST API endpoints
- `approval.module.ts` - Module configuration

**Example Workflow:**
```
Teacher → Class Teacher → Head of Department → Director → Final Institutional Approval
```

---

### 5. QR Code Generation Service

**Location:** `backend/src/qr-service/`

**Features:**
- High-quality QR code generation (PNG)
- Custom styling with institutional colors
- Error correction level H (highest)
- Verification URL embedding
- QR validation and tracking

**Files:**
- `qr.service.ts` - QR generation logic
- `qr.controller.ts` - REST API endpoints
- `qr.module.ts` - Module configuration

---

### 6. Certificate Validation Service

**Location:** `backend/src/certificate-validation-service/`

**Features:**
- Full verification orchestration
- Combined signature + blockchain + ministry + approval validation
- Overall status determination (VERIFIED, PARTIALLY_VERIFIED, UNVERIFIED, INVALID)
- Verification statistics and reporting

**Files:**
- `certificate-validation.service.ts` - Validation orchestration
- `certificate-validation.controller.ts` - REST API endpoints
- `certificate-validation.module.ts` - Module configuration

---

### 7. Unified Verification Service

**Location:** `backend/src/verification-service/`

**Features:**
- Complete document processing pipeline
- Integrates all verification systems in one call
- Returns signed PDF, QR code, blockchain TX, and ministry reference

**Files:**
- `verification.service.ts` - Unified processing
- `verification.controller.ts` - REST API endpoints
- `verification.module.ts` - Module configuration

---

## Database Schema

### New Models Added

#### DocumentSignature
| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| documentId | String | Reference to the document |
| documentType | String | Type (report card, certificate, etc.) |
| documentHash | String (Unique) | SHA256 hash of the document |
| signerId | String | User who signed |
| signerRole | String | Role of signer |
| signatureCertificate | String? | PEM certificate |
| signedAt | DateTime | Timestamp |
| verificationToken | String (Unique) | Public verification token |
| blockchainHash | String? | Blockchain transaction hash |
| verificationUrl | String? | Public verification URL |
| schoolId | String | Institution reference |
| metadata | Json? | Additional metadata |
| isValid | Boolean | Signature validity |
| revokedAt | DateTime? | Revocation timestamp |
| revokedBy | String? | Who revoked |

#### BlockchainCertificate
| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| documentId | String | Reference to document |
| documentSignatureId | String? (Unique) | Link to signature |
| certificateHash | String (Unique) | SHA256 hash |
| blockchainNetwork | String | Network (Polygon, Ethereum, etc.) |
| transactionHash | String (Unique) | Blockchain TX hash |
| smartContract | String? | Contract address |
| verificationUrl | String? | Verification URL |
| qrCodeData | String? | Embedded QR data |
| metadata | Json? | Block number, timestamp, etc. |

#### MinistryVerification
| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| documentId | String | Reference to document |
| documentType | String | Document type |
| schoolId | String | Institution reference |
| ministryApiEndpoint | String? | API endpoint used |
| ministryReference | String? (Unique) | Ministry reference ID |
| verificationStatus | String | pending, verified, error |
| verificationData | Json? | Response data from ministry |
| verifiedAt | DateTime? | Verification timestamp |
| expiresAt | DateTime? | Expiration date |

#### ApprovalComment
| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| stepId | String | Approval step reference |
| userId | String | Comment author |
| comment | String | Comment text |
| createdAt | DateTime | Timestamp |

#### Enhanced Models
- **ApprovalWorkflow** - Added `finalStatus`, `completedAt` fields
- **ApprovalStep** - Added `action`, `comments`, `signedAt`, `signature` fields

---

## API Endpoints

### Signing Service
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/signing/sign` | Sign a document |
| GET | `/api/v1/signing/verify/:token` | Verify document signature |
| POST | `/api/v1/signing/revoke/:token` | Revoke a signature |
| GET | `/api/v1/signing/document/:documentId` | Get all signatures for document |
| POST | `/api/v1/signing/generate-certificate` | Generate institutional certificate |

### Blockchain Service
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/blockchain/certify` | Certify document on blockchain |
| GET | `/api/v1/blockchain/verify/:txHash` | Verify blockchain transaction |
| GET | `/api/v1/blockchain/document/:documentId` | Get document's blockchain cert |
| GET | `/api/v1/blockchain/school/:schoolId` | Get school's blockchain certs |
| POST | `/api/v1/blockchain/generate-hash` | Generate certificate hash |

### Ministry Gateway
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/ministry/verify` | Submit for ministry verification |
| GET | `/api/v1/ministry/status/:reference` | Check verification status |
| GET | `/api/v1/ministry/document/:documentId` | Get document's ministry status |
| GET | `/api/v1/ministry/school/:schoolId` | Get school's verifications |
| POST | `/api/v1/ministry/register-institution` | Register institution with ministry |

### QR Service
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/qr/generate` | Generate QR code |
| POST | `/api/v1/qr/simple` | Generate simple QR from URL |
| GET | `/api/v1/qr/document/:documentId` | Get document's QR code |
| GET | `/api/v1/qr/validate/:token` | Validate QR code |

### Certificate Validation
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/certificate-validation/verify/:token` | Full certificate verification |
| GET | `/api/v1/certificate-validation/document/:documentId` | Verify by document ID |
| GET | `/api/v1/certificate-validation/stats/:schoolId` | Get verification statistics |

### Unified Verification
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/verification/complete` | Process complete verification |
| GET | `/api/v1/verification/status/:token` | Get full verification status |

### Approval Service
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/approval/workflow` | Create approval workflow |
| POST | `/api/v1/approval/step/:stepId/approve` | Approve/reject step |
| POST | `/api/v1/approval/step/:stepId/comment` | Add comment to step |
| GET | `/api/v1/approval/workflow/:workflowId` | Get workflow details |
| GET | `/api/v1/approval/document/:documentId` | Get document workflows |
| GET | `/api/v1/approval/school/:schoolId` | Get school workflows |
| GET | `/api/v1/approval/pending` | Get pending approvals for user |

---

## Frontend Pages

### Certificate Verification Portal
**Location:** `frontend/app/verify/certificate/page.tsx`

**Features:**
- Token-based verification input
- Multi-tab results display (Overview, Signature, Blockchain, Ministry, Approvals)
- Visual status indicators (VERIFIED, PARTIALLY_VERIFIED, INVALID, UNVERIFIED)
- Framer Motion animations
- Mobile-responsive design
- Real-time verification feedback

### Blockchain Verification Page
**Location:** `frontend/app/verify/blockchain/page.tsx`

**Features:**
- Transaction hash input
- Network display
- Visual verification result
- Clean, modern UI

### Existing Verification Page
**Location:** `frontend/app/verify/page.tsx`

- Original stamp verification page (retained for backward compatibility)

---

## Security Features

### Implemented Security Measures

1. **Helmet Security Headers**
   - Content Security Policy
   - X-Frame-Options
   - X-Content-Type-Options
   - Strict-Transport-Security
   - X-XSS-Protection

2. **Rate Limiting**
   - General: 100 requests per 15 minutes
   - Authentication: 20 requests per 15 minutes
   - Verification: 200 requests per 15 minutes

3. **CORS Configuration**
   - Configurable allowed origins
   - Credentials support
   - Secure by default

4. **Additional Security**
   - X-Powered-By header disabled
   - JWT authentication on all verification endpoints
   - RBAC authorization
   - Audit logging for all actions
   - HMAC-signed ministry API requests

---

## Dependencies

### Backend (Already Installed)
```json
{
  "node-signpdf": "^3.0.0",
  "pdf-lib": "^1.17.1",
  "node-forge": "^1.4.0",
  "crypto-js": "^4.2.0",
  "ethers": "^6.16.0",
  "web3": "^4.16.0",
  "axios": "^1.13.6",
  "jose": "^6.2.3",
  "jwks-rsa": "^4.0.1",
  "express-rate-limit": "^8.5.2",
  "helmet": "^8.1.0",
  "bcrypt": "^6.0.0",
  "jsonwebtoken": "^9.0.3",
  "csurf": "^1.11.0",
  "qrcode": "^1.5.4",
  "uuid": "^14.0.0",
  "puppeteer": "^24.43.1",
  "socket.io": "^4.8.3"
}
```

### Frontend (Already Installed)
```json
{
  "react-qr-reader": "^3.0.0-beta-1",
  "qrcode.react": "^4.2.0",
  "framer-motion": "^12.38.0",
  "react-pdf": "^10.4.1"
}
```

---

## Environment Configuration

Add these variables to your `.env` file:

```env
# Verification Portal
VERIFICATION_URL=https://verify.smarttechsaas.com

# Ministry API Integration
MINISTRY_API_URL=https://api.ministry-of-education.gov.zm
MINISTRY_API_KEY=your_ministry_api_key
MINISTRY_API_SECRET=your_ministry_api_secret

# Blockchain Configuration
BLOCKCHAIN_CONTRACT_ADDRESS=0xYourContractAddress
BLOCKCHAIN_WALLET_PRIVATE_KEY=0xYourPrivateKey

# Network RPC URLs
POLYGON_RPC_URL=https://polygon-rpc.com
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
BSC_RPC_URL=https://bsc-dataseed.binance.org

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

---

## Quick Start

### 1. Database Migration
```bash
cd backend
npx prisma db push
```

### 2. Start Backend
```bash
cd backend
npm run start:dev
```

### 3. Start Frontend
```bash
cd frontend
npm run dev
```

### 4. Access Verification Portals
- **Certificate Verification:** `http://localhost:3000/verify/certificate`
- **Blockchain Verification:** `http://localhost:3000/verify/blockchain`
- **API Documentation:** `http://localhost:3001/api/v1`

---

## Verification Flow

### Complete Document Verification Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    Document Generation                       │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Generate PDF (Puppeteer/pdf-lib)                   │
│  - Clean HTML templates                                     │
│  - Controlled print rendering                               │
│  - Print-safe layouts                                       │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Cryptographic Signing                              │
│  - Generate SHA256 hash                                     │
│  - Apply institutional certificate                          │
│  - Embed metadata                                           │
│  - Generate verification token                              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: QR Code Generation                                 │
│  - Generate QR with verification URL                        │
│  - Embed in PDF                                             │
│  - Store QR metadata                                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Blockchain Certification                           │
│  - Generate certificate hash                                │
│  - Store hash on blockchain (Polygon/Ethereum)              │
│  - Receive transaction hash                                 │
│  - Link to document signature                               │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 5: Ministry Verification (Optional)                   │
│  - Submit to ministry API                                   │
│  - Receive ministry reference                               │
│  - Track verification status                                │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 6: Approval Workflow (Optional)                       │
│  - Create multi-stage approval chain                        │
│  - Sequential approvals with notifications                  │
│  - Track approval status                                    │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 7: Public Verification                                │
│  - Anyone can verify via QR code or token                   │
│  - Full verification status displayed                       │
│  - Blockchain + Ministry + Signature + Approvals            │
└─────────────────────────────────────────────────────────────┘
```

### Verification Status Levels

| Status | Description | Requirements |
|--------|-------------|--------------|
| **VERIFIED** | Fully verified | Signature valid + Blockchain + Ministry + Approvals complete |
| **PARTIALLY_VERIFIED** | Partially verified | Signature valid + at least one other verification |
| **UNVERIFIED** | Not yet verified | Only signature present |
| **INVALID** | Invalid/Revoked | Signature revoked or invalid |

---

## Enterprise Use Cases

### Schools
- Generate tamper-proof report cards
- Digital approval workflows for results
- QR codes on certificates for parent verification

### Universities
- Blockchain-backed degree certificates
- Ministry-integrated transcript verification
- Multi-stage approval for graduation documents

### Examination Boards
- Cryptographically signed exam results
- Immutable result records on blockchain
- Public verification portal for employers

### Ministries of Education
- API integration for national verification
- Institution registration and monitoring
- Centralized document validation

### Accreditation Institutions
- Verify institutional credentials
- Track approval chains
- Audit document authenticity

---

## File Structure

```
backend/
├── src/
│   ├── signing-service/
│   │   ├── signing.service.ts
│   │   ├── signing.controller.ts
│   │   └── signing.module.ts
│   ├── blockchain-service/
│   │   ├── blockchain.service.ts
│   │   ├── blockchain.controller.ts
│   │   └── blockchain.module.ts
│   ├── ministry-gateway/
│   │   ├── ministry-gateway.service.ts
│   │   ├── ministry-gateway.controller.ts
│   │   └── ministry-gateway.module.ts
│   ├── qr-service/
│   │   ├── qr.service.ts
│   │   ├── qr.controller.ts
│   │   └── qr.module.ts
│   ├── certificate-validation-service/
│   │   ├── certificate-validation.service.ts
│   │   ├── certificate-validation.controller.ts
│   │   └── certificate-validation.module.ts
│   ├── verification-service/
│   │   ├── verification.service.ts
│   │   ├── verification.controller.ts
│   │   └── verification.module.ts
│   ├── approval-service/
│   │   ├── approval.service.ts
│   │   ├── approval.controller.ts
│   │   └── approval.module.ts
│   ├── messaging/
│   │   └── socket.gateway.ts
│   ├── common/
│   │   └── security.middleware.ts
│   └── app.module.ts
│
frontend/
├── app/
│   └── verify/
│       ├── page.tsx              (Original stamp verification)
│       ├── certificate/
│       │   └── page.tsx          (Full certificate verification)
│       └── blockchain/
│           └── page.tsx          (Blockchain verification)
│
prisma/
└── schema.prisma                 (Updated with new models)
```

---

## Next Steps & Recommendations

1. **Configure Ministry APIs** - Set up actual ministry API endpoints for your country
2. **Deploy Smart Contract** - Deploy the blockchain verification contract to Polygon/Ethereum
3. **Set Up SSL** - Configure HTTPS for production verification portals
4. **Add Monitoring** - Set up logging and monitoring for verification requests
5. **Load Testing** - Test verification endpoints under high load
6. **Backup Strategy** - Implement database backups for verification records
7. **CDN Setup** - Use CDN for static verification portal assets
8. **Mobile App** - Consider mobile app for QR scanning and verification

---

## Support & Documentation

For issues, questions, or contributions, refer to the main project repository.

**Platform:** SmartTech Educational Intelligence Platform  
**Version:** 2.0.0  
**Last Updated:** May 19, 2026

---

*Powered by SmartTech SaaS - Transforming Educational Document Management*
