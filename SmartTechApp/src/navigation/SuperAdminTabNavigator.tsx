import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, BackHandler, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store';
import { SuperAdminDashboardScreen } from '../screens/super-admin/DashboardScreen';
import { SuperAdminMediaScreen } from '../screens/super-admin/MediaScreen';
import { SuperAdminMonitoringScreen } from '../screens/super-admin/MonitoringScreen';
import { SuperAdminCommunicationsScreen } from '../screens/super-admin/CommunicationsScreen';
import { SuperAdminSchoolsScreen } from '../screens/super-admin/SchoolsScreen';
import { SuperAdminSubscriptionPlansScreen } from '../screens/super-admin/SubscriptionPlansScreen';
import { SuperAdminInstitutionTypesScreen } from '../screens/super-admin/InstitutionTypesScreen';
import { SuperAdminAuditLogsScreen } from '../screens/super-admin/AuditLogsScreen';
import { SuperAdminSettingsScreen } from '../screens/super-admin/SettingsScreen';
import { SuperAdminCurriculumCenterScreen } from '../screens/super-admin/CurriculumCenterScreen';
import { ProfileScreen } from '../screens/common/ProfileScreen';
import { colors, spacing, borderRadius, shadows } from '../theme';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = 280;

interface DrawerScreen {
  name: string;
  label: string;
  icon: string;
  component?: React.FC<any>;
  stackScreen?: string;
  institutionTypes?: string[];
}

