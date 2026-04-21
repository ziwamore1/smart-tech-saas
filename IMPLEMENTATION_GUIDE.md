# Smart Tech SaaS System - Communications & Analytics Implementation Guide

## Overview
This document provides instructions for implementing and using the new Communications Center and Analytics Dashboard features.

---

## 🚀 Backend Implementation

### 1. Communication Module

#### Files Created/Modified:
- ✅ `src/communication/communication.controller.ts` - REST API endpoints
- ✅ `src/communication/communication.service.ts` - Business logic
- ✅ `src/communication/communication.module.ts` - Module definition
- ✅ `src/app.module.ts` - Added CommunicationModule import

#### API Endpoints:

**Base URL:** `/api/v1/communications`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/communications` | List all communications (with filters) |
| GET | `/communications/:id` | Get communication by ID |
| POST | `/communications` | Create new communication |
| POST | `/communications/:id/send` | Send communication |
| POST | `/communications/:id/send-bulk` | Bulk send to specific recipients |
| DELETE | `/communications/:id` | Delete communication |
| GET | `/communications/stats` | Get communication statistics |
| GET | `/communications/settings` | Get platform settings |
| PUT | `/communications/settings` | Update platform settings |
| POST | `/communications/schedule` | Schedule communication |
| GET | `/communications/templates/list` | Get message templates |
| POST | `/communications/templates` | Create custom template |
| GET | `/communications/platforms/facebook` | Facebook analytics |
| GET | `/communications/platforms/youtube` | YouTube analytics |
| GET | `/communications/platforms/linkedin` | LinkedIn analytics |
| GET | `/communications/platforms/whatsapp` | WhatsApp analytics |
| GET | `/communications/alerts/realtime` | Get real-time alerts |
| POST | `/communications/alerts/sms` | Send emergency SMS alert |

#### Supported Platforms:
- 📱 SMS (Africa's Talking, Twilio)
- 📧 Email (SMTP)
- 💬 WhatsApp
- 📘 Facebook
- ▶️ YouTube
- 💼 LinkedIn
- 🔔 Push Notifications

#### Example Usage:

```bash
# Create SMS communication
curl -X POST http://localhost:3001/api/v1/communications \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SMS",
    "message": "Dear Parent, your child has an exam tomorrow.",
    "recipientType": "parent"
  }'

# Send communication
curl -X POST http://localhost:3001/api/v1/communications/<id>/send \
  -H "Authorization: Bearer <token>"

# Get statistics
curl http://localhost:3001/api/v1/communications/stats \
  -H "Authorization: Bearer <token>"

# Send emergency alert
curl -X POST http://localhost:3001/api/v1/communications/alerts/sms \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "School closing early due to weather",
    "priority": "high"
  }'
```

---

### 2. Analytics Module

#### Files Modified:
- ✅ `src/analytics/analytics.service.ts` - Added chart methods
- ✅ `src/analytics/analytics.controller.ts` - Added chart endpoints

#### API Endpoints:

**Base URL:** `/api/v1/analytics`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics/class-performance` | Class performance metrics |
| GET | `/analytics/class-ranking` | Student rankings |
| GET | `/analytics/subject-performance` | Subject analytics |
| GET | `/analytics/grade-distribution` | Grade distribution |
| GET | `/analytics/gender-performance` | Gender-based analytics |
| GET | `/analytics/teacher-performance` | Teacher metrics |
| GET | `/analytics/director-dashboard` | Full director dashboard |
| GET | `/analytics/heatmap/:classId/:termId` | Student performance heatmap |
| GET | `/analytics/alerts/:classId/:termId` | Performance alerts |
| GET | `/analytics/charts/pie` | Pie chart data (grade distribution) |
| GET | `/analytics/charts/line` | Line chart data (performance trends) |
| GET | `/analytics/charts/bar` | Bar chart data (subject comparison) |
| GET | `/analytics/charts/histogram` | Histogram data (score distribution) |
| GET | `/analytics/results-stats` | Student results statistics |
| GET | `/analytics/subscription-stats` | Subscription analytics |
| GET | `/analytics/dashboard-charts` | Combined dashboard data |

#### Chart Types:
- 🥧 **Pie Chart**: Grade distribution (A, B, C, D, F)
- 📈 **Line Chart**: Performance trends over terms
- 📊 **Bar Chart**: Subject-wise performance comparison
- 📉 **Histogram**: Score distribution (0-10, 11-20, ..., 91-100)

