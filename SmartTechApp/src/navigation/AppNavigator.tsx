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
import { UserGuideScreen } from '../screens/common/UserGuideScreen';
import { StudentDashboardScreen } from '../screens/student/DashboardScreen';
import { PrimaryStudentResultsScreen } from '../screens/student/PrimaryStudentResultsScreen';
import { StudentResultsScreen } from '../screens/student/ResultsScreen';
import { StudentTimetableScreen } from '../screens/student/TimetableScreen';
import { StudentAttendanceScreen } from '../screens/student/AttendanceScreen';
import { ParentDashboardScreen } from '../screens/parent/DashboardScreen';
import { ParentPrimaryDashboardScreen } from '../screens/parent/ParentPrimaryDashboardScreen';
import { ParentChildrenScreen } from '../screens/parent/ChildrenScreen';
import { ParentChildResultsScreen } from '../screens/parent/ChildResultsScreen';
import { ParentHomeworkScreen } from '../screens/parent/HomeworkScreen';
import { ParentAssessmentsScreen } from '../screens/parent/AssessmentsScreen';
import { ParentAttendanceScreen } from '../screens/parent/AttendanceScreen';
import { ParentReportCardsScreen } from '../screens/parent/ReportCardsScreen';
import { ParentAnalyticsScreen } from '../screens/parent/AnalyticsScreen';
import { TeacherTabNavigator } from './TeacherTabNavigator';
import { TeacherClassesScreen } from '../screens/teacher/ClassesScreen';
import { TeacherMarksScreen } from '../screens/teacher/MarksScreen';
import { DirectorTabNavigator } from './DirectorTabNavigator';
import { ClassTeacherTabNavigator } from './ClassTeacherTabNavigator';
import { SuperAdminTabNavigator } from './SuperAdminTabNavigator';
import { SupervisorTabNavigator } from './SupervisorTabNavigator';
import { ParentTabNavigator } from './ParentTabNavigator';
import { StudentTabNavigator } from './StudentTabNavigator';
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
import { DepartmentTeachersScreen } from '../screens/monitoring/DepartmentTeachersScreen';
import { TeacherAssessmentDetailScreen } from '../screens/monitoring/TeacherAssessmentDetailScreen';
import HODMonitoringWrapper from '../screens/monitoring/HODMonitoringWrapper';
import { AssessmentEntryScreen } from '../screens/assessment/AssessmentEntryScreen';
import { AssessmentConfigScreen } from '../screens/assessment/AssessmentConfigScreen';
import { PendingAssessmentsScreen } from '../screens/assessment/PendingAssessmentsScreen';

import { DeviceSecurityScreen } from '../screens/security/DeviceSecurityScreen';
import { PasswordManagementScreen } from '../screens/security/PasswordManagementScreen';
import { AccountRecoveryScreen } from '../screens/security/AccountRecoveryScreen';
import { OtpScreen } from '../screens/security/OtpScreen';
import { SessionManagementScreen } from '../screens/security/SessionManagementScreen';
import { INSTITUTION_TYPE_ROLES, InstitutionTypeCode, isRoleForType } from '../types';
import { usePermissions } from '../utils/usePermissions';

const Stack = createNativeStackNavigator();

