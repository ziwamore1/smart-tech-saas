import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, BackHandler, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store';
import { StudentDashboardScreen } from '../screens/student/DashboardScreen';
import { ProfileScreen } from '../screens/common/ProfileScreen';
import { colors, spacing, borderRadius, shadows } from '../theme';
import { apiService, resolveImageUrl } from '../services/api';

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
  { name: 'StudentHome', label: 'Dashboard', icon: '🏠', component: StudentDashboardScreen },
  { name: 'StudentResults', label: 'Results', icon: '📝', stackScreen: 'StudentResults' },
  { name: 'StudentTimetable', label: 'Timetable', icon: '📅', stackScreen: 'StudentTimetable' },
  { name: 'StudentAttendance', label: 'Attendance', icon: '✅', stackScreen: 'StudentAttendance' },
  { name: 'StudentExams', label: 'Exams', icon: '📋', stackScreen: 'ExamList' },
  { name: 'StudentHomework', label: 'Homework', icon: '📚', stackScreen: 'StudentHomework' },
  { name: 'StudentReportCards', label: 'Report Cards', icon: '📄', stackScreen: 'StudentReportCards' },
  { name: 'StudentAssessments', label: 'Assessments', icon: '📊', stackScreen: 'StudentAssessments' },
  { name: 'StudentAiTutor', label: 'AI Tutor', icon: '🤖', stackScreen: 'AiTutor' },
  { name: 'StudentLearningStyle', label: 'My Style', icon: '🧠', stackScreen: 'LearningStyle' },
  { name: 'StudentAnalytics', label: 'Analytics', icon: '📊', stackScreen: 'Analytics' },
  { name: 'StudentProfile', label: 'Profile', icon: '👤', component: ProfileScreen },
];

export const StudentTabNavigator: React.FC = () => {
  const { user, logout } = useAuthStore();
  const drawerScreens = allDrawerScreens;

  const drawerScreenNames = useMemo(() => drawerScreens.map(s => s.name), [drawerScreens]);
  const stackScreenMap = useMemo(() => drawerScreens.filter(s => s.stackScreen).reduce((acc, s) => {
    acc[s.name] = s.stackScreen!;
    return acc;
  }, {} as Record<string, string>), [drawerScreens]);

  const [activeScreen, setActiveScreen] = useState('StudentHome');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (drawerOpen) { toggleDrawer(); return true; }
      if (activeScreen !== 'StudentHome') { setActiveScreen('StudentHome'); return true; }
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
    if (!screenConfig || screenConfig.stackScreen) return <StudentDashboardScreen onToggleDrawer={toggleDrawer} onNavigate={handleNavigate} stackNavigation={navigation} />;
    if (activeScreen === 'StudentProfile') return <ProfileScreen navigation={navigation as any} />;
    const Component = screenConfig.component as React.FC<any>;
    return <Component onToggleDrawer={toggleDrawer} onNavigate={handleNavigate} stackNavigation={navigation} />;
  };

  const [studentPhoto, setStudentPhoto] = useState<string | null>(null);

  useEffect(() => {
    const photoId = user?.studentId || user?.id;
    if (photoId) {
      apiService.getStudentPhoto(photoId).then(r => {
        const url = r?.imageUrl || r?.photoUrl;
        if (url) setStudentPhoto(url);
      }).catch(() => {});
    }
  }, [user?.studentId]);

  const initials = user ? `${(user.firstName||'')[0]||''}${(user.lastName||'')[0]||''}`.toUpperCase() : 'S';
  const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Student';

  return (
    <View style={styles.container}>
      {renderActiveScreen()}

      {drawerOpen && <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={toggleDrawer} />}

      <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
        <SafeAreaView style={styles.drawerContent} edges={['top', 'bottom']}>
          <View style={styles.drawerHeader}>
            <Image source={require('../../assets/icon.png')} style={styles.drawerLogoImage} resizeMode="contain" />
            <Text style={styles.drawerTitle}>SmartTech</Text>
            <Text style={styles.drawerSubtitle}>{user?.school?.name || 'Student Portal'}</Text>
            <View style={styles.divider} />
            <View style={styles.profileSection}>
              {studentPhoto ? (
                <Image source={{ uri: resolveImageUrl(studentPhoto) || studentPhoto }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
              )}
                <Text style={styles.profileName}>{userName}</Text>
                <Text style={styles.profileRole}>Student</Text>
              </View>
          </View>

          <ScrollView style={styles.drawerNav} showsVerticalScrollIndicator={false}>
            {drawerScreens.map((screen) => (
              <TouchableOpacity key={screen.name} style={[styles.navItem, activeScreen === screen.name && styles.navItemActive]} onPress={() => navigateTo(screen.name)}>
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
  drawerHeader: { padding: spacing.lg, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  drawerLogoImage: { width: 48, height: 48, borderRadius: 12, marginBottom: spacing.sm },
  drawerTitle: { fontSize: 20, fontWeight: '800', color: colors.primary },
  drawerSubtitle: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, width: '80%', marginVertical: spacing.sm },
  profileSection: { alignItems: 'center', marginTop: spacing.xs },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.teal, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  avatarImage: { width: 44, height: 44, borderRadius: 22, marginBottom: 4 },
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
