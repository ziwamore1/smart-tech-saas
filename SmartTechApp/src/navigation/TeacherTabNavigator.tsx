import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, BackHandler, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store';
import { TeacherDashboardScreen } from '../screens/teacher/DashboardScreen';
import { TeacherClassesScreen } from '../screens/teacher/ClassesScreen';
import { TeacherMarksScreen } from '../screens/teacher/MarksScreen';
import { TeacherPerformanceScreen } from '../screens/teacher/PerformanceScreen';
import { ResultsManagementScreen } from '../screens/director/ResultsManagementScreen';
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
}

const allDrawerScreens: DrawerScreen[] = [
  { name: 'TeacherHome', label: 'Dashboard', icon: '🏠', component: TeacherDashboardScreen },
  { name: 'TeacherClasses', label: 'Classes', icon: '🏫', component: TeacherClassesScreen },
  { name: 'TeacherMarks', label: 'Marks', icon: '✏️', component: TeacherMarksScreen },
  { name: 'TeacherResultsMgmt', label: 'Results Management', icon: '📊', component: ResultsManagementScreen },
  { name: 'TeacherPerformance', label: 'My Performance', icon: '📈', component: TeacherPerformanceScreen },
  { name: 'TeacherExams', label: 'Exams', icon: '📋', stackScreen: 'ExamList' },
  { name: 'TeacherAiTutor', label: 'AI Tutor', icon: '🤖', stackScreen: 'AiTutor' },
  { name: 'TeacherTemplates', label: 'Templates', icon: '📄', stackScreen: 'TemplateMarketplace' },
  { name: 'TeacherProfile', label: 'Profile', icon: '👤', component: ProfileScreen },
];

export const TeacherTabNavigator: React.FC = () => {
  const { user, logout } = useAuthStore();
  const drawerScreens = allDrawerScreens;

  const drawerScreenNames = useMemo(() => drawerScreens.map(s => s.name), [drawerScreens]);
  const stackScreenMap = useMemo(() => drawerScreens.filter(s => s.stackScreen).reduce((acc, s) => {
    acc[s.name] = s.stackScreen!;
    return acc;
  }, {} as Record<string, string>), [drawerScreens]);

  const [activeScreen, setActiveScreen] = useState('TeacherHome');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (drawerOpen) {
        toggleDrawer();
        return true;
      }
      if (activeScreen !== 'TeacherHome') {
        setActiveScreen('TeacherHome');
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [drawerOpen, activeScreen]);

  const toggleDrawer = useCallback(() => {
    if (drawerOpen) {
      Animated.timing(slideAnim, { toValue: -DRAWER_WIDTH, duration: 250, useNativeDriver: true }).start(() => setDrawerOpen(false));
    } else {
      setDrawerOpen(true);
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    }
  }, [drawerOpen]);

  const handleNavigate = useCallback((screen: string) => {
    if (stackScreenMap[screen]) {
      setDrawerOpen(false);
      Animated.timing(slideAnim, { toValue: -DRAWER_WIDTH, duration: 250, useNativeDriver: true }).start(() => navigation.navigate(stackScreenMap[screen] as never));
    } else if (drawerScreenNames.includes(screen)) {
      setActiveScreen(screen);
      setDrawerOpen(false);
      Animated.timing(slideAnim, { toValue: -DRAWER_WIDTH, duration: 250, useNativeDriver: true }).start();
    } else {
      navigation.navigate(screen as never);
    }
  }, [navigation, drawerScreenNames, stackScreenMap]);

  const navigateTo = (name: string) => {
    handleNavigate(name);
  };

  const renderActiveScreen = () => {
    const screenConfig = drawerScreens.find(s => s.name === activeScreen);
    if (!screenConfig || screenConfig.stackScreen) return <TeacherDashboardScreen onToggleDrawer={toggleDrawer} onNavigate={handleNavigate} stackNavigation={navigation} />;
    if (activeScreen === 'TeacherProfile') return <ProfileScreen navigation={navigation as any} />;
    const Component = screenConfig.component as React.FC<any>;
    return <Component onToggleDrawer={toggleDrawer} onNavigate={handleNavigate} stackNavigation={navigation} />;
  };

  const schoolLogo = user?.school?.logo
    ? { uri: user.school.logo }
    : require('../../assets/icon.png');
  const schoolName = user?.school?.name || 'SmartTech';
  const initials = user
    ? `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase()
    : 'T';
  const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Teacher';
  const userEmail = user?.email || '';
  const userRoles = user?.roles || [];
  const roleLabel = userRoles.includes('HOD') ? 'Head of Department' : userRoles[0] || 'Teacher';

  return (
    <View style={styles.container}>
      {renderActiveScreen()}

      {drawerOpen && (
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={toggleDrawer} />
      )}

      <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
        <SafeAreaView style={styles.drawerContent} edges={['top', 'bottom']}>
          <View style={styles.drawerHeader}>
            <View style={styles.brandSection}>
              <Image source={schoolLogo} style={styles.schoolLogo} resizeMode="contain" />
              <Text style={styles.schoolName}>{schoolName}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.profileSection}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <Text style={styles.profileName}>{userName}</Text>
              <Text style={styles.profileEmail}>{userEmail}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{roleLabel}</Text>
              </View>
            </View>
          </View>

          <ScrollView style={styles.drawerNav} showsVerticalScrollIndicator={false}>
            {drawerScreens.map((screen) => (
              <TouchableOpacity
                key={screen.name}
                style={[styles.navItem, activeScreen === screen.name && styles.navItemActive]}
                onPress={() => navigateTo(screen.name)}
              >
                <Text style={styles.navIcon}>{screen.icon}</Text>
                <Text style={[styles.navLabel, activeScreen === screen.name && styles.navLabelActive]}>{screen.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.drawerFooter}>
            <TouchableOpacity style={styles.logoutBtn} onPress={() => { Alert.alert('Sign Out', 'Are you sure?', [{text:'Cancel',style:'cancel'},{text:'Sign Out',style:'destructive', onPress:() => logout()}]); }}>
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
  activeScreen: { flex: 1 },
  hamburger: { position: 'absolute', top: 8, left: 8, zIndex: 10, padding: 8 },
  hamburgerText: { fontSize: 24, color: colors.primary },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50 },
  drawer: { position: 'absolute', left: 0, top: 0, bottom: 0, width: DRAWER_WIDTH, backgroundColor: colors.white, zIndex: 100, ...shadows.lg },
  drawerContent: { flex: 1 },
  drawerHeader: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.primary,
  },
  brandSection: { alignItems: 'center', marginBottom: spacing.sm },
  schoolLogo: { width: 48, height: 48, borderRadius: 12, marginBottom: spacing.xs },
  schoolName: { fontSize: 14, fontWeight: '700', color: colors.white },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: spacing.sm },
  profileSection: { alignItems: 'center' },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: { fontSize: 24, fontWeight: '800', color: colors.white },
  profileName: { fontSize: 17, fontWeight: '700', color: colors.white },
  profileEmail: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  roleBadge: {
    marginTop: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '600', color: colors.white, textTransform: 'capitalize' },
  drawerNav: { flex: 1, paddingVertical: spacing.sm },
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
