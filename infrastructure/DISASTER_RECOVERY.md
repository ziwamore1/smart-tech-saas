# SMART_TECH SAAS SYSTEM - Disaster Recovery Plan

## Overview

This document outlines the disaster recovery procedures for SMART_TECH SAAS SYSTEM, ensuring business continuity and data protection for the educational verification platform.

---

## Recovery Time Objectives (RTO)

| Component | RTO | Priority |
|-----------|-----|----------|
| Database | 1 hour | Critical |
| Backend API | 30 minutes | Critical |
| Frontend | 1 hour | High |
| Blockchain Verification | 2 hours | High |
| Ministry APIs | 4 hours | Medium |
| SSL Certificates | 2 hours | High |

---

## Recovery Point Objectives (RPO)

| Component | RPO | Backup Frequency |
|-----------|-----|------------------|
| Database | 1 hour | Hourly incremental, daily full |
| File Storage | 4 hours | Every 4 hours |
| Configuration | 24 hours | Daily |
| Blockchain Data | N/A | On-chain (immutable) |

---

## Backup Strategy

### 1. Database Backups

```bash
# Automated daily full backup (cron)
0 2 * * * /opt/smarttech/infrastructure/scripts/backup.sh full

# Hourly incremental backup (WAL archiving)
# Configure in postgresql.conf:
# wal_level = replica
# archive_mode = on
# archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'
```

### 2. File Storage Backups

```bash
# Uploads directory backup
0 3 * * * rsync -avz /var/www/smarttech/uploads/ /backup/uploads/

# Logs backup
0 4 * * * tar -czf /backup/logs/logs-$(date +\%Y\%m\%d).tar.gz /var/log/smarttech/
```

### 3. Configuration Backups

```bash
# Backup environment files
0 1 * * * cp /opt/smarttech/backend/.env /backup/config/backend-env-$(date +\%Y\%m\%d)

# Backup nginx config
0 1 * * * cp /etc/nginx/sites-available/smarttech.conf /backup/config/nginx-$(date +\%Y\%m\%d)
```

### 4. Blockchain Data

- Smart contracts are deployed on Polygon (immutable)
- Contract address stored in `.env` and deployment records
- Transaction hashes stored in database

---

## Disaster Scenarios & Recovery Procedures

### Scenario 1: Database Failure

**Symptoms:**
- API returns 500 errors
- Application cannot connect to database
- Logs show connection refused errors

**Recovery Steps:**

1. **Assess the damage:**
   ```bash
   sudo systemctl status postgresql
   sudo journalctl -u postgresql --since "1 hour ago"
   ```

2. **Attempt database restart:**
   ```bash
   sudo systemctl restart postgresql
   ```

3. **If restart fails, restore from backup:**
   ```bash
   # List available backups
   ls -la /opt/smarttech/backups/

   # Restore latest backup
   /opt/smarttech/infrastructure/scripts/restore.sh /opt/smarttech/backups/full_backup_LATEST.sql.gz
   ```

4. **Verify restoration:**
   ```bash
   # Check database connectivity
   psql -U smarttech -d school_saas -c "SELECT count(*) FROM \"School\";"

   # Check application health
   curl https://api.smarttechsaas.com/api/v1/health
   ```

5. **Notify stakeholders**

---

### Scenario 2: Server Failure

**Symptoms:**
- Server unreachable
- SSH connection refused
- All services down

**Recovery Steps:**

1. **Provision new server:**
   - Same specifications as original
   - Ubuntu 22.04 LTS or later

2. **Install required software:**
   ```bash
   # Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs

   # PostgreSQL
   sudo apt install -y postgresql postgresql-contrib

   # Redis
   sudo apt install -y redis-server

   # Nginx
   sudo apt install -y nginx

   # Docker & Docker Compose
   sudo apt install -y docker.io docker-compose
   ```

3. **Restore from Git:**
   ```bash
   git clone https://github.com/your-org/smarttech-saas.git /opt/smarttech
   cd /opt/smarttech
   ```

4. **Restore environment variables:**
   ```bash
   # Restore from backup
   cp /backup/config/backend-env-LATEST /opt/smarttech/backend/.env
   ```

5. **Restore database:**
   ```bash
   # Create database
   sudo -u postgres psql -c "CREATE DATABASE school_saas;"

   # Restore backup
   /opt/smarttech/infrastructure/scripts/restore.sh /backup/database/LATEST.sql.gz
   ```

6. **Deploy application:**
   ```bash
   cd /opt/smarttech
   docker-compose up -d
   ```

7. **Restore SSL certificates:**
   ```bash
   sudo certbot certonly --standalone -d smarttechsaas.com -d api.smarttechsaas.com -d verify.smarttechsaas.com
   sudo systemctl reload nginx
   ```

8. **Verify all services:**
   ```bash
   curl https://api.smarttechsaas.com/api/v1/health
   curl https://smarttechsaas.com
   curl https://verify.smarttechsaas.com
   ```