const allDrawerScreens: (DrawerScreen & { section?: string })[] = [
  { name: 'SuperAdminHome', label: 'Dashboard', icon: '📊', component: SuperAdminDashboardScreen, institutionTypes: null as any, section: 'MAIN' },
  { name: 'SuperAdminSchools', label: 'Schools', icon: '🏫', component: SuperAdminSchoolsScreen, institutionTypes: null as any, section: 'MAIN' },
  { name: 'SuperAdminSwitchSchool', label: 'Linked Schools', icon: '🔁', stackScreen: 'SuperAdminSwitchSchool', institutionTypes: null as any, section: 'MAIN' },
  { name: 'SuperAdminSchoolMembers', label: 'School Members', icon: '🔑', stackScreen: 'PendingAssessments', institutionTypes: null as any, section: 'MAIN' },
  { name: 'SuperAdminSubscriptionPlans', label: 'Subscription Plans', icon: '💳', stackScreen: 'SuperAdminSubscriptionPlans', institutionTypes: null as any, section: 'ACADEMIC' },
  { name: 'SuperAdminInstitutionTypes', label: 'Institution Types', icon: '🏛️', stackScreen: 'SuperAdminInstitutionTypes', institutionTypes: null as any, section: 'ACADEMIC' },
  { name: 'SuperAdminFeatureLocks', label: 'Feature Locks', icon: '🔒', stackScreen: 'DeviceSecurity', institutionTypes: null as any, section: 'ACADEMIC' },
  { name: 'SuperAdminExams', label: 'Exams Overview', icon: '📋', stackScreen: 'ExamList', institutionTypes: null as any, section: 'ACADEMIC' },
  { name: 'SuperAdminAssessments', label: 'Assessments', icon: '📝', stackScreen: 'PendingAssessments', institutionTypes: null as any, section: 'ACADEMIC' },
  { name: 'SuperAdminCurriculumCenter', label: 'Curriculum Center', icon: '📚', component: SuperAdminCurriculumCenterScreen, institutionTypes: null as any, section: 'ACADEMIC' },
  { name: 'SuperAdminVerification', label: 'Verification Center', icon: '🛡️', stackScreen: 'SuperAdminQRVerification', institutionTypes: null as any, section: 'VERIFICATION' },
  { name: 'SuperAdminSignatures', label: 'Document Signatures', icon: '✍️', stackScreen: 'SuperAdminDigitalSignature', institutionTypes: null as any, section: 'VERIFICATION' },
  { name: 'SuperAdminBlockchain', label: 'Blockchain Certs', icon: '🔗', stackScreen: 'VerificationResult', institutionTypes: null as any, section: 'VERIFICATION' },
  { name: 'SuperAdminMinistry', label: 'Ministry Verifications', icon: '🏛️', stackScreen: 'ManualVerification', institutionTypes: null as any, section: 'VERIFICATION' },
  { name: 'SuperAdminApprovals', label: 'Approval Workflows', icon: '✅', stackScreen: 'SuperAdminApprovalWorkflow', institutionTypes: null as any, section: 'VERIFICATION' },
  { name: 'SuperAdminIntelligence', label: 'Intelligence', icon: '🧠', stackScreen: 'Analytics', institutionTypes: null as any, section: 'SERVICES' },
  { name: 'SuperAdminCommunications', label: 'Communications Hub', icon: '📡', component: SuperAdminCommunicationsScreen, institutionTypes: null as any, section: 'SERVICES' },
  { name: 'SuperAdminMonitoring', label: 'Monitoring', icon: '📡', component: SuperAdminMonitoringScreen, institutionTypes: null as any, section: 'SERVICES' },
  { name: 'SuperAdminAuditLogs', label: 'Audit Logs', icon: '📋', stackScreen: 'SuperAdminAuditLogs', institutionTypes: null as any, section: 'SECURITY' },
  { name: 'SuperAdminPasswordHub', label: 'Password Hub', icon: '🔑', stackScreen: 'PasswordManagement', institutionTypes: null as any, section: 'SECURITY' },
  { name: 'SuperAdminAccountCenter', label: 'Account Center', icon: '👤', stackScreen: 'SessionManagement', institutionTypes: null as any, section: 'SECURITY' },
  { name: 'SuperAdminDeviceManager', label: 'Device Manager', icon: '💻', stackScreen: 'DeviceSecurity', institutionTypes: null as any, section: 'SECURITY' },
  { name: 'SuperAdminOtp', label: 'OTP Verification', icon: '🛡️', stackScreen: 'OtpVerification', institutionTypes: null as any, section: 'SECURITY' },
  { name: 'SuperAdminAuditCenter', label: 'Audit Center', icon: '📊', stackScreen: 'SuperAdminAuditLogs', institutionTypes: null as any, section: 'SECURITY' },
  { name: 'SuperAdminRecovery', label: 'Account Recovery', icon: '🔄', stackScreen: 'AccountRecovery', institutionTypes: null as any, section: 'SECURITY' },
  { name: 'SuperAdminSettings', label: 'Settings', icon: '⚙️', stackScreen: 'SuperAdminSettings', institutionTypes: null as any, section: 'TOOLS' },
  { name: 'SuperAdminTemplates', label: 'Templates', icon: '📄', stackScreen: 'SuperAdminTemplateMarketplace', institutionTypes: null as any, section: 'TOOLS' },
  { name: 'SuperAdminMarketplace', label: 'Marketplace', icon: '🏪', stackScreen: 'SuperAdminTemplateMarketplace', institutionTypes: null as any, section: 'TOOLS' },
  { name: 'SuperAdminBranding', label: 'Brand Presets', icon: '🎨', stackScreen: 'SuperAdminBrandingPresets', institutionTypes: null as any, section: 'TOOLS' },
  { name: 'SuperAdminAssets', label: 'Cloud Assets', icon: '☁️', stackScreen: 'SuperAdminCloudAssetLibrary', institutionTypes: null as any, section: 'TOOLS' },
  { name: 'SuperAdminDigitalStamps', label: 'Stamps', icon: '🔏', stackScreen: 'SuperAdminDigitalStamps', institutionTypes: null as any, section: 'TOOLS' },
  { name: 'SuperAdminStampVerify', label: 'Verifications', icon: '✅', stackScreen: 'SuperAdminQRVerification', institutionTypes: null as any, section: 'TOOLS' },
  { name: 'SuperAdminMedia', label: 'Media Library', icon: '🖼️', component: SuperAdminMediaScreen, institutionTypes: null as any, section: 'TOOLS' },
  { name: 'SuperAdminEnrollStaff', label: 'Enroll as Staff', icon: '👨‍🏫', stackScreen: 'SuperAdminEnrollStaff', institutionTypes: null as any, section: 'TOOLS' },
  { name: 'SuperAdminProfile', label: 'Profile', icon: '👤', component: ProfileScreen, institutionTypes: null as any, section: 'ACCOUNT' },
];

