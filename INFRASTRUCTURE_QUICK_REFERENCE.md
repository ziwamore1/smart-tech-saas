# SMART_TECH SAAS SYSTEM - Infrastructure Quick Reference

## Architecture Overview

```
Internet
    ↓
Cloudflare (DDoS Protection, CDN, WAF)
    ↓
Nginx (SSL Termination, Reverse Proxy, Rate Limiting)
    ↓
┌─────────────────────────────────────────────┐
│              SMART_TECH Services             │
├────────────┬────────────┬───────────────────┤
│  Frontend  │   Backend  │    Blockchain     │
│  (Next.js) │  (NestJS)  │  (Polygon/Eth)    │
│  :3000     │  :3001     │  Smart Contracts  │
└────────────┴─────┬──────┴─────────┬─────────┘
                   │                │
               ┌────▼────┐      ┌────▼────┐
               │PostgreSQL│      │ Ministry│
               │ (Queues) │      │  APIs   │
               └─────────┘      └─────────┘
```

---

## Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Main App | `https://smarttechsaas.com` | Primary application |
| API | `https://api.smarttechsaas.com` | REST API endpoints |
| Verification Portal | `https://verify.smarttechsaas.com` | Public certificate verification |
| WebSocket | `wss://smarttechsaas.com/socket.io` | Real-time notifications |

---

## API Endpoints Summary

### Authentication
```
POST   /api/v1/auth/login
POST   /api/v1/auth/register
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
```

### Document Signing
```
POST   /api/v1/signing/sign
GET    /api/v1/signing/verify/:token
POST   /api/v1/signing/revoke/:token
GET    /api/v1/signing/document/:documentId
```

### Blockchain
```
POST   /api/v1/blockchain/certify
GET    /api/v1/blockchain/verify/:txHash
GET    /api/v1/blockchain/document/:documentId
POST   /api/v1/blockchain/generate-hash
```

### Ministry Gateway
```
POST   /api/v1/ministry/verify
POST   /api/v1/ministry/status
GET    /api/v1/ministry/document/:documentId
GET    /api/v1/ministry/school/:schoolId
POST   /api/v1/ministry/register-institution
GET    /api/v1/ministry/countries
GET    /api/v1/ministry/adapter-status
```

### Certificate Validation
```
GET    /api/v1/certificate-validation/verify/:token
GET    /api/v1/certificate-validation/document/:documentId
GET    /api/v1/certificate-validation/stats/:schoolId
```

### Unified Verification
```
POST   /api/v1/verification/complete
GET    /api/v1/verification/status/:token
```

### Approval Workflows
```
POST   /api/v1/approval/workflow
POST   /api/v1/approval/step/:stepId/approve
POST   /api/v1/approval/step/:stepId/comment
GET    /api/v1/approval/workflow/:workflowId
GET    /api/v1/approval/pending
```

---

## Smart Contract

### Contract Address
```
Polygon Mainnet:  0x[After Deployment]
Polygon Amoy:     0x[After Deployment]
```

### Contract Functions
```solidity
registerCertificate(bytes32 hash, string metadata)
verifyCertificate(bytes32 hash) → (exists, valid, timestamp)
revokeCertificate(bytes32 hash)
getTotalCertificates() → count
getCertificateRecord(bytes32 hash) → full record
```

### Deployment Commands
```bash
cd backend/blockchain

# Testnet
npm run deploy:amoy

# Mainnet
npm run deploy:polygon

# Verify contract
npm run verify:polygon -- DEPLOYED_ADDRESS
```

---

## Ministry Adapters

### Available Adapters
| Country | Class | Status |
|---------|-------|--------|
| Zambia | `ZambiaAdapter` | Ready |
| Kenya | `KenyaAdapter` | Ready |
| South Africa | `SouthAfricaAdapter` | Ready |
| Custom | `CustomInstitutionAdapter` | Ready |

### Adding a New Country
1. Create adapter extending `MinistryAdapter`
2. Register in `MinistryAdapterFactory`
3. Add env variables
4. Test with `GET /api/v1/ministry/adapter-status`

---

## Security Headers

All responses include:
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'...
```

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| General API | 100 req | 15 min |
| Authentication | 20 req | 15 min |
| Verification | 200 req | 15 min |
| Nginx API | 10 req/s | - |
| Nginx Login | 3 req/min | - |
| Nginx Verify | 30 req/s | - |

---

## SSL/TLS

- **Protocol:** TLS 1.2, TLS 1.3
- **Certificate:** Let's Encrypt (auto-renew)
- **HSTS:** Enabled (2 years)
- **Cipher Suites:** ECDHE-ECDSA-AES128-GCM-SHA256, etc.

---

## Database

```
PostgreSQL: localhost:5432
Database: school_saas
ORM: Prisma
```

### Key Tables
- `DocumentSignature` - Cryptographic signatures
- `BlockchainCertificate` - Blockchain records
- `MinistryVerification` - Ministry API results
- `ApprovalWorkflow` - Approval chains
- `ApprovalStep` - Individual approval steps
- `ApprovalComment` - Approval comments

---

## Monitoring

```bash
# Application
pm2 monit
pm2 logs

# Nginx
tail -f /var/log/nginx/smarttech-access.log
tail -f /var/log/nginx/smarttech-error.log

# PostgreSQL
tail -f /var/log/postgresql/postgresql-14-main.log

# SSL
sudo certbot certificates
```

---

## Quick Commands

```bash
# Start all services
pm2 start dist/main.js --name smarttech-backend
pm2 start npm --name smarttech-frontend -- start

# Restart
pm2 restart smarttech-backend

# Stop
pm2 stop all

# View logs
pm2 logs --lines 100

# Database
npx prisma migrate deploy
npx prisma generate

# Blockchain
cd backend/blockchain
npm run deploy:amoy
npm run test

# SSL
sudo certbot renew
sudo systemctl reload nginx
```

---

## File Structure

```
Smart_Tech SaaS System/
├── backend/
│   ├── src/
│   │   ├── signing-service/          # PDF signing
│   │   ├── blockchain-service/       # Blockchain integration
│   │   ├── ministry-gateway/         # Ministry APIs
│   │   │   ├── adapters/             # Country adapters
│   │   │   ├── validators/           # Request validation
│   │   │   └── auth/                 # Auth guards
│   │   ├── qr-service/               # QR generation
│   │   ├── certificate-validation-service/
│   │   ├── verification-service/
│   │   └── approval-service/
│   ├── blockchain/
│   │   ├── contracts/                # Solidity contracts
│   │   ├── scripts/                  # Deploy/verify scripts
│   │   ├── test/                     # Contract tests
│   │   └── deployments/              # Deployment records
│   └── prisma/
│       └── schema.prisma
├── frontend/
│   └── app/
│       └── super-admin/
│           └── verification/         # Admin verification pages
├── SmartTechApp/
│   └── src/
│       ├── screens/common/           # Mobile verification screens
│       └── services/
│           └── verification.ts       # Mobile verification service
└── infrastructure/
    ├── nginx/                        # Nginx configs
    └── cloudflare/                   # Cloudflare configs
```

---

*Last Updated: May 19, 2026*
