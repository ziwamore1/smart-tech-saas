import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ProfileScreen } from '../screens/common/ProfileScreen';
import { NotificationsScreen } from '../screens/common/NotificationsScreen';
import { QRScannerScreen } from '../screens/common/QRScannerScreen';
import { VerificationResultScreen } from '../screens/common/VerificationResultScreen';
import { ManualVerificationScreen } from '../screens/common/ManualVerificationScreen';
import { StudentDashboardScreen } from '../screens/student/DashboardScreen';
import { StudentResultsScreen } from '../screens/student/ResultsScreen';
import { StudentTimetableScreen } from '../screens/student/TimetableScreen';
import { StudentAttendanceScreen } from '../screens/student/AttendanceScreen';
import { ParentDashboardScreen } from '../screens/parent/DashboardScreen';
import { ParentChildrenScreen } from '../screens/parent/ChildrenScreen';
import { ParentChildResultsScreen } from '../screens/parent/ChildResultsScreen';
import { TeacherDashboardScreen } from '../screens/teacher/DashboardScreen';
import { TeacherClassesScreen } from '../screens/teacher/ClassesScreen';
import { TeacherMarksScreen } from '../screens/teacher/MarksScreen';
import { DirectorTabNavigator } from './DirectorTabNavigator';
import { ClassTeacherTabNavigator } from './ClassTeacherTabNavigator';
import { LearningStyleScreen } from '../screens/intelligence/LearningStyleScreen';
import { AiTutorScreen } from '../screens/intelligence/AiTutorScreen';
import { AnalyticsScreen } from '../screens/intelligence/AnalyticsScreen';
import { DocumentEditorScreen } from '../screens/editor/DocumentEditorScreen';
import { TemplateMarketplaceScreen } from '../screens/templates/TemplateMarketplaceScreen';
import { AITemplateGeneratorScreen } from '../screens/templates/AITemplateGeneratorScreen';
import { BrandingPresetsScreen } from '../screens/templates/BrandingPresetsScreen';
import { CloudAssetLibraryScreen } from '../screens/assets/CloudAssetLibraryScreen';
import { DigitalSignatureScreen } from '../screens/signature/DigitalSignatureScreen';
import { CollaborationScreen } from '../screens/collaboration/CollaborationScreen';
import { ExamListScreen } from '../screens/exam/ExamListScreen';
import { ExamDetailScreen } from '../screens/exam/ExamDetailScreen';
import { ExamCreateScreen } from '../screens/exam/ExamCreateScreen';
import { ExamTakingScreen } from '../screens/exam/ExamTakingScreen';
import { ExamResultsScreen } from '../screens/exam/ExamResultsScreen';
import { ExamAnalyticsScreen } from '../screens/exam/ExamAnalyticsScreen';
import { DigitalStampScreen } from '../screens/stamps/DigitalStampScreen';
import { PDFPreviewScreen } from '../screens/stamps/PDFPreviewScreen';
import { QRVerificationScreen } from '../screens/stamps/QRVerificationScreen';
import { ApprovalWorkflowScreen } from '../screens/stamps/ApprovalWorkflowScreen';
import { AssessmentEntryScreen } from '../screens/assessment/AssessmentEntryScreen';
import { AssessmentConfigScreen } from '../screens/assessment/AssessmentConfigScreen';
import { PendingAssessmentsScreen } from '../screens/assessment/PendingAssessmentsScreen';

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  const { isAuthenticated, user } = useAuthStore();
  const isStudent = user?.roles?.includes('Student');
  const isParent = user?.roles?.includes('Parent');
  const isClassTeacher = user?.roles?.includes('Class Teacher');
  const isTeacher = user?.roles?.includes('Teacher') && !isClassTeacher;
  const isDirector = user?.roles?.includes('Director') || user?.roles?.includes('Head Teacher') || user?.roles?.includes('Deputy');
  const hasRoleDashboard = isStudent || isParent || isClassTeacher || isTeacher || isDirector;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            {isStudent && <Stack.Screen name="StudentDashboard" component={StudentDashboardScreen} />}
            {isParent && <Stack.Screen name="ParentDashboard" component={ParentDashboardScreen} />}
            {isClassTeacher && <Stack.Screen name="ClassTeacherTabNavigator" component={ClassTeacherTabNavigator} />}
            {isTeacher && <Stack.Screen name="TeacherDashboard" component={TeacherDashboardScreen} />}
            {isDirector && <Stack.Screen name="DirectorDashboard" component={DirectorTabNavigator} />}
            {!hasRoleDashboard && (
              <Stack.Screen name="StudentDashboard" component={StudentDashboardScreen} />
            )}

            {isStudent && <Stack.Screen name="StudentResults" component={StudentResultsScreen} />}
            {isStudent && <Stack.Screen name="StudentTimetable" component={StudentTimetableScreen} />}
            {isStudent && <Stack.Screen name="StudentAttendance" component={StudentAttendanceScreen} />}

            {isParent && <Stack.Screen name="ParentChildren" component={ParentChildrenScreen} />}
            {isParent && <Stack.Screen name="ParentChildResults" component={ParentChildResultsScreen} />}

            {(isTeacher || isClassTeacher) && <Stack.Screen name="TeacherClasses" component={TeacherClassesScreen} />}
            {(isTeacher || isClassTeacher) && <Stack.Screen name="TeacherMarks" component={TeacherMarksScreen} />}

            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="LearningStyle" component={LearningStyleScreen} />
            <Stack.Screen name="AiTutor" component={AiTutorScreen} />
            <Stack.Screen name="Analytics" component={AnalyticsScreen} />
            <Stack.Screen name="DocumentEditor" component={DocumentEditorScreen} />
            <Stack.Screen name="TemplateMarketplace" component={TemplateMarketplaceScreen} />
            <Stack.Screen name="AITemplateGenerator" component={AITemplateGeneratorScreen} />
            <Stack.Screen name="BrandingPresets" component={BrandingPresetsScreen} />
            <Stack.Screen name="CloudAssetLibrary" component={CloudAssetLibraryScreen} />
            <Stack.Screen name="DigitalSignature" component={DigitalSignatureScreen} />
            <Stack.Screen name="Collaboration" component={CollaborationScreen} />
            <Stack.Screen name="ExamList" component={ExamListScreen} />
            <Stack.Screen name="ExamDetail" component={ExamDetailScreen} />
            <Stack.Screen name="ExamCreate" component={ExamCreateScreen} />
            <Stack.Screen name="ExamTaking" component={ExamTakingScreen} />
            <Stack.Screen name="ExamResults" component={ExamResultsScreen} />
            <Stack.Screen name="ExamAnalytics" component={ExamAnalyticsScreen} />
            <Stack.Screen name="DigitalStamps" component={DigitalStampScreen} />
            <Stack.Screen name="PDFPreview" component={PDFPreviewScreen} />
            <Stack.Screen name="QRVerification" component={QRVerificationScreen} />
            <Stack.Screen name="ApprovalWorkflow" component={ApprovalWorkflowScreen} />

            {/* Assessment Screens */}
            {(isTeacher || isClassTeacher) && <Stack.Screen name="PendingAssessments" component={PendingAssessmentsScreen} />}
            {(isTeacher || isClassTeacher) && <Stack.Screen name="AssessmentEntry" component={AssessmentEntryScreen} />}
            {(isTeacher || isClassTeacher) && <Stack.Screen name="AssessmentConfig" component={AssessmentConfigScreen} />}

            {/* Verification Screens */}
            <Stack.Screen name="QRScanner" component={QRScannerScreen} />
            <Stack.Screen name="VerificationResult" component={VerificationResultScreen} />
            <Stack.Screen name="ManualVerification" component={ManualVerificationScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
