# Cloudflare Configuration for SMART_TECH SAAS SYSTEM
# Security, Performance, and SSL Settings

## DNS Records

| Type | Name | Content | TTL | Proxy Status |
|------|------|---------|-----|--------------|
| A | @ | [SERVER_IP] | Auto | Proxied |
| CNAME | www | smarttechsaas.com | Auto | Proxied |
| CNAME | verify | smarttechsaas.com | Auto | Proxied |
| CNAME | api | smarttechsaas.com | Auto | Proxied |

---

## SSL/TLS Settings

- **SSL/TLS Mode:** Full (strict)
- **Minimum TLS Version:** TLS 1.2
- **Opportunistic Encryption:** On
- **TLS 1.3:** On
- **Automatic HTTPS Rewrites:** On
- **HSTS:** On (max-age=63072000, includeSubDomains, preload)

---

## Security Headers (Page Rules)

### Rule 1: All Pages
```
URL: *.smarttechsaas.com/*
Settings:
  - Security Level: Medium
  - Browser Integrity Check: On
  - Always Use HTTPS: On
  - Disable Apps: On
```

### Rule 2: API Endpoints
```
URL: api.smarttechsaas.com/*
Settings:
  - Security Level: High
  - Browser Integrity Check: On
  - Cache Level: Bypass
  - Disable Apps: On
```

### Rule 3: Verification Portal
```
URL: verify.smarttechsaas.com/*
Settings:
  - Security Level: Medium
  - Cache Level: Cache Everything
  - Edge Cache TTL: 4 hours
  - Browser Cache TTL: 1 month
```

---

## WAF (Web Application Firewall) Rules

### Custom Rules

1. **Block SQL Injection Attempts**
   - Expression: `http.request.uri.query contains "SELECT" or http.request.uri.query contains "UNION" or http.request.uri.query contains "DROP"`
   - Action: Block

2. **Block XSS Attempts**
   - Expression: `http.request.uri.query contains "<script>" or http.request.uri.query contains "javascript:"`
   - Action: Block

3. **Rate Limiting - Login**
   - Expression: `http.request.uri.path contains "/api/v1/auth/login"`
   - Action: Managed Challenge
   - Count: 10 requests per 1 minute

4. **Rate Limiting - API**
   - Expression: `http.host eq "api.smarttechsaas.com"`
   - Action: JS Challenge
   - Count: 100 requests per 1 minute

5. **Block Known Bots**
   - Expression: `(cf.client.bot and not cf.client.bot in {"Googlebot", "Bingbot"})`
   - Action: Block

6. **Block Tor Exit Nodes**
   - Expression: `ip.geoip.tor`
   - Action: Managed Challenge

---

## DDoS Protection

- **DDoS Protection:** On
- **HTTP DDoS Protection:** On
- **Under Attack Mode:** Off (enable during attacks)

---

## Caching Settings

- **Caching Level:** Standard
- **Browser Cache TTL:** 4 hours
- **Query String Sort:** On
- **Always Online:** On
- **Development Mode:** Off

### Cache Rules

1. **Static Assets**
   - Expression: `http.request.uri.path matches "\.(jpg|jpeg|png|gif|ico|css|js|woff2|svg)$"`
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 month

2. **API Responses**
   - Expression: `http.request.uri.path contains "/api/"`
   - Cache Level: Bypass

3. **Verification Portal**
   - Expression: `http.host eq "verify.smarttechsaas.com"`
   - Cache Level: Cache Everything
   - Edge Cache TTL: 4 hours

---

## Speed Optimization

- **Auto Minify:** JavaScript, CSS, HTML
- **Brotli Compression:** On
- **Early Hints:** On
- **HTTP/2:** On
- **HTTP/3 (with QUIC):** On
- **0-RTT Connection Resumption:** On
- **Image Optimization:** On (Polish: Lossless, WebP: On)

---

## Network Settings

- **HTTP/2:** On
- **HTTP/3:** On
- **gRPC:** On
- **WebSockets:** On
- **Onion Routing:** Off
- **Pseudo IPv4:** Off
- **IP Geolocation:** On

---

## Edge Rules (Transform Rules)

### Add Security Headers
```
Expression: true
Headers:
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - X-XSS-Protection: 1; mode=block
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## Monitoring & Analytics

- **Analytics:** On
- **Security Events:** Monitor
- **Traffic Analytics:** On
- **Bot Analytics:** On
- **Caching Analytics:** On

### Alerts Configuration

1. **Origin Errors:** Alert if > 5% in 5 minutes
2. **DDoS Attack:** Alert on detection
3. **SSL Certificate:** Alert 14 days before expiry
4. **Traffic Spike:** Alert if > 200% of normal
5. **WAF Blocks:** Alert if > 100 blocks in 5 minutes
