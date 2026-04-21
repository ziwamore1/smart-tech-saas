# Testing Guide

This guide provides step-by-step instructions to test all features of the Communications Center and Analytics Dashboard.

---

## 🧪 Prerequisites

Before testing, ensure:

1. **Backend is running** on http://localhost:3001
2. **Frontend is running** on http://localhost:3000
3. **Database is migrated** and has data
4. **You have a user account** to login with

---

## 📋 Testing Checklist

### Phase 1: Authentication
- [ ] Login to the system
- [ ] Get JWT token
- [ ] Access protected endpoints

### Phase 2: Communications
- [ ] View communications page
- [ ] Create SMS communication
- [ ] Send communication
- [ ] View statistics
- [ ] Create scheduled communication
- [ ] View message templates
- [ ] Test emergency alerts
- [ ] Configure settings

### Phase 3: Analytics
- [ ] View analytics page
- [ ] Load pie chart data
- [ ] Load line chart data
- [ ] Load bar chart data
- [ ] Load histogram data
- [ ] View student results stats
- [ ] View subscription stats

---

## 🚀 Phase 1: Authentication Testing

### Step 1: Login

Use Postman, curl, or browser to login:

**Endpoint**: `POST http://localhost:3001/api/v1/auth/login`

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-uuid",
      "email": "your-email@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "schoolId": "school-uuid",
      "roles": ["Director"]
    }
  }
}
```

**Save the token** - you'll need it for all subsequent requests:
```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 📱 Phase 2: Communications Testing

### Step 2: Get Communication Statistics

```bash
curl -X GET "http://localhost:3001/api/v1/communications/stats" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response**:
```json
{
  "total": 0,
  "byType": [],
  "byStatus": [],
  "recentActivity": []
}
```

### Step 3: Create SMS Communication

```bash
curl -X POST http://localhost:3001/api/v1/communications \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SMS",
    "message": "Dear Parent, your child has an exam tomorrow. Please ensure they are prepared.",
    "recipientType": "parent"
  }'
```

**Expected Response**:
```json
{
  "id": "comm-uuid",
  "type": "SMS",
  "status": "PENDING",
  "message": "Dear Parent, your child has an exam tomorrow. Please ensure they are prepared.",
  "recipientType": "parent",
  "recipientIds": [],
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Save the communication ID**:
```bash
COMM_ID="comm-uuid-from-response"
```

### Step 4: Send Communication

```bash
curl -X POST "http://localhost:3001/api/v1/communications/$COMM_ID/send" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response** (in simulation mode):
```json
{
  "success": true,
  "details": {
    "recipientsCount": 0
  }
}
```

**Backend logs should show**:
```
[CommunicationService] [SMS API] To: [phone], Message: Dear Parent...
```

### Step 5: List All Communications

```bash
curl -X GET "http://localhost:3001/api/v1/communications" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response**:
```json
{
  "communications": [
    {
      "id": "comm-uuid",
      "type": "SMS",
      "status": "SENT",
      "message": "Dear Parent...",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "sentAt": "2024-01-01T00:00:01.000Z"
    }
  ],
  "total": 1
}
```

### Step 6: Create WhatsApp Communication

```bash
curl -X POST http://localhost:3001/api/v1/communications \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "WHATSAPP",
    "subject": "School Event",
    "message": "Dear Parents, You are invited to the annual prize-giving ceremony on Friday.",
    "recipientType": "all"
  }'
```

### Step 7: Get Message Templates

```bash
curl -X GET "http://localhost:3001/api/v1/communications/templates/list" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response**:
```json
[
  {
    "id": "1",
    "name": "Exam Results Notification",
    "type": "SMS",
    "subject": "Exam Results Available",
    "message": "Dear Parent, Your child's exam results for {term} are now available..."
  },
  {
    "id": "2",
    "name": "Fee Reminder",
    "type": "SMS",
    "message": "Dear Parent, This is a reminder that school fees for {term} are due..."
  }
]
```

### Step 8: Schedule Communication

```bash
curl -X POST http://localhost:3001/api/v1/communications/schedule \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "EMAIL",
    "subject": "Weekly Update",
    "message": "This is your weekly school newsletter.",
    "recipientType": "all",
    "scheduledAt": "2024-01-15T09:00:00.000Z"
  }'