function useRoleCheck(user: any) {
  const institutionType = user?.institutionType || null;
  const roles: string[] = user?.roles || [];

  const hasRole = (roleName: string) => roles.includes(roleName);

  const isPrimaryLearner = institutionType === 'PRIMARY_SCHOOL' && hasRole('Learner');
  const isSecondaryStudent = (institutionType === 'SECONDARY_SCHOOL' || institutionType === 'ADVANCED_SECONDARY') && hasRole('Student');
  const isCollegeStudent = institutionType === 'COLLEGE' && hasRole('Student');
  const isUniStudent = institutionType === 'UNIVERSITY' && hasRole('Student');
  const isStudent = isPrimaryLearner || isSecondaryStudent || isCollegeStudent || isUniStudent;

  const isPrimaryParent = institutionType === 'PRIMARY_SCHOOL' && hasRole('Parent');
  const isSecParent = (institutionType === 'SECONDARY_SCHOOL' || institutionType === 'ADVANCED_SECONDARY') && hasRole('Parent');
  const isParent = isPrimaryParent || isSecParent;

  // SuperAdmin is checked first via separate login endpoint
  const isSuperAdmin = hasRole('SuperAdmin') || hasRole('SUPER_ADMIN');

  // Director/Deputy Director have their own dashboard - do NOT include in isTeacher
  const isPrimaryDirector = institutionType === 'PRIMARY_SCHOOL' && (hasRole('Head Teacher') || hasRole('Deputy Head') || hasRole('Director'));
  const isSecDirector = (institutionType === 'SECONDARY_SCHOOL' || institutionType === 'ADVANCED_SECONDARY') && (hasRole('Head Teacher') || hasRole('Deputy Head') || hasRole('Director') || hasRole('Deputy Director'));
  const isCollegeDirector = institutionType === 'COLLEGE' && (hasRole('Principal') || hasRole('Registrar'));
  const isUniDirector = institutionType === 'UNIVERSITY' && (hasRole('Vice Chancellor') || hasRole('Dean'));
  const isDirector = isPrimaryDirector || isSecDirector || isCollegeDirector || isUniDirector;

  const isClassTeacher = (institutionType === 'SECONDARY_SCHOOL' || institutionType === 'ADVANCED_SECONDARY') && hasRole('Class Teacher');

  const isPrimaryTeacher = institutionType === 'PRIMARY_SCHOOL' && (hasRole('Primary Teacher'));
  const isSecTeacher = (institutionType === 'SECONDARY_SCHOOL' || institutionType === 'ADVANCED_SECONDARY') && (hasRole('Teacher') || hasRole('Class Teacher'));
  const isCollegeTeacher = institutionType === 'COLLEGE' && (hasRole('Lecturer'));
  const isUniTeacher = institutionType === 'UNIVERSITY' && (hasRole('Lecturer') || hasRole('Research Supervisor'));
  const isTeacher = isPrimaryTeacher || isSecTeacher || isCollegeTeacher || isUniTeacher;

  const isHodSupervisor = (institutionType === 'SECONDARY_SCHOOL' || institutionType === 'ADVANCED_SECONDARY') && hasRole('HOD');

  return { isStudent, isParent, isClassTeacher, isTeacher, isDirector, isSuperAdmin, isHodSupervisor, institutionType };
}

