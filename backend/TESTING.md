# SmartTech Backend - Testing Guide

## Prerequisites

1. **Database must be running** (PostgreSQL on localhost:5432)
2. **Redis must be running** (for queues - optional for basic testing)

## Quick Test Steps

### Step 1: Start Database
```bash
# If using Docker:
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=ziwamore1 -e POSTGRES_DB=school_saas postgres

# Or ensure your local PostgreSQL is running
```

### Step 2: Run Basic Database Test
```bash
node test-basic.js
```

### Step 3: Start the Server
```bash
npm run start:dev
```
Server should start on http://localhost:3001/api/v1

### Step 4: Test Endpoints with curl

```bash
# Base URL
BASE="http://localhost:3001/api/v1"

# 1. Login (get token)
LOGIN_RESP=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.com","password":"password123"}')

echo "$LOGIN_RESP" | jq .

# Extract token
TOKEN=$(echo "$LOGIN_RESP" | jq -r '.access_token')

# 2. Test Dashboard
curl -s "$BASE/mobile/dashboard" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 3. Test Parents
curl -s "$BASE/parent/children" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 4. Test Attendance
curl -s "$BASE/attendance/stats?schoolId=YOUR_SCHOOL_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 5. Test Messages
curl -s "$BASE/messages" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 6. Test Notifications
curl -s "$BASE/mobile/notifications" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

## Test with Newman (API Collection)

Import this collection into Postman or use Newman:

```json
{
  "info": {
    "name": "SmartTech API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Login",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/auth/login",
        "body": { "mode": "raw", "raw": "{\"email\":\"admin@school.com\",\"password\":\"password123\"}" }
      }
    },
    {
      "name": "Dashboard",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/mobile/dashboard"
      }
    }
  ]
}
```

## Running Unit Tests

```bash
# Run all tests
npm test

# Run specific module tests
npm test -- attendance
npm test -- parent
npm test -- mobile
```

## Expected Responses

### Login
```json
{
  "message": "Login successful",
  "access_token": "eyJhbGciOi...",
  "user": {
    "id": "...",
    "email": "...",
    "roles": ["Director"],
    "schoolId": "..."
  }
}
```

### Dashboard
```json
{
  "currentTerm": { "id": "...", "name": "Term 1" },
  "userType": "teacher",
  "stats": { "totalClasses": 3 },
  "recentAnnouncements": [...]
}
```