```

**Expected Response**:
```json
{
  "id": "scheduled-uuid",
  "type": "EMAIL",
  "status": "SCHEDULED",
  "scheduledAt": "2024-01-15T09:00:00.000Z"
}
```

### Step 9: Send Emergency Alert

```bash
curl -X POST http://localhost:3001/api/v1/communications/alerts/sms \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "School will be closed tomorrow due to heavy rainfall.",
    "priority": "high"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "communicationId": "alert-uuid",
  "sentAt": "2024-01-01T00:00:00.000Z"
}
```

### Step 10: Get Real-time Alerts

```bash
curl -X GET "http://localhost:3001/api/v1/communications/alerts/realtime" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response**:
```json
[
  {
    "type": "UNPAID_FEES",
    "priority": "medium",
    "count": 15,
    "message": "15 students have unpaid fees. Consider sending payment reminders.",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
]
```

### Step 11: Get Platform Analytics

```bash
# Facebook Analytics
curl -X GET "http://localhost:3001/api/v1/communications/platforms/facebook" \
  -H "Authorization: Bearer $TOKEN"

# YouTube Analytics
curl -X GET "http://localhost:3001/api/v1/communications/platforms/youtube" \
  -H "Authorization: Bearer $TOKEN"

# LinkedIn Analytics
curl -X GET "http://localhost:3001/api/v1/communications/platforms/linkedin" \
  -H "Authorization: Bearer $TOKEN"

# WhatsApp Analytics
curl -X GET "http://localhost:3001/api/v1/communications/platforms/whatsapp" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response** (for Facebook):
```json
{
  "platform": "FACEBOOK",
  "overview": {
    "total": 0,
    "sent": 0,
    "failed": 0,
    "pending": 0,
    "deliveryRate": 0,
    "failureRate": 0
  },
  "recentPosts": [],
  "engagement": {
    "likes": 0,
    "shares": 0,
    "comments": 0
  }
}
```

---

## 📈 Phase 3: Analytics Testing

### Step 12: Get Pie Chart Data

```bash
curl -X GET "http://localhost:3001/api/v1/analytics/charts/pie" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response** (if you have student results):
```json
{
  "labels": ["A (80-100)", "B (70-79)", "C (60-69)", "D (50-59)", "F (Below 50)"],
  "datasets": [
    {
      "data": [15, 20, 25, 10, 5],
      "backgroundColor": ["#22c55e", "#3b82f6", "#f59e0b", "#f97316", "#ef4444"]
    }
  ]
}
```

### Step 13: Get Line Chart Data

```bash
# First, get a class ID from your database
curl -X GET "http://localhost:3001/api/v1/class" \
  -H "Authorization: Bearer $TOKEN"

# Then use the class ID
curl -X GET "http://localhost:3001/api/v1/analytics/charts/line?classId=YOUR_CLASS_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response**:
```json
{
  "labels": ["Term 1 2024", "Term 2 2024", "Term 3 2024"],
  "datasets": [
    {
      "label": "Average Score",
      "data": [65.5, 68.2, 72.1],
      "borderColor": "#3b82f6",
      "backgroundColor": "rgba(59, 130, 246, 0.1)",
      "tension": 0.4,
      "fill": true
    }
  ]
}
```

### Step 14: Get Bar Chart Data

```bash
# First, get a term ID
curl -X GET "http://localhost:3001/api/v1/term" \
  -H "Authorization: Bearer $TOKEN"

# Then use both class ID and term ID
curl -X GET "http://localhost:3001/api/v1/analytics/charts/bar?classId=YOUR_CLASS_ID&termId=YOUR_TERM_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response**:
```json
{
  "labels": ["Mathematics", "English", "Science", "History"],
  "datasets": [
    {
      "label": "Average",
      "data": [72.5, 68.3, 75.2, 65.8],
      "backgroundColor": "#3b82f6"
    },
    {
      "label": "Highest",
      "data": [95, 88, 98, 90],
      "backgroundColor": "#22c55e"
    },
    {
      "label": "Lowest",
      "data": [45, 52, 40, 48],
      "backgroundColor": "#ef4444"
    }
  ]
}
```