export function AppNavigator() {
  const { isAuthenticated, user } = useAuthStore();
  const { isStudent, isParent, isClassTeacher, isTeacher, isDirector, isSuperAdmin, isHodSupervisor, institutionType } = useRoleCheck(user);
  const hasRoleDashboard = isStudent || isParent || isClassTeacher || isTeacher || isDirector || isSuperAdmin || isHodSupervisor;
  const { can } = usePermissions();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            {/* Highest priority roles first - check SuperAdmin/director before teacher */}
            {isSuperAdmin && <Stack.Screen name="SuperAdminDashboard" component={SuperAdminTabNavigator} />}
            {isDirector && <Stack.Screen name="DirectorDashboard" component={DirectorTabNavigator} />}
            {isHodSupervisor && <Stack.Screen name="SupervisorDashboard" component={SupervisorTabNavigator} />}
            {isTeacher && <Stack.Screen name="TeacherDashboard" component={TeacherTabNavigator} />}
            {isClassTeacher && <Stack.Screen name="ClassTeacherTabNavigator" component={ClassTeacherTabNavigator} />}
            {isParent && <Stack.Screen name="ParentDashboard" component={ParentTabNavigator} />}
            {isStudent && <Stack.Screen name="StudentDashboard" component={StudentTabNavigator} />}
            {!hasRoleDashboard && (
              <Stack.Screen name="StudentDashboard" component={StudentDashboardScreen} />
            )}

            {isStudent && <Stack.Screen name="StudentResults" component={StudentResultsScreen} />}
            {isStudent && institutionType === 'PRIMARY_SCHOOL' && <Stack.Screen name="PrimaryStudentResults" component={PrimaryStudentResultsScreen} />}
            {isStudent && <Stack.Screen name="StudentTimetable" component={StudentTimetableScreen} />}
            {isStudent && <Stack.Screen name="StudentAttendance" component={StudentAttendanceScreen} />}

            {isParent && <Stack.Screen name="ParentChildren" component={ParentChildrenScreen} />}
            {isParent && <Stack.Screen name="ParentChildResults" component={ParentChildResultsScreen} />}
            {isParent && institutionType === 'PRIMARY_SCHOOL' && <Stack.Screen name="ParentPrimaryDashboard" component={ParentPrimaryDashboardScreen} />}
            {isParent && <Stack.Screen name="ParentHomework" component={ParentHomeworkScreen} />}
            {isParent && <Stack.Screen name="ParentAssessments" component={ParentAssessmentsScreen} />}
            {isParent && <Stack.Screen name="ParentAttendance" component={ParentAttendanceScreen} />}
            {isParent && <Stack.Screen name="ParentReportCards" component={ParentReportCardsScreen} />}
            {isParent && <Stack.Screen name="ParentAnalytics" component={ParentAnalyticsScreen} />}

            {(isTeacher || isClassTeacher) && <Stack.Screen name="TeacherClasses" component={TeacherClassesScreen} />}
            {(isTeacher || isClassTeacher) && <Stack.Screen name="TeacherMarks" component={TeacherMarksScreen} />}
            <Stack.Screen name="HODMonitoring" component={HODMonitoringWrapper} />

            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="UserGuide" component={UserGuideScreen} />
            <Stack.Screen name="LearningStyle" component={LearningStyleScreen} />
            <Stack.Screen name="AiTutor" component={AiTutorScreen} />
            <Stack.Screen name="Analytics" component={AnalyticsScreen} />
            {can('template-personalization.manage') && <Stack.Screen name="DocumentEditor" component={DocumentEditorScreen} />}
            {can('template-personalization.manage') && <Stack.Screen name="TemplateMarketplace" component={TemplateMarketplaceScreen} />}
            {can('template-personalization.manage') && <Stack.Screen name="AITemplateGenerator" component={AITemplateGeneratorScreen} />}
            {can('template-personalization.manage') && <Stack.Screen name="BrandingPresets" component={BrandingPresetsScreen} />}
            {can('template-personalization.manage') && <Stack.Screen name="CloudAssetLibrary" component={CloudAssetLibraryScreen} />}
            {can('stamps.manage') && <Stack.Screen name="DigitalSignature" component={DigitalSignatureScreen} />}
            {can('communications.manage') && <Stack.Screen name="Collaboration" component={CollaborationScreen} />}
            {isHodSupervisor && <Stack.Screen name="DepartmentTeachers" component={DepartmentTeachersScreen} />}
            <Stack.Screen name="TeacherAssessmentDetail" component={TeacherAssessmentDetailScreen} />
            <Stack.Screen name="ExamList" component={ExamListScreen} />
            <Stack.Screen name="ExamDetail" component={ExamDetailScreen} />
            {can('exams.manage') && <Stack.Screen name="ExamCreate" component={ExamCreateScreen} />}
            <Stack.Screen name="ExamTaking" component={ExamTakingScreen} />
            <Stack.Screen name="ExamResults" component={ExamResultsScreen} />
            {can('exams.manage') && <Stack.Screen name="ExamAnalytics" component={ExamAnalyticsScreen} />}
            {can('stamps.manage') && <Stack.Screen name="DigitalStamps" component={DigitalStampScreen} />}
            {can('stamps.manage') && <Stack.Screen name="PDFPreview" component={PDFPreviewScreen} />}
            {can('stamps.manage') && <Stack.Screen name="QRVerification" component={QRVerificationScreen} />}
            {can('stamps.manage') && <Stack.Screen name="ApprovalWorkflow" component={ApprovalWorkflowScreen} />}

            {/* Assessment Screens */}
            {(isTeacher || isClassTeacher) && <Stack.Screen name="PendingAssessments" component={PendingAssessmentsScreen} />}
            {(isTeacher || isClassTeacher) && <Stack.Screen name="AssessmentEntry" component={AssessmentEntryScreen} />}
            {(isTeacher || isClassTeacher) && <Stack.Screen name="AssessmentConfig" component={AssessmentConfigScreen} />}

            {/* Security Screens */}
            <Stack.Screen name="DeviceSecurity" component={DeviceSecurityScreen} />
            <Stack.Screen name="PasswordManagement" component={PasswordManagementScreen} />
            <Stack.Screen name="AccountRecovery" component={AccountRecoveryScreen} />
            <Stack.Screen name="OtpVerification" component={OtpScreen} />
            <Stack.Screen name="SessionManagement" component={SessionManagementScreen} />

            {/* SuperAdmin Screens */}
            {isSuperAdmin && <Stack.Screen name="SuperAdminSchoolDetail" component={require('../screens/super-admin/SchoolDetailScreen').SuperAdminSchoolDetailScreen} />}
            {isSuperAdmin && <Stack.Screen name="SuperAdminCreateSchool" component={require('../screens/super-admin/CreateSchoolScreen').SuperAdminCreateSchoolScreen} />}
            {isSuperAdmin && <Stack.Screen name="SuperAdminSubscriptionPlans" component={require('../screens/super-admin/SubscriptionPlansScreen').SuperAdminSubscriptionPlansScreen} />}
            {isSuperAdmin && <Stack.Screen name="SuperAdminInstitutionTypes" component={require('../screens/super-admin/InstitutionTypesScreen').SuperAdminInstitutionTypesScreen} />}
            {isSuperAdmin && <Stack.Screen name="SuperAdminAuditLogs" component={require('../screens/super-admin/AuditLogsScreen').SuperAdminAuditLogsScreen} />}
            {isSuperAdmin && <Stack.Screen name="SuperAdminSettings" component={require('../screens/super-admin/SettingsScreen').SuperAdminSettingsScreen} />}

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
