# SMART_TECH SAAS SYSTEM - Production Deployment Guide

## Trusted Educational Verification & Academic Intelligence Infrastructure

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Backend Deployment](#backend-deployment)
5. [Blockchain Smart Contract Deployment](#blockchain-smart-contract-deployment)
6. [Frontend Deployment](#frontend-deployment)
7. [SSL/HTTPS Configuration](#sslhttps-configuration)
8. [Nginx Reverse Proxy](#nginx-reverse-proxy)
9. [Cloudflare Setup](#cloudflare-setup)
10. [Ministry API Configuration](#ministry-api-configuration)
11. [Security Checklist](#security-checklist)
12. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Storage | 50 GB | 100+ GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |

### Required Software

```bash
# Node.js (v18+)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL (v14+)
sudo apt install -y postgresql postgresql-contrib

# Nginx (Redis is no longer required — all queue functionality uses PostgreSQL)
sudo apt install -y nginx

# Certbot
sudo apt install -y certbot python3-certbot-nginx

# PM2 (Process Manager)
sudo npm install -g pm2

# Hardhat (for blockchain)
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
```

---

## Environment Setup

### 1. Create Environment Files

```bash
# Backend .env
cp backend/.env.example backend/.env

# Blockchain .env
cp backend/blockchain/.env.example backend/blockchain/.env
```

### 2. Backend Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/school_saas

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d

# Application
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://smarttechsaas.com

# Verification
VERIFICATION_URL=https://verify.smarttechsaas.com

# Ministry APIs
MINISTRY_ZAMBIA_ENABLED=true
MINISTRY_ZAMBIA_API_URL=https://api.mineduc.gov.zm
MINISTRY_ZAMBIA_CLIENT_ID=your_client_id
MINISTRY_ZAMBIA_CLIENT_SECRET=your_client_secret
MINISTRY_ZAMBIA_JWT_SECRET=your_jwt_secret
MINISTRY_ZAMBIA_TIMEOUT=30000

MINISTRY_KENYA_ENABLED=false
MINISTRY_KENYA_API_URL=
MINISTRY_KENYA_CLIENT_ID=
MINISTRY_KENYA_CLIENT_SECRET=
MINISTRY_KENYA_JWT_SECRET=
MINISTRY_KENYA_TIMEOUT=30000

MINISTRY_SOUTH_AFRICA_ENABLED=false
MINISTRY_SOUTH_AFRICA_API_URL=
MINISTRY_SOUTH_AFRICA_CLIENT_ID=
MINISTRY_SOUTH_AFRICA_CLIENT_SECRET=
MINISTRY_SOUTH_AFRICA_JWT_SECRET=
MINISTRY_SOUTH_AFRICA_TIMEOUT=30000

# Custom Adapters (JSON array)
MINISTRY_CUSTOM_ADAPTERS=[]

# Ministry Webhook
MINISTRY_WEBHOOK_SECRET=your_webhook_secret

# Blockchain
CONTRACT_ADDRESS=0xYourDeployedContractAddress
PRIVATE_KEY=0xYourWalletPrivateKey
POLYGON_RPC_URL=https://polygon-rpc.com
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
POLYGONSCAN_API_KEY=your_polygonscan_api_key

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Beem SMS/WhatsApp (Optional)
BEEM_API_KEY=your_api_key
BEEM_SECRET_KEY=your_secret_key
BEEM_SENDER_NAME=SMARTECH
BEEM_ENABLED=true

# Redis (separate private Railway service: smarttech-redis)
# Configure this on the API and any worker service using a Railway reference
# variable. Do not expose Redis publicly or commit credentials.
REDIS_URL=${{smarttech-redis.REDIS_URL}}

# SMS (Optional — legacy)
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
```

### 3. Blockchain Environment Variables

```env
# Deployment
PRIVATE_KEY=0xYourWalletPrivateKey
POLYGON_RPC_URL=https://polygon-rpc.com
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
ETHERSCAN_API_KEY=your_etherscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key

# Contract (set after deployment)
CONTRACT_ADDRESS=0xYourDeployedContractAddress
```

---

## Database Setup

```bash
# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql
CREATE DATABASE school_saas;
CREATE USER smarttech WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE school_saas TO smarttech;
\q

# Run Prisma migrations
cd backend
npx prisma migrate deploy
npx prisma generate
```

---

## Backend Deployment

```bash
# Install dependencies
cd backend
npm install --production

# Build
npm run build

# Start with PM2
pm2 start dist/main.js --name smarttech-backend
pm2 save
pm2 startup
```

---

## Blockchain Smart Contract Deployment

### 1. Install Dependencies

```bash
cd backend/blockchain
npm install
```

### 2. Deploy to Testnet (Polygon Amoy)

```bash
# Set environment variables
export PRIVATE_KEY=0xYourPrivateKey
export POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology

# Deploy
npx hardhat run scripts/deploy.ts --network polygonAmoy

# Verify on block explorer
npx hardhat verify --network polygonAmoy DEPLOYED_CONTRACT_ADDRESS
```

### 3. Deploy to Mainnet (Polygon)

```bash
# Set environment variables
export PRIVATE_KEY=0xYourPrivateKey
export POLYGON_RPC_URL=https://polygon-rpc.com
export POLYGONSCAN_API_KEY=your_api_key

# Deploy
npx hardhat run scripts/deploy.ts --network polygon

# Verify on block explorer
npx hardhat verify --network polygon DEPLOYED_CONTRACT_ADDRESS
```

### 4. Update Backend with Contract Address

```bash
# Add to backend/.env
CONTRACT_ADDRESS=0xYourDeployedContractAddress
```

### 5. Test Contract

```bash
# Register a certificate
npx hardhat run scripts/verify.ts --network polygonAmoy -- register 0xYourCertificateHash '{"documentId":"doc-123"}'

# Verify a certificate
npx hardhat run scripts/verify.ts --network polygonAmoy -- verify 0xYourCertificateHash

# Check total certificates
npx hardhat run scripts/verify.ts --network polygonAmoy -- total
```

---

## Frontend Deployment

### Option 1: Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel --prod
```

### Option 2: Self-Hosted

```bash
cd frontend
npm install
npm run build

# Serve with PM2
pm2 start npm --name smarttech-frontend -- start
pm2 save
```

---

## SSL/HTTPS Configuration

### 1. Install Certbot

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Generate SSL Certificate

```bash
# Stop nginx temporarily
sudo systemctl stop nginx

# Generate certificate
sudo certbot certonly --standalone -d smarttechsaas.com -d www.smarttechsaas.com -d verify.smarttechsaas.com

# Or with nginx plugin
sudo certbot --nginx -d smarttechsaas.com -d www.smarttechsaas.com -d verify.smarttechsaas.com
```

### 3. Enable Auto-Renewal

```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Test renewal
sudo certbot renew --dry-run
```

### 4. Configure Nginx

```bash
# Copy nginx config
sudo cp infrastructure/nginx/smarttech.conf /etc/nginx/sites-available/smarttech.conf
sudo ln -s /etc/nginx/sites-available/smarttech.conf /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

---

## Nginx Reverse Proxy

### Configuration File Location

```
/etc/nginx/sites-available/smarttech.conf
```

### Key Features

- HTTP to HTTPS redirect
- SSL/TLS 1.2+ only
- Security headers (HSTS, CSP, X-Frame-Options)
- Rate limiting (API: 10r/s, Login: 3r/m)
- Gzip compression
- WebSocket support for Socket.IO
- Static asset caching

---

## Cloudflare Setup

1. **Add your domain to Cloudflare**
2. **Update nameservers** at your domain registrar
3. **Configure DNS records** (see `infrastructure/cloudflare/CONFIGURATION.md`)
4. **Enable SSL/TLS:** Full (strict)
5. **Configure WAF rules** as documented
6. **Set up Page Rules** for caching and security
7. **Enable DDoS protection**

---

## Ministry API Configuration

### Supported Countries

| Country | Status | Environment Variables |
|---------|--------|----------------------|
| Zambia | Ready | `MINISTRY_ZAMBIA_*` |
| Kenya | Ready | `MINISTRY_KENYA_*` |
| South Africa | Ready | `MINISTRY_SOUTH_AFRICA_*` |
| Custom | Ready | `MINISTRY_CUSTOM_ADAPTERS` |

### Adding a New Country Adapter

1. Create adapter in `backend/src/ministry-gateway/adapters/`
2. Extend `MinistryAdapter` abstract class
3. Register in `MinistryAdapterFactory`
4. Add environment variables

### Testing Ministry Integration

```bash
# Check adapter status
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.smarttechsaas.com/api/v1/ministry/adapter-status

# Get available countries
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.smarttechsaas.com/api/v1/ministry/countries
```

---

## Security Checklist

### Application Security

- [x] Helmet security headers enabled
- [x] Rate limiting configured
- [x] CORS properly configured
- [x] JWT authentication on all endpoints
- [x] Input validation (class-validator)
- [x] SQL injection prevention (Prisma ORM)
- [x] XSS protection headers
- [x] CSRF protection

### Infrastructure Security

- [ ] SSL/TLS certificates installed
- [ ] HSTS enabled
- [ ] Firewall configured (UFW)
- [ ] SSH key authentication only
- [ ] Fail2ban installed
- [ ] Automatic security updates enabled
- [ ] Database backups configured
- [ ] Log rotation configured

### Blockchain Security

- [ ] Private key stored securely (not in code)
- [ ] Contract verified on block explorer
- [ ] Owner address documented
- [ ] Gas optimization reviewed
- [ ] Contract tested thoroughly

### Data Protection

- [ ] Student data encrypted at rest
- [ ] API keys rotated regularly
- [ ] Audit logging enabled
- [ ] GDPR compliance reviewed
- [ ] Data retention policy defined

---

## Monitoring & Maintenance

### Application Monitoring

```bash
# PM2 monitoring
pm2 monit

# View logs
pm2 logs smarttech-backend
pm2 logs smarttech-frontend

# Restart if needed
pm2 restart smarttech-backend
```

### Database Maintenance

```bash
# Backup
pg_dump school_saas > backup_$(date +%Y%m%d).sql

# Restore
psql school_saas < backup_20260519.sql

# Vacuum
psql school_saas -c "VACUUM ANALYZE;"
```

### SSL Certificate Monitoring

```bash
# Check expiry
sudo certbot certificates

# Manual renewal
sudo certbot renew --force-renewal
```

### Blockchain Monitoring

```bash
# Check contract status
npx hardhat run scripts/verify.ts --network polygon -- total

# Monitor gas prices
curl https://polygon-rpc.com -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_gasPrice","params":[],"id":1}'
```

---

## Deployment Verification

### 1. Check Backend

```bash
curl https://api.smarttechsaas.com/api/v1/health
```

### 2. Check Frontend

```bash
curl -I https://smarttechsaas.com
```

### 3. Check Verification Portal

```bash
curl -I https://verify.smarttechsaas.com
```

### 4. Check SSL

```bash
curl -vI https://smarttechsaas.com 2>&1 | grep -E "SSL|TLS|expire"
```

### 5. Check Blockchain

```bash
# Verify contract is accessible
npx hardhat run scripts/verify.ts --network polygon -- total
```

---

## Support & Troubleshooting

### Common Issues

1. **SSL Certificate Expired**
   ```bash
   sudo certbot renew
   sudo systemctl reload nginx
   ```

2. **Backend Not Starting**
   ```bash
   pm2 logs smarttech-backend --lines 100
   # Check .env file for missing variables
   ```

3. **Database Connection Failed**
   ```bash
   sudo systemctl status postgresql
   # Verify DATABASE_URL in .env
   ```

4. **Contract Not Found**
   ```bash
   # Verify CONTRACT_ADDRESS in .env
   # Check deployment in backend/blockchain/deployments/
   ```

---

## Contact & Support

- **Documentation:** `VERIFICATION_SYSTEM_IMPLEMENTATION.md`
- **Infrastructure:** `infrastructure/`
- **Blockchain:** `backend/blockchain/`
- **Ministry Gateway:** `backend/src/ministry-gateway/`

---

*SMART_TECH SAAS SYSTEM - Trusted Educational Verification & Academic Intelligence Infrastructure*