---

### Scenario 3: SSL Certificate Expiry

**Symptoms:**
- Browser warnings about insecure connection
- API requests fail with SSL errors

**Recovery Steps:**

1. **Check certificate status:**
   ```bash
   sudo certbot certificates
   ```

2. **Renew certificate:**
   ```bash
   sudo certbot renew --force-renewal
   sudo systemctl reload nginx
   ```

3. **Verify renewal:**
   ```bash
   curl -vI https://smarttechsaas.com 2>&1 | grep -E "expire|SSL"
   ```

---

### Scenario 4: Blockchain Contract Issue

**Symptoms:**
- Certificate verification fails
- Blockchain transactions not confirming
- Smart contract errors

**Recovery Steps:**

1. **Check contract status:**
   ```bash
   cd backend/blockchain
   npx hardhat run scripts/verify.ts --network polygon -- total
   ```

2. **Check transaction status:**
   - Visit https://polygonscan.com/address/CONTRACT_ADDRESS
   - Verify contract is verified and accessible

3. **If contract is compromised:**
   - Deploy new contract
   - Update `CONTRACT_ADDRESS` in `.env`
   - Restart backend service

4. **Re-register critical certificates:**
   ```bash
   # Get all document signatures from database
   # Re-register on new contract
   ```

---

### Scenario 5: Ministry API Integration Failure

**Symptoms:**
- Ministry verification requests failing
- Timeout errors
- Authentication failures

**Recovery Steps:**

1. **Check adapter status:**
   ```bash
   curl -H "Authorization: Bearer TOKEN" https://api.smarttechsaas.com/api/v1/ministry/adapter-status
   ```

2. **Verify credentials:**
   ```bash
   # Check environment variables
   cat backend/.env | grep MINISTRY
   ```

3. **Test individual adapter:**
   ```bash
   # Check available countries
   curl -H "Authorization: Bearer TOKEN" https://api.smarttechsaas.com/api/v1/ministry/countries
   ```

4. **Update credentials if needed:**
   ```bash
   # Update .env with new credentials
   # Restart backend
   pm2 restart smarttech-backend
   ```

---

## Monitoring & Alerting

### 1. Application Monitoring

```bash
# PM2 monitoring
pm2 monit

# Log monitoring
tail -f /opt/smarttech/backend/logs/app-$(date +%Y%m%d).log

# Error log monitoring
tail -f /opt/smarttech/backend/logs/error-$(date +%Y%m%d).log
```

### 2. Database Monitoring

```bash
# Check database size
psql -U smarttech -d school_saas -c "SELECT pg_size_pretty(pg_database_size('school_saas'));"

# Check active connections
psql -U smarttech -d school_saas -c "SELECT count(*) FROM pg_stat_activity;"

# Check slow queries
psql -U smarttech -d school_saas -c "SELECT query, duration FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC LIMIT 10;"
```

### 3. Server Monitoring

```bash
# CPU usage
top -bn1 | grep "Cpu(s)"

# Memory usage
free -h

# Disk usage
df -h

# Network connections
netstat -tulpn
```

---

## Communication Plan

### Incident Notification

1. **Immediate (within 15 minutes):**
   - Notify technical team via Slack/Email
   - Create incident ticket

2. **Within 1 hour:**
   - Notify management
   - Update status page

3. **Within 4 hours:**
   - Notify affected institutions (if data impacted)
   - Provide estimated resolution time

4. **Post-Incident:**
   - Conduct post-mortem
   - Update disaster recovery plan
   - Document lessons learned

---

## Testing Schedule

| Test Type | Frequency | Last Tested | Next Scheduled |
|-----------|-----------|-------------|----------------|
| Database Restore | Monthly | - | - |
| Full Server Recovery | Quarterly | - | - |
| SSL Renewal | Monthly | - | - |
| Blockchain Verification | Weekly | - | - |
| Ministry API Integration | Monthly | - | - |

---

## Contact Information

| Role | Name | Contact | Availability |
|------|------|---------|--------------|
| DevOps Lead | - | - | 24/7 |
| Database Admin | - | - | Business hours |
| Blockchain Developer | - | - | Business hours |
| Ministry Integration | - | - | Business hours |

---

## Recovery Checklist

### Pre-Recovery
- [ ] Identify the issue
- [ ] Assess impact scope
- [ ] Notify stakeholders
- [ ] Gather backup files
- [ ] Prepare recovery environment

### During Recovery
- [ ] Follow recovery procedure
- [ ] Document all steps
- [ ] Test after each step
- [ ] Communicate progress

### Post-Recovery
- [ ] Verify all services operational
- [ ] Run health checks
- [ ] Notify stakeholders of resolution
- [ ] Document incident
- [ ] Update disaster recovery plan
- [ ] Schedule post-mortem

---

*Last Updated: May 19, 2026*
*Review Schedule: Quarterly*
