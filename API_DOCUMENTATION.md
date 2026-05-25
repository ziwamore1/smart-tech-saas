# SMART_TECH SAAS SYSTEM - API Documentation

## Base URL

```
Production: https://api.smarttechsaas.com/api/v1
Development: http://localhost:3001/api/v1
```

## Authentication

All API endpoints (except health check and public verification) require JWT authentication.

```http
Authorization: Bearer <your_jwt_token>
```

### Obtain Token

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@smarttechsaas.com",
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 604800
}
```

---

## Health Check

### GET /health

Check service health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-05-19T12:00:00.000Z",
  "uptime": 86400,
  "version": "2.0.0",
  "checks": {
    "database": { "status": "up", "message": "Response time: 12ms", "latency": 12 },
    "ministry": { "status": "up", "message": "1/1 adapters available" },
    "blockchain": { "status": "up", "message": "150 certificates registered on-chain" },
    "memory": { "status": "up", "message": "Heap: 256MB/512MB, RSS: 384MB" }
  }
}
```

### GET /health/detailed

Detailed health check with all subsystems.

---

## Document Signing

### POST /signing/sign

Sign a document cryptographically.

**Request:**
```json
{
  "documentId": "doc-123",
  "documentType": "REPORT_CARD",
  "pdfBase64": "JVBERi0xLjQKJcfsj6IK...",
  "schoolId": "school-456"
}
```

**Response:**
```json
{
  "success": true,
  "verificationToken": "550e8400-e29b-41d4-a716-446655440000",
  "documentHash": "a1b2c3d4e5f6...",
  "signedPdfBase64": "JVBERi0xLjQKJcfsj6IK..."
}
```

### GET /signing/verify/:token

Verify a document signature.

**Response:**
```json
{
  "success": true,
  "verification": {
    "isValid": true,
    "documentHash": "a1b2c3d4e5f6...",
    "signerId": "user-789",
    "signerRole": "Director",
    "signedAt": "2026-05-19T12:00:00.000Z",
    "verificationToken": "550e8400-e29b-41d4-a716-446655440000",
    "blockchainVerified": true,
    "ministryVerified": true
  }
}
```

### POST /signing/revoke/:token

Revoke a document signature.

### GET /signing/document/:documentId

Get all signatures for a document.

---

## Blockchain

### POST /blockchain/certify

Register a certificate hash on blockchain.

**Request:**
```json
{
  "documentId": "doc-123",
  "documentSignatureId": "sig-456",
  "certificateHash": "0xa1b2c3d4...",
  "schoolId": "school-789",
  "network": "POLYGON_AMOY"
}
```

**Response:**
```json
{
  "success": true,
  "blockchain": {
    "transactionHash": "0x1234567890abcdef...",
    "blockNumber": 45678901,
    "verificationUrl": "https://amoy.polygonscan.com/tx/0x1234...",
    "network": "POLYGON_AMOY"
  }
}
```

### GET /blockchain/verify/:txHash

Verify a blockchain transaction.

### GET /blockchain/document/:documentId

Get blockchain certificate for a document.

### POST /blockchain/generate-hash

Generate a certificate hash.

**Request:**
```json
{
  "documentId": "doc-123",
  "metadata": {
    "studentName": "John Doe",
    "certificateType": "Graduation"
  }
}
```

**Response:**
```json
{
  "success": true,
  "hash": "0xa1b2c3d4e5f6..."
}
```

---

## Ministry Gateway

### POST /ministry/verify

Submit a document for ministry verification.

**Request:**
```json
{
  "documentId": "doc-123",
  "documentType": "CERTIFICATE",
  "schoolId": "school-456",
  "studentName": "John Doe",
  "studentId": "student-789",
  "certificateNumber": "CERT-2026-001",
  "issueDate": "2026-05-19",
  "countryCode": "ZM",
  "metadata": {}
}
```

**Response:**
```json
{
  "success": true,
  "verification": {
    "ministryReference": "MIN-ZM-1716120000000-A1B2C3D4",
    "verificationStatus": "verified",
    "verifiedAt": "2026-05-19T12:00:00.000Z",
    "ministryData": {
      "verified": true,
      "studentName": "John Doe",
      "institutionName": "SmartTech Academy"
    },
    "adapter": "Zambia Ministry of Education"
  }
}
```

### POST /ministry/status

Check ministry verification status.

**Request:**
```json
{
  "ministryReference": "MIN-ZM-1716120000000-A1B2C3D4",
  "countryCode": "ZM"
}
```

### GET /ministry/document/:documentId

Get ministry verification for a document.

### GET /ministry/school/:schoolId

Get all ministry verifications for a school.

### POST /ministry/register-institution

Register an institution with ministry.

### GET /ministry/countries

Get available country adapters.

**Response:**
```json
{
  "success": true,
  "countries": ["ZM", "KE", "ZA"]
}
```

### GET /ministry/adapter-status

Check adapter availability.

**Response:**
```json
{
  "success": true,
  "status": {
    "ZM": true,
    "KE": false,
    "ZA": false
  }
}
```

---

## Certificate Validation

### GET /certificate-validation/verify/:token