#### Example Usage:

```bash
# Get pie chart data
curl "http://localhost:3001/api/v1/analytics/charts/pie?classId=<class-id>" \
  -H "Authorization: Bearer <token>"

# Get line chart data
curl "http://localhost:3001/api/v1/analytics/charts/line?classId=<class-id>" \
  -H "Authorization: Bearer <token>"

# Get bar chart data
curl "http://localhost:3001/api/v1/analytics/charts/bar?classId=<class-id>&termId=<term-id>" \
  -H "Authorization: Bearer <token>"

# Get histogram
curl "http://localhost:3001/api/v1/analytics/charts/histogram?classId=<class-id>&termId=<term-id>" \
  -H "Authorization: Bearer <token>"

# Get student results statistics
curl "http://localhost:3001/api/v1/analytics/results-stats?termId=<term-id>" \
  -H "Authorization: Bearer <token>"

# Get subscription statistics
curl "http://localhost:3001/api/v1/analytics/subscription-stats" \
  -H "Authorization: Bearer <token>"
```

---

## 🎨 Frontend Implementation

### Files Created:

#### 1. API Services
- ✅ `lib/api.ts` - Added `communicationApi` and `analyticsApi`

#### 2. Type Definitions
- ✅ `types/communication.ts` - TypeScript types for all features

#### 3. Pages
- ✅ `app/dashboard/communications/page.tsx` - Communications Center
- ✅ `app/dashboard/analytics/page.tsx` - Analytics Dashboard

#### 4. Chart Components (SVG-based, no external dependencies)
- ✅ `components/charts/PieChart.tsx`
- ✅ `components/charts/LineChart.tsx`
- ✅ `components/charts/BarChart.tsx`
- ✅ `components/charts/Histogram.tsx`

#### 5. Navigation
- ✅ `app/dashboard/layout.tsx` - Added Communications and Analytics links

---

## 📱 Communications Center Features

### Dashboard:
- **Statistics Overview**: Total messages, sent, pending, failed
- **Platform Tabs**: SMS, Email, WhatsApp, Facebook, YouTube, LinkedIn
- **Platform Analytics**: Delivery rates, engagement metrics per platform
- **Recent Communications**: List of all sent messages

### Create Communication:
- **Platform Selection**: Choose delivery channel
- **Templates**: Pre-built message templates
- **Subject Line**: For email/social media
- **Message Body**: Compose message with character count
- **Recipients**: Students, Parents, Teachers, Directors, or All
- **Scheduling**: Schedule for later delivery

### Real-time Alerts:
- **Emergency Alerts**: Quick SMS to all users
- **Priority Levels**: High, Medium, Low
- **Alert History**: View all active alerts
- **Auto-refresh**: Updates every 30 seconds

### Settings:
- **SMS Configuration**: API keys, sender ID
- **Email Configuration**: SMTP settings
- **WhatsApp**: API credentials
- **Social Media**: Page IDs, access tokens
- **Enable/Disable**: Toggle platforms on/off

---

## 📈 Analytics Dashboard Features

### Views:
1. **Overview**
   - Grade distribution pie chart
   - Performance trend line chart
   - Class filter

2. **Student Results**
   - Score distribution histogram
   - Subject performance bar chart
   - Top performers list
   - Areas for improvement
   - Pass rate, average scores

3. **Subscription**
   - Current plan details
   - Student utilization rate
   - Payment collection statistics
   - Revenue tracking

4. **Performance**
   - Term-wise trends
   - Subject comparisons
   - Gender-based analysis

### Filters:
- **Class**: Select specific class
- **Term**: Filter by academic term
- **Subject**: Optional subject filter

---

## 🛠️ Implementation Steps

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies (if needed)
npm install

# Generate Prisma client
npx prisma generate

# Run migrations (if needed)
npx prisma migrate dev

# Start development server
npm run start:dev
```

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (if needed)
npm install

# Start development server
npm run dev
```

### 3. Access Pages

- **Communications**: http://localhost:3000/dashboard/communications
- **Analytics**: http://localhost:3000/dashboard/analytics