export const SuperAdminTabNavigator: React.FC = () => {
  const { institutionType, user, logout } = useAuthStore((state) => ({ institutionType: state.user?.institutionType, user: state.user, logout: state.logout }));
  const drawerScreens = allDrawerScreens.filter((s) => !s.institutionTypes || (institutionType && s.institutionTypes.includes(institutionType)));

  const drawerScreenNames = useMemo(() => drawerScreens.map(s => s.name), [drawerScreens]);
  const stackScreenMap = useMemo(() => drawerScreens.filter(s => s.stackScreen).reduce((acc, s) => {
    acc[s.name] = s.stackScreen!;
    return acc;
  }, {} as Record<string, string>), [drawerScreens]);

  const [activeScreen, setActiveScreen] = useState('SuperAdminHome');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (drawerOpen) {
        toggleDrawer();
        return true;
      }
      if (activeScreen !== 'SuperAdminHome') {
        setActiveScreen('SuperAdminHome');
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [drawerOpen, activeScreen]);

  const toggleDrawer = () => {
    if (drawerOpen) {
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setDrawerOpen(false));
    } else {
      setDrawerOpen(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  };

  const navigateTo = (name: string) => {
    const stackScreen = stackScreenMap[name];
    if (stackScreen) {
      setDrawerOpen(false);
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        navigation.navigate(stackScreen as never);
      });
    } else {
      setActiveScreen(name);
      setDrawerOpen(false);
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleNavigate = useCallback((screen: string) => {
    if (stackScreenMap[screen]) {
      navigation.navigate(stackScreenMap[screen] as never);
    } else if (drawerScreenNames.includes(screen)) {
      navigateTo(screen);
    } else {
      navigation.navigate(screen as never);
    }
  }, [navigation]);

  const renderActiveScreen = () => {
    const screenConfig = drawerScreens.find(s => s.name === activeScreen);
    if (!screenConfig || screenConfig.stackScreen) {
      return <SuperAdminDashboardScreen onToggleDrawer={toggleDrawer} onNavigate={handleNavigate} stackNavigation={navigation} />;
    }
    if (activeScreen === 'SuperAdminProfile') {
      return <ProfileScreen navigation={navigation as any} />;
    }
    const Component = screenConfig.component as React.FC<any>;
    return <Component onToggleDrawer={toggleDrawer} onNavigate={handleNavigate} stackNavigation={navigation} />;
  };

  return (
    <View style={styles.container}>
      {renderActiveScreen()}

      {drawerOpen && (
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={toggleDrawer} />
      )}

      <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
        <SafeAreaView style={styles.drawerContent} edges={['top', 'bottom']}>
          <View style={styles.drawerHeader}>
            <Image source={user?.school?.logo ? { uri: user.school.logo } : require('../../assets/icon.png')} style={styles.drawerLogoImage} resizeMode="contain" />
            <Text style={styles.drawerTitle}>SmartTech</Text>
            <Text style={styles.drawerSubtitle}>Super Admin Portal</Text>
            <View style={styles.divider} />
            <View style={styles.profileSection}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user ? `${(user.email||'')[0]}`.toUpperCase() : 'SA'}
                </Text>
              </View>
              <Text style={styles.profileName}>{user?.email || 'Admin'}</Text>
              <Text style={styles.profileRole}>Super Admin</Text>
            </View>
          </View>

          <ScrollView style={styles.drawerNav} showsVerticalScrollIndicator={false}>
            {drawerScreens.map((screen, index) => {
              const prevSection = index > 0 ? (drawerScreens[index - 1] as any).section : null;
              const showSectionHeader = (screen as any).section && (screen as any).section !== prevSection;
              return (
                <React.Fragment key={screen.name}>
                  {showSectionHeader && (
                    <Text style={styles.sectionHeader}>{(screen as any).section}</Text>
                  )}
                  <TouchableOpacity
                    style={[styles.navItem, activeScreen === screen.name && styles.navItemActive]}
                    onPress={() => navigateTo(screen.name)}
                  >
                    <Text style={styles.navIcon}>{screen.icon}</Text>
                    <Text style={[styles.navLabel, activeScreen === screen.name && styles.navLabelActive]}>{screen.label}</Text>
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </ScrollView>

          <View style={styles.drawerFooter}>
            <TouchableOpacity style={styles.logoutBtn} onPress={() => { toggleDrawer(); Alert.alert('Sign Out', 'Are you sure?', [{text:'Cancel',style:'cancel'},{text:'Sign Out',style:'destructive', onPress:() => logout()}]); }}>
              <Text style={styles.logoutIcon}>🚪</Text>
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
            <Text style={styles.footerText}>SmartTech v1.0.0</Text>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  drawer: { position: 'absolute', left: 0, top: 0, bottom: 0, width: DRAWER_WIDTH, backgroundColor: colors.white, zIndex: 100, ...shadows.lg },
  drawerContent: { flex: 1 },
  drawerHeader: { padding: spacing.lg, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  drawerLogoImage: { width: 48, height: 48, borderRadius: 12, marginBottom: spacing.sm },
  drawerTitle: { fontSize: 20, fontWeight: '800', color: colors.primary },
  drawerSubtitle: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, width: '80%', marginVertical: spacing.sm },
  profileSection: { alignItems: 'center', marginTop: spacing.xs },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.white },
  profileName: { fontSize: 14, fontWeight: '600', color: colors.text },
  profileRole: { fontSize: 11, color: colors.textLight, marginTop: 1 },
  drawerNav: { flex: 1, paddingVertical: spacing.sm },
  sectionHeader: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs },
  navItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  navItemActive: { backgroundColor: colors.infoLight, borderRightWidth: 3, borderRightColor: colors.primary },
  navIcon: { fontSize: 20, marginRight: spacing.md, width: 28, textAlign: 'center' },
  navLabel: { fontSize: 15, fontWeight: '500', color: colors.textSecondary },
  navLabelActive: { color: colors.primary, fontWeight: '700' },
  drawerFooter: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, marginBottom: spacing.sm },
  logoutIcon: { fontSize: 18, marginRight: spacing.md },
  logoutText: { fontSize: 15, fontWeight: '500', color: colors.error },
  footerText: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
});
