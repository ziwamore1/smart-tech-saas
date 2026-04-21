# Environment Setup Guide

## 1. Backend Configuration

### Navigate to backend folder and create .env file

```bash
cd backend
```

### Create or edit `.env` file with the following:

```env
# ===========================================
# DATABASE CONFIGURATION
# ===========================================
DATABASE_URL="postgresql://postgres:password@localhost:5432/smart_tech_saas"

# ===========================================
# JWT AUTHENTICATION
# ===========================================
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="7d"

# ===========================================
# SERVER CONFIGURATION
# ===========================================
PORT=3001
NODE_ENV=development

# ===========================================
# FRONTEND URL (for CORS)
# ===========================================
FRONTEND_URL="http://localhost:3000"

# ===========================================
# REDIS (for Bull queues - optional)
# ===========================================
REDIS_HOST=localhost
REDIS_PORT=6379

# ===========================================
# COMMUNICATION SERVICES (Optional - for real SMS/Email)
# ===========================================

# SMS Provider - Africa's Talking (Recommended for Africa)
# Get API key from: https://account.africastalking.com
AFRICASTALKING_API_KEY=your_africastalking_api_key
AFRICASTALKING_USERNAME=your_username
SMS_SENDER_ID="SMARTSCH"

# Alternative SMS - Twilio
# Get credentials from: https://www.twilio.com/console
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# ===========================================
# EMAIL CONFIGURATION (SMTP)
# ===========================================
# For Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM="Smart Tech SaaS <noreply@smarttechsaas.com>"

# For Outlook
# SMTP_HOST=smtp-mail.outlook.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=your-email@outlook.com
# SMTP_PASS=your-password

# ===========================================
# WHATSAPP BUSINESS API (Optional)
# ===========================================
# Get from: https://business.whatsapp.com
WHATSAPP_BUSINESS_API_KEY=your_whatsapp_api_key
WHATSAPP_PHONE_NUMBER=+1234567890

# ===========================================
# SOCIAL MEDIA (Optional)
# ===========================================

# Facebook
# Get from: https://developers.facebook.com
FACEBOOK_PAGE_ID=your_page_id
FACEBOOK_ACCESS_TOKEN=your_page_access_token

# YouTube
# Get from: https://console.cloud.google.com
YOUTUBE_API_KEY=your_youtube_api_key
YOUTUBE_CHANNEL_ID=your_channel_id

# LinkedIn
# Get from: https://www.linkedin.com/developers
LINKEDIN_PAGE_ID=your_page_id
LINKEDIN_ACCESS_TOKEN=your_access_token

# ===========================================
# PUSH NOTIFICATIONS (Optional)
# ===========================================
# Firebase Cloud Messaging
FCM_SERVER_KEY=your_fcm_server_key
```

---

## 2. Database Setup

### If database doesn't exist, create it:

```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE smart_tech_saas;

# Exit
\q
```

### Run migrations:

```bash
cd backend
npx prisma migrate deploy
```

### Generate Prisma Client:

```bash
npx prisma generate
```

---

## 3. Frontend Configuration

### Navigate to frontend folder

```bash
cd frontend
```

### Create or edit `.env.local` file:

```env
# API Base URL
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# Optional: Socket.io URL for real-time features
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

---

## 4. Platform API Setup

### A. SMS - Africa's Talking (Recommended for African Schools)

1. **Sign up**: https://account.africastalking.com
2. **Get API Key**: 
   - Go to Settings → API Key
   - Copy your sandbox or live API key
3. **Set Sender ID**:
   - Go to Settings → Sender ID
   - Request your custom sender ID (e.g., "SMARTSCH")
4. **Update .env**:
```env
AFRICASTALKING_API_KEY=AT Airltime_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
AFRICASTALKING_USERNAME=your_username
SMS_SENDER_ID=SMARTSCH
```

### B. WhatsApp Business API

1. **Sign up**: https://business.whatsapp.com
2. **Create Business Account**
3. **Get API Credentials**:
   - Go to WhatsApp Business API
   - Get your Phone Number ID and API Key
4. **Update .env**:
```env
WHATSAPP_BUSINESS_API_KEY=your_api_key
WHATSAPP_PHONE_NUMBER=+1234567890
```

### C. Email - Gmail SMTP

1. **Enable 2-Factor Authentication** on your Google account
2. **Generate App Password**:
   - Go to https://myaccount.google.com/security
   - Select "App passwords"
   - Generate new app password for "Mail"
3. **Update .env**:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
```

### D. Facebook Page Setup

1. **Create Facebook Page** (if not exists):
   - Go to https://www.facebook.com/pages/create