---

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```env
# Communication Services
SMS_API_KEY=your_sms_api_key
SMS_SENDER_ID=YourSchool
WHATSAPP_API_KEY=your_whatsapp_key

# Email (if using SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_password

# Social Media (optional)
FACEBOOK_ACCESS_TOKEN=your_token
YOUTUBE_API_KEY=your_key
LINKEDIN_ACCESS_TOKEN=your_token
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

---

## 📋 Prerequisites

### Backend:
- Node.js 18+
- PostgreSQL database
- Prisma ORM (already configured)
- NestJS framework (already set up)

### Frontend:
- Node.js 18+
- Next.js 16
- React 19
- Tailwind CSS (already configured)
- React Query (already configured)

---

## 🎯 Key Features

### Communications:
✅ Multi-platform messaging (SMS, Email, WhatsApp, Social Media)
✅ Bulk messaging capabilities
✅ Scheduled communications
✅ Message templates
✅ Real-time alerts
✅ Delivery tracking
✅ Platform analytics
✅ Engagement metrics

### Analytics:
✅ Interactive charts (Pie, Line, Bar, Histogram)
✅ Student performance tracking
✅ Subject analysis
✅ Grade distribution
✅ Top performers identification
✅ Improvement areas detection
✅ Subscription analytics
✅ Payment tracking

---

## 🔒 Security

- All endpoints protected with JWT authentication
- Role-based access control (RBAC)
- Input validation on all endpoints
- SQL injection prevention (via Prisma ORM)
- XSS protection in frontend

---

## 📊 Data Models

### Communication
- ID, Type, Status, Subject, Message
- Recipients (type and IDs)
- Scheduling information
- Delivery tracking
- Error handling
- Retry mechanism

### CommunicationLog
- Tracks all actions (sent, delivered, opened, clicked, bounced, failed)
- Recipient-specific data
- Timestamp

### CommunicationSettings
- Platform-specific credentials
- Enable/disable flags
- API keys and tokens

---

## 🚦 Status Flow

```
PENDING → SENT → DELIVERED
   ↓
FAILED ← (retry available)
   ↓
CANCELLED
```

---

## 📱 Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

---

## 🎓 Use Cases

### 1. Exam Results Notification
- Send SMS/WhatsApp to parents
- Post to Facebook/YouTube for public announcements
- Email detailed reports

### 2. Emergency Alerts
- Weather closures
- Security incidents
- Schedule changes
- Health emergencies

### 3. Event Announcements
- School events
- Parent meetings
- Sports days
- Prize-giving ceremonies

### 4. Performance Analytics
- Track student progress
- Identify struggling students
- Subject-wise performance
- Teacher effectiveness

### 5. Subscription Management
- Monitor student enrollment
- Track payment collection
- Plan utilization

---

## 🐛 Troubleshooting

### Backend Issues:
```bash
# Check logs
npm run start:dev

# Verify database connection
npx prisma db push

# Check Prisma client
npx prisma generate
```

### Frontend Issues:
```bash
# Check build errors
npm run build

# Clear cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
npm install
```

### Common Issues:
1. **Communication not sending**: Check API credentials in settings
2. **Charts not loading**: Ensure class and term are selected
3. **Real-time alerts not updating**: Check network connection
4. **Authentication errors**: Verify JWT token is valid

---

## 📞 Support

For issues or questions:
1. Check the console logs
2. Verify environment variables
3. Ensure database is accessible
4. Check API endpoints with Postman/curl

---

## 🔄 Future Enhancements

Potential additions:
- Email templates with HTML
- Rich media messages (images, videos)
- Message scheduling with cron jobs
- Delivery receipts
- Open/click tracking
- A/B testing for messages
- Advanced analytics with machine learning
- Export reports to PDF/Excel
- Mobile app integration
- Push notification service workers

---

## ✅ Checklist

Before going live:

- [ ] Backend running on port 3001
- [ ] Frontend running on port 3000
- [ ] Database migrated and seeded
- [ ] Communication API keys configured
- [ ] Social media credentials set
- [ ] JWT authentication working
- [ ] All endpoints tested
- [ ] Charts rendering correctly
- [ ] Real-time alerts functioning
- [ ] Error handling in place
- [ ] Logs configured
- [ ] Environment variables set

---

## 🎉 Getting Started

1. Start backend: `npm run start:dev` (backend folder)
2. Start frontend: `npm run dev` (frontend folder)
3. Login at http://localhost:3000/login
4. Navigate to Communications or Analytics
5. Create your first communication!
6. Explore analytics dashboards!

---

**Enjoy the enhanced Smart Tech SaaS System! 🚀**
