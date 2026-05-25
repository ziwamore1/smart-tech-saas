# SmartTech - School Intelligence Platform

A cross-platform mobile application built with React Native (Expo) for school management, covering attendance, exam results, report cards, timetables, communication, and intelligence analytics.

## Tech Stack

- **Framework**: React Native 0.81 via Expo SDK 54
- **Navigation**: React Navigation 7 (Native Stack + Bottom Tabs)
- **State Management**: Zustand with AsyncStorage persistence
- **HTTP Client**: Axios
- **UI**: expo-linear-gradient, custom themed components
- **Runtime**: Hermes engine

## Project Structure

```
SmartTechApp/
├── App.tsx                          # Root component
├── app.config.js                    # Expo configuration
├── src/
│   ├── components/                  # Reusable UI components
│   │   ├── Avatar.tsx              # User/student photo with initials fallback
│   │   ├── Button.tsx              # Themed button (primary/secondary/outline/danger)
│   │   ├── Card.tsx                # Themed card (default/elevated/outlined)
│   │   ├── GradientCard.tsx        # Card with LinearGradient background
│   │   ├── Input.tsx               # Themed text input with password toggle
│   │   ├── Loading.tsx             # Full-screen or inline loading indicator
│   │   └── editor/                 # Report template editor components
│   ├── screens/
│   │   ├── auth/LoginScreen.tsx     # Authentication with gradient branding
│   │   ├── common/                  # Shared screens
│   │   │   ├── ProfileScreen.tsx    # User profile with photo upload, edit, password change
│   │   │   └── NotificationsScreen.tsx
│   │   ├── student/                 # Student dashboard, results, timetable, attendance
│   │   ├── parent/                  # Parent dashboard, children, results
│   │   ├── teacher/                 # Teacher dashboard, classes, marks entry
│   │   ├── class-teacher/           # Class teacher dashboard, students, analytics, photos
│   │   ├── director/                # Director/head teacher dashboard
│   │   ├── exam/                    # Exam CRUD, taking, results, analytics
│   │   ├── intelligence/            # AI tutor, learning style, analytics
│   │   ├── templates/               # Template builder, marketplace, branding
│   │   ├── assets/                  # Cloud asset library
│   │   ├── signature/               # Digital signatures
│   │   ├── collaboration/           # Real-time collaboration
│   │   └── editor/                  # Document/Report editor
│   ├── navigation/                  # Stack & tab navigators
│   │   ├── AppNavigator.tsx         # Root navigator with auth gating
│   │   └── ClassTeacherTabNavigator.tsx
│   ├── services/api.ts             # Axios API service with JWT interceptor
│   ├── store/index.ts              # Zustand stores (auth, app, cache)
│   ├── theme/index.ts              # Colors, spacing, typography, shadows
│   └── types/index.ts              # TypeScript interfaces
```

## Screens by Role

| Role | Screens |
|------|---------|
| **Student** | Dashboard, Results, Timetable, Attendance, Learning Style, AI Tutor, Analytics |
| **Parent** | Dashboard, Children, Child Results, Report Cards |
| **Teacher** | Dashboard, Classes, Marks Entry, Attendance |
| **Class Teacher** | Dashboard + Tab Navigator (Dashboard, Students, Messages, Photos, Analytics, Profile) |
| **Director** | Dashboard |
| **All Roles** | Profile, Notifications, Document Editor, Template Builder, Exam Center |

## Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your API base URL

# Start Expo dev server
npx expo start --host lan
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_BASE_URL` | `http://192.168.43.134:3001/api/v1` | Backend API endpoint |
| `APP_NAME` | `SmartTech` | Display app name |
| `APP_VERSION` | `1.0.0` | App version |

The API base URL can also be configured in `app.config.js` under `extra.apiBaseUrl`.

## Key Features

- **Role-based navigation**: UI adapts to Student, Parent, Teacher, Class Teacher, Director
- **JWT authentication**: Token persisted via AsyncStorage, auto-refreshed
- **Profile management**: Photo upload (camera/gallery), name/email/phone editing, password change
- **Student photos**: Class Teacher can upload individual or bulk passport-style photos
- **Exam center**: Create, take, and auto-mark exams with analytics
- **Report template builder**: Drag-and-drop editor with AI-powered layout generation
- **Intelligence suite**: AI tutor, learning style assessment, psychometric analysis, growth tracking
- **Offline cache**: Timetable, results, and attendance data cached for 15 minutes
- **Push notifications**: Expo Notifications integration with device token management

## Styling

All theme values (colors, spacing, typography, shadows) are centralized in `src/theme/index.ts`. Components consume these values rather than using hardcoded constants.

Primary palette: Deep blue (`#1E3A8A`) with teal (`#14B8A6`) and amber accent (`#F59E0B`).

## Backend

This app requires the SmartTech backend (NestJS + PostgreSQL + Prisma) running at the configured API URL. See `../backend/` for the backend source.