Full certificate verification.

**Response:**
```json
{
  "success": true,
  "verification": {
    "documentId": "doc-123",
    "documentType": "CERTIFICATE",
    "schoolName": "SmartTech Academy",
    "signatureValid": true,
    "blockchainVerified": true,
    "ministryVerified": true,
    "approvalChainComplete": true,
    "overallStatus": "VERIFIED",
    "verificationDetails": {
      "signature": {
        "signerId": "user-789",
        "signerRole": "Director",
        "signedAt": "2026-05-19T12:00:00.000Z",
        "documentHash": "0xa1b2c3...",
        "isValid": true
      },
      "blockchain": {
        "network": "POLYGON_AMOY",
        "transactionHash": "0x1234...",
        "verificationUrl": "https://amoy.polygonscan.com/tx/0x1234..."
      },
      "ministry": {
        "status": "verified",
        "reference": "MIN-ZM-...",
        "verifiedAt": "2026-05-19T12:00:00.000Z"
      },
      "approvals": {
        "status": "completed",
        "currentStep": 3,
        "totalSteps": 3,
        "steps": [
          { "role": "Teacher", "status": "approved", "completedAt": "..." },
          { "role": "Head of Department", "status": "approved", "completedAt": "..." },
          { "role": "Director", "status": "approved", "completedAt": "..." }
        ]
      }
    },
    "verifiedAt": "2026-05-19T12:00:00.000Z"
  }
}
```

### GET /certificate-validation/document/:documentId

Verify by document ID.

### GET /certificate-validation/stats/:schoolId

Get verification statistics for a school.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalDocuments": 1500,
    "verifiedDocuments": 1200,
    "ministryVerified": 800,
    "blockchainCertificates": 1000,
    "verificationRate": "80.00%"
  }
}
```

---

## Unified Verification

### POST /verification/complete

Process complete verification (signing + blockchain + ministry + QR).

**Request:**
```json
{
  "documentId": "doc-123",
  "documentType": "CERTIFICATE",
  "pdfBase64": "JVBERi0xLjQKJcfsj6IK...",
  "signerId": "user-789",
  "signerRole": "Director",
  "schoolId": "school-456",
  "studentName": "John Doe",
  "studentId": "student-001",
  "certificateNumber": "CERT-2026-001",
  "issueDate": "2026-05-19",
  "blockchainNetwork": "POLYGON_AMOY",
  "metadata": {}
}
```

**Response:**
```json
{
  "success": true,
  "verificationToken": "550e8400-e29b-41d4-a716-446655440000",
  "documentHash": "0xa1b2c3...",
  "qrCodeDataUrl": "data:image/png;base64,...",
  "verificationUrl": "https://verify.smarttechsaas.com/certificate/550e8400...",
  "blockchainTransactionHash": "0x1234...",
  "ministryReference": "MIN-ZM-...",
  "signedPdfBase64": "JVBERi0xLjQKJcfsj6IK..."
}
```

### GET /verification/status/:token

Get full verification status.

---

## Approval Workflows

### POST /approval/workflow

Create an approval workflow.

**Request:**
```json
{
  "documentId": "doc-123",
  "documentName": "Graduation Certificate",
  "documentType": "CERTIFICATE",
  "schoolId": "school-456",
  "steps": [
    { "role": "Teacher", "userId": "user-1", "order": 1 },
    { "role": "Head of Department", "userId": "user-2", "order": 2 },
    { "role": "Director", "userId": "user-3", "order": 3 }
  ]
}
```

### POST /approval/step/:stepId/approve

Approve or reject a step.

**Request:**
```json
{
  "action": "approved",
  "note": "All requirements met",
  "signature": "digital-signature-data"
}
```

### POST /approval/step/:stepId/comment

Add a comment to a step.

### GET /approval/workflow/:workflowId

Get workflow details.

### GET /approval/pending

Get pending approvals for current user.

---

## QR Code

### POST /qr/generate

Generate a QR code.

**Request:**
```json
{
  "documentId": "doc-123",
  "documentType": "CERTIFICATE",
  "verificationToken": "550e8400-e29b-41d4-a716-446655440000",
  "schoolId": "school-456",
  "size": 300
}
```

### POST /qr/simple

Generate a simple QR from URL.

### GET /qr/document/:documentId

Get QR code for a document.

### GET /qr/validate/:token

Validate a QR code.

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message",
  "statusCode": 400
}
```

### Common Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| General API | 100 requests | 15 minutes |
| Authentication | 20 requests | 15 minutes |
| Verification | 200 requests | 15 minutes |

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1716123600
```

---

## Webhooks

### Ministry Verification Callback

When ministry verification completes, a webhook is sent to your configured URL.

**Payload:**
```json
{
  "event": "ministry.verification.completed",
  "data": {
    "ministryReference": "MIN-ZM-...",
    "documentId": "doc-123",
    "status": "verified",
    "verifiedAt": "2026-05-19T12:00:00.000Z"
  },
  "timestamp": "2026-05-19T12:00:00.000Z",
  "signature": "hmac-sha256-signature"
}
```

---

*API Version: 2.0.0*
*Last Updated: May 19, 2026*
