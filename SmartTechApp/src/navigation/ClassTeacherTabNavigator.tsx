import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, BackHandler, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store';
import { ClassTeacherDashboardScreen } from '../screens/class-teacher/DashboardScreen';
import { PrimaryClassTeacherScreen } from '../screens/class-teacher/PrimaryClassTeacherScreen';
import { ClassTeacherStudentsScreen } from '../screens/class-teacher/StudentsScreen';
import { ClassTeacherCommunicationScreen } from '../screens/class-teacher/CommunicationScreen';
import { ClassTeacherAnalyticsScreen } from '../screens/class-teacher/AnalyticsScreen';
import { ClassTeacherAttendanceScreen } from '../screens/class-teacher/AttendanceScreen';
import { StudentPhotoScreen } from '../screens/class-teacher/StudentPhotoScreen';
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
  primaryOnly?: boolean;
}

const allDrawerScreens: DrawerScreen[] = [
  { name: 'CTHome', label: 'Dashboard', icon: '🏠', component: ClassTeacherDashboardScreen },
  { name: 'CTPrimary', label: 'Primary', icon: '🌿', component: PrimaryClassTeacherScreen, primaryOnly: true },
  { name: 'CTStudents', label: 'Students', icon: '👥', component: ClassTeacherStudentsScreen },
  { name: 'CTCommunication', label: 'Messages', icon: '💬', component: ClassTeacherCommunicationScreen },
  { name: 'CTAnalytics', label: 'Analytics', icon: '📊', component: ClassTeacherAnalyticsScreen },
  { name: 'CTAiTutor', label: 'AI Tutor', icon: '🤖', stackScreen: 'AiTutor' },
  { name: 'CTAttendance', label: 'Attendance', icon: '📋', component: ClassTeacherAttendanceScreen },
  { name: 'CTPhotos', label: 'Photos', icon: '📸', component: StudentPhotoScreen },
  { name: 'CTProfile', label: 'Profile', icon: '👤', component: ProfileScreen },
];

export const ClassTeacherTabNavigator: React.FC = () => {
  const { user, logout } = useAuthStore();
  const institutionType = user?.institutionType;
  const isPrimary = institutionType === 'PRIMARY_SCHOOL';

  const drawerScreens = useMemo(() => allDrawerScreens.filter(s => !s.primaryOnly || isPrimary), [isPrimary]);

  const drawerScreenNames = useMemo(() => drawerScreens.map(s => s.name), [drawerScreens]);
  const stackScreenMap = useMemo(() => drawerScreens.filter(s => s.stackScreen).reduce((acc, s) => {
    acc[s.name] = s.stackScreen!;
    return acc;
  }, {} as Record<string, string>), [drawerScreens]);

  const [activeScreen, setActiveScreen] = useState('CTHome');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (drawerOpen) { toggleDrawer(); return true; }
      if (activeScreen !== 'CTHome') { setActiveScreen('CTHome'); return true; }
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
    if (!screenConfig || screenConfig.stackScreen) return <ClassTeacherDashboardScreen onToggleDrawer={toggleDrawer} onNavigate={handleNavigate} stackNavigation={navigation} />;
    if (activeScreen === 'CTProfile') return <ProfileScreen navigation={navigation as any} />;
    const Component = screenConfig.component as React.FC<any>;
    return <Component onToggleDrawer={toggleDrawer} onNavigate={handleNavigate} stackNavigation={navigation} />;
  };

  const initials = user
    ? `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase()
    : 'CT';
  const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Class Teacher';

  return (
    <View style={styles.container}>
      {renderActiveScreen()}

      {drawerOpen && <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={toggleDrawer} />}

      <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
        <SafeAreaView style={styles.drawerContent} edges={['top', 'bottom']}>
          <View style={styles.drawerHeader}>
            <Image source={require('../../assets/icon.png')} style={styles.drawerLogoImage} resizeMode="contain" />
            <Text style={styles.drawerTitle}>SmartTech</Text>
            <Text style={styles.drawerSubtitle}>{user?.school?.name || 'Class Teacher Portal'}</Text>
            <View style={styles.divider} />
            <View style={styles.profileSection}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
              <Text style={styles.profileName}>{userName}</Text>
              <Text style={styles.profileRole}>Class Teacher</Text>
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
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50 },
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