2. **Get Page ID**:
   - Go to your page → About → Page ID
3. **Get Access Token**:
   - Go to https://developers.facebook.com
   - Create App → Add Facebook Login product
   - Generate page access token
4. **Update .env**:
```env
FACEBOOK_PAGE_ID=your_page_id
FACEBOOK_ACCESS_TOKEN=your_long-lived_token
```

### E. YouTube Setup

1. **Create Google Cloud Project**:
   - Go to https://console.cloud.google.com
   - Create new project
2. **Enable YouTube Data API v3**
3. **Create API Key**:
   - Go to Credentials → API Key
4. **Get Channel ID**:
   - Go to your YouTube channel → Advanced Settings
5. **Update .env**:
```env
YOUTUBE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
YOUTUBE_CHANNEL_ID=UCXXXXXXXXXXXXXXXXXXXXXXXXX
```

### F. LinkedIn Setup

1. **Create LinkedIn App**:
   - Go to https://www.linkedin.com/developers/apps
   - Create new app
2. **Get Page ID**:
   - Find your Company Page ID
3. **Get Access Token**:
   - Use OAuth 2.0 to generate token
   - Request `w_member_social` permission
4. **Update .env**:
```env
LINKEDIN_PAGE_ID=your_page_id
LINKEDIN_ACCESS_TOKEN=your_access_token
```

---

## 5. Quick Start Without Real APIs

If you don't have API credentials yet, the system will work in **simulation mode**:

```env
# Leave these empty or with dummy values
AFRICASTALKING_API_KEY=
WHATSAPP_BUSINESS_API_KEY=
FACEBOOK_ACCESS_TOKEN=
YOUTUBE_API_KEY=
LINKEDIN_ACCESS_TOKEN=

# The system will simulate API calls and log them
```

Messages won't actually be sent, but you can:
- Test the UI flow
- See message logs
- Test scheduling
- View platform analytics (simulated)
- Test real-time alerts

---

## 6. Verify Configuration

### Check if backend starts:

```bash
cd backend
npm run start:dev
```

You should see:
```
[Nest] Application is running on: http://localhost:3001
Prisma Schema loaded
```

### Check if frontend starts:

```bash
cd frontend
npm run dev
```

You should see:
```
▲ Next.js ready
- Local: http://localhost:3000
```

---

## ✅ Configuration Checklist

- [ ] DATABASE_URL set correctly
- [ ] JWT_SECRET changed from default
- [ ] Frontend .env.local points to backend
- [ ] SMS API key (or empty for simulation)
- [ ] Email credentials (or empty for simulation)
- [ ] WhatsApp credentials (optional)
- [ ] Social media tokens (optional)
- [ ] Database migrated
- [ ] Prisma client generated

---

## 🚨 Common Configuration Issues

### Issue: "Cannot connect to database"
**Solution**: Check DATABASE_URL format
```
postgresql://username:password@host:port/database
```

### Issue: "Port already in use"
**Solution**: Change PORT in .env or kill the process
```bash
# Find process using port 3001
netstat -ano | findstr :3001
taskkill /PID <pid> /F
```

### Issue: "CORS error in browser"
**Solution**: Ensure FRONTEND_URL matches exactly
```
FRONTEND_URL="http://localhost:3000"
```

### Issue: "Module not found"
**Solution**: Reinstall dependencies
```bash
rm -rf node_modules
npm install
```

---

## 📝 Configuration Files Location

- **Backend**: `backend/.env`
- **Frontend**: `frontend/.env.local`
- **Prisma**: `backend/prisma/schema.prisma` (database schema)
- **Generated**: `backend/node_modules/.prisma` (Prisma client)

---

## 🔐 Security Best Practices

1. **Never commit .env files to git**
   ```gitignore
   # Add to .gitignore
   .env
   .env.local
   ```

2. **Use strong JWT_SECRET**
   - Minimum 32 characters
   - Use random string generator

3. **Protect API keys**
   - Use environment variables, not hardcoded values
   - Rotate keys periodically

4. **Database credentials**
   - Use strong passwords
   - Don't use default postgres password

5. **HTTPS in production**
   - Use SSL certificates
   - Force HTTPS redirect

---

## 📞 Need Help?

If you need help setting up specific APIs:
- **Africa's Talking**: https://docs.africastalking.com/sms
- **Twilio**: https://www.twilio.com/docs
- **WhatsApp**: https://developers.facebook.com/docs/whatsapp
- **YouTube**: https://developers.google.com/youtube/v3
- **LinkedIn**: https://learn.microsoft.com/en-us/linkedin/

---

**Next: See TESTING_GUIDE.md for how to test the system! 🚀**