### Step 15: Get Histogram Data

```bash
curl -X GET "http://localhost:3001/api/v1/analytics/charts/histogram?classId=YOUR_CLASS_ID&termId=YOUR_TERM_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response**:
```json
{
  "labels": ["0-10", "11-20", "21-30", "31-40", "41-50", "51-60", "61-70", "71-80", "81-90", "91-100"],
  "datasets": [
    {
      "label": "Number of Students",
      "data": [0, 1, 2, 5, 8, 12, 18, 15, 7, 3],
      "backgroundColor": "rgba(59, 130, 246, 0.6)",
      "borderColor": "rgba(59, 130, 246, 1)",
      "borderWidth": 1
    }
  ]
}
```

### Step 16: Get Student Results Statistics

```bash
curl -X GET "http://localhost:3001/api/v1/analytics/results-stats?termId=YOUR_TERM_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response**:
```json
{
  "overview": {
    "totalExams": 150,
    "passedExams": 125,
    "failedExams": 25,
    "passRate": 83.33,
    "averageScore": 68.5
  },
  "byGender": [
    { "gender": "Male", "average": 66.2 },
    { "gender": "Female", "average": 70.8 }
  ],
  "topPerformers": [
    { "studentId": "uuid", "name": "John Doe", "average": 92.5 },
    { "studentId": "uuid", "name": "Jane Smith", "average": 90.2 }
  ],
  "improvementAreas": [
    { "subjectId": "uuid", "subject": "Mathematics", "average": 55.3, "passRate": 45.2 }
  ]
}
```

### Step 17: Get Subscription Statistics

```bash
curl -X GET "http://localhost:3001/api/v1/analytics/subscription-stats" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response**:
```json
{
  "subscription": {
    "plan": "Professional",
    "status": "ACTIVE",
    "startDate": "2024-01-01",
    "endDate": "2025-01-01",
    "maxStudents": 500
  },
  "students": {
    "total": 245,
    "active": 230,
    "inactive": 15,
    "utilizationRate": 49.0
  },
  "payments": {
    "totalRevenue": 125000,
    "paidCount": 180,
    "pendingCount": 15,
    "pendingAmount": 7500,
    "collectionRate": 94.0
  },
  "revenueHistory": [
    { "date": "2024-01-15", "amount": 5000, "status": "PAID" }
  ]
}
```

### Step 18: Get Dashboard Charts (Combined)

```bash
curl -X GET "http://localhost:3001/api/v1/analytics/dashboard-charts" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response**: Combination of all chart data and stats

---

## 🖥️ Phase 4: Frontend Testing

### Test Communications Page

1. **Open Browser**: http://localhost:3000
2. **Login**: Use your credentials
3. **Navigate**: Click "📱 Communications" in sidebar
4. **Test Tab Navigation**: Click through SMS, Email, WhatsApp, Facebook, YouTube, LinkedIn tabs
5. **Create Message**:
   - Click "+ New Communication"
   - Select platform (e.g., SMS)
   - Enter message: "Test message from Smart Tech"
   - Select recipients: "All"
   - Click "Create"
6. **Send Message**:
   - Find the message in list
   - Click "Send Now"
   - Check logs in backend console
7. **View Stats**: Check statistics cards at top
8. **Test Settings**: Click "⚙️ Settings"
   - Configure SMS (even dummy values)
   - Click "Save Settings"

### Test Analytics Page

1. **Navigate**: Click "📈 Analytics" in sidebar
2. **View Overview**:
   - Select a class from dropdown
   - Pie chart should render
   - Line chart should render
3. **View Student Results**:
   - Click "Student Results" tab
   - Select class and term
   - View histogram
   - View bar chart
   - Check top performers list
