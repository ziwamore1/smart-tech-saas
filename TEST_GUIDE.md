# Smart Tech SaaS - Testing Guide

## Quick Start

To start the entire system and run tests:

```bash
cd C:\Smart_Tech SaaS System
node quick-start.js
```

This will:
1. Start the Backend Server (port 3001)
2. Start the Frontend Server (port 3000)
3. Provide an interactive menu to control everything

## Manual Testing

### 1. Start Backend
```bash
cd C:\Smart_Tech SaaS System\backend
npm run start:dev
```

### 2. Start Frontend
```bash
cd C:\Smart_Tech SaaS System\frontend
npm run dev
```

### 3. Run API Tests
```bash
cd C:\Smart_Tech SaaS System
node test-api.js
```

## Test API Endpoints

### Health Check
```bash
curl http://localhost:3001/api/v1/health
```

### Feature Locks
```bash
# Get all feature locks
curl http://localhost:3001/api/v1/feature-locks

# Get single feature
curl http://localhost:3001/api/v1/feature-locks/timetable.generate

# Check access for a school
curl http://localhost:3001/api/v1/subscription/check/{schoolId}/timetable.generate
```

### Subscription Plans
```bash
# Get all plans
curl http://localhost:3001/api/v1/subscription/plans

# Get plan by ID
curl http://localhost:3001/api/v1/subscription/plans/{planId}
```

### Schools
```bash
# Get all schools
curl http://localhost:3001/api/v1/super-admin/schools

# Get school by ID
curl http://localhost:3001/api/v1/super-admin/schools/{schoolId}

# Get school features
curl http://localhost:3001/api/v1/feature-locks/access/{schoolId}
```

## Test URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| API Docs | http://localhost:3001/api (if enabled) |

## Test Scenarios

### 1. Model Lock Management (Super Admin)
1. Login to Super Admin dashboard
2. Navigate to `/super-admin/model-locks`
3. View all features with their tier requirements
4. Lock/unlock individual features
5. Change minimum tier for features

### 2. Subscription Plans (Super Admin)
1. Navigate to `/super-admin/subscription-plans`
2. View all subscription plans (BASIC, STANDARD, PREMIUM)
3. Create new plans
4. Edit existing plans
5. Activate/deactivate plans

### 3. School Subscription (School Director)
1. Login as school director
2. View school's current subscription tier
3. See available features based on tier
4. Upgrade subscription if needed

## Test Data

### Feature Locks
- 38 feature locks configured
- Categories: students, teachers, classes, subjects, timetable, results, fees, communications, analytics, reports, integrations, advanced

### Subscription Plans
- **BASIC** - ZMW 2,900/month (22 features, 100 students max)
- **STANDARD** - ZMW 7,900/month (32 features, 500 students max)
- **PREMIUM** - ZMW 14,900/month (40 features, unlimited)

### Tier Access
| Feature Type | BASIC | STANDARD | PREMIUM |
|-------------|-------|----------|---------|
| Basic View/Add | ✓ | ✓ | ✓ |
| Bulk Import | ✓ | ✓ | ✓ |
| Advanced Features | ✗ | ✓ | ✓ |
| AI Features | ✗ | ✗ | ✓ |
| Webhooks/SSO | ✗ | ✗ | ✓ |