4. **View Subscription**:
   - Click "Subscription" tab
   - View plan details
   - View student utilization
   - View payment statistics
5. **View Performance**:
   - Click "Performance" tab
   - Select class and term
   - View line and bar charts

---

## 🔍 Troubleshooting Test Failures

### Issue: "401 Unauthorized"
**Solution**: Token expired or not provided
- Re-login and get fresh token
- Ensure token is in Authorization header

### Issue: "404 Not Found"
**Solution**: Endpoint doesn't exist or wrong URL
- Check API base URL matches
- Verify route is correct

### Issue: "500 Internal Server Error"
**Solution**: Backend error
- Check backend console logs
- Verify database connection
- Check Prisma models match

### Issue: "Empty arrays in response"
**Solution**: No data in database
- Ensure you have students, results, etc.
- Run seed script if available

### Issue: "Charts not rendering"
**Solutions**:
1. Check browser console for errors
2. Ensure class and term are selected
3. Verify API is returning data
4. Check network tab for failed requests

### Issue: "Connection refused"
**Solutions**:
1. Ensure backend is running
2. Check PORT in .env
3. Verify CORS settings

---

## ✅ Test Completion Checklist

Mark each as you test:

### Authentication
- [ ] Can login successfully
- [ ] JWT token received
- [ ] Can access protected endpoints

### Communications
- [ ] Can view communications page
- [ ] Can create SMS communication
- [ ] Can send communication
- [ ] Can view statistics
- [ ] Can schedule communication
- [ ] Can view templates
- [ ] Can send emergency alert
- [ ] Can view platform analytics

### Analytics
- [ ] Can view analytics page
- [ ] Pie chart loads
- [ ] Line chart loads
- [ ] Bar chart loads
- [ ] Histogram loads
- [ ] Student results stats load
- [ ] Subscription stats load
- [ ] Can filter by class
- [ ] Can filter by term

### Frontend
- [ ] Communications page loads
- [ ] Analytics page loads
- [ ] Navigation works
- [ ] Forms submit correctly
- [ ] Modals open/close
- [ ] Charts render
- [ ] No console errors

---

## 📊 Expected Test Results

### With Sample Data

If you have sample data, you should see:
- **Pie Chart**: Grade distribution with colors
- **Line Chart**: Upward/downward trend line
- **Bar Chart**: Multiple bars for subjects
- **Histogram**: Score distribution curve
- **Stats**: Numbers in cards
- **Lists**: Communication history

### Without Sample Data

If database is empty, you should see:
- Empty states with helpful messages
- "No communications found"
- "Select a class to view data"
- Forms still work
- Create buttons functional

---

## 🎯 Success Criteria

Your system is working correctly if:

1. ✅ Backend starts without errors
2. ✅ Frontend starts without errors
3. ✅ Can login and get token
4. ✅ Can create communication via API
5. ✅ Can send communication
6. ✅ Can retrieve statistics
7. ✅ Can get chart data
8. ✅ Frontend loads communications page
9. ✅ Frontend loads analytics page
10. ✅ Charts render with data
11. ✅ Can filter data
12. ✅ Navigation works

---

## 🚀 Final Steps

After successful testing:

1. **Configure Real APIs** (optional but recommended)
   - Get SMS provider credentials
   - Set up WhatsApp Business
   - Configure social media tokens

2. **Add Sample Data** (for demo)
   ```bash
   cd backend
   npx prisma db seed
   ```

3. **Take Screenshots**
   - Communications page
   - Analytics charts
   - Settings page

4. **Test Edge Cases**
   - Empty database
   - Large datasets
   - Network failures
   - Invalid inputs

5. **Performance Check**
   - Page load time < 2s
   - API response time < 500ms
   - Charts render smoothly

---

## 📞 Need Help?

If tests fail:
1. Check backend logs
2. Check browser console
3. Verify environment variables
4. Ensure database is accessible
5. Check API endpoints with curl

---

**All tests completed successfully? 🎉**

Your Communications Center and Analytics Dashboard are ready for production use!
