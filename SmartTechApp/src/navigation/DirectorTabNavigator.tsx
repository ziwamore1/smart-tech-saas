import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store';
import { DirectorDashboardScreen } from '../screens/director/DashboardScreen';
import { DirectorStaffScreen } from '../screens/director/StaffScreen';
import { DirectorReportsScreen } from '../screens/director/ReportsScreen';
import { DirectorSettingsScreen } from '../screens/director/SettingsScreen';
import { DirectorClassesScreen } from '../screens/director/ClassesScreen';
import { DirectorStudentsScreen } from '../screens/director/StudentsScreen';
import { DirectorLibraryScreen } from '../screens/director/LibraryScreen';
import { DirectorTimetableScreen } from '../screens/director/TimetableScreen';
import { DirectorCommunicationScreen } from '../screens/director/CommunicationScreen';
import { DirectorUsersScreen } from '../screens/director/UsersScreen';
import { Grade7Screen } from '../screens/director/Grade7Screen';
import { CurriculumScreen } from '../screens/director/CurriculumScreen';
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

const allDrawerScreens: DrawerScreen[] = [
  { name: 'DirectorHome', label: 'Dashboard', icon: '🏠', component: DirectorDashboardScreen, institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY'] },
  { name: 'DirectorClasses', label: 'Classes', icon: '🏫', component: DirectorClassesScreen, institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY'] },
  { name: 'DirectorStudents', label: 'Students', icon: '👨‍🎓', component: DirectorStudentsScreen, institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY'] },
  { name: 'DirectorStaff', label: 'Staff', icon: '👥', component: DirectorStaffScreen, institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY'] },
  { name: 'DirectorLibrary', label: 'Library', icon: '📚', component: DirectorLibraryScreen, institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY'] },
  { name: 'DirectorTimetable', label: 'Timetable', icon: '📅', component: DirectorTimetableScreen, institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY'] },
  { name: 'DirectorCommunication', label: 'Communication', icon: '💬', component: DirectorCommunicationScreen, institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY'] },
  { name: 'DirectorUsers', label: 'Users', icon: '👤', component: DirectorUsersScreen, institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY'] },
  { name: 'DirectorExams', label: 'Exams', icon: '📋', stackScreen: 'ExamList', institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY'] },
  { name: 'DirectorTemplates', label: 'Templates', icon: '📄', stackScreen: 'TemplateMarketplace', institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY'] },
  { name: 'DirectorAnalytics', label: 'Analytics', icon: '📊', stackScreen: 'Analytics', institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY'] },
  { name: 'DirectorAiTutor', label: 'AI Tutor', icon: '🤖', stackScreen: 'AiTutor', institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY'] },
  { name: 'DirectorReports', label: 'Reports', icon: '📈', component: DirectorReportsScreen, institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY'] },
  { name: 'DirectorStamps', label: 'Digital Stamps', icon: '🔏', stackScreen: 'DigitalStamps', institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY'] },
  { name: 'DirectorApprovals', label: 'Approvals', icon: '✅', stackScreen: 'ApprovalWorkflow', institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY'] },
  { name: 'DirectorGrade7', label: 'Grade 7 ECZ', icon: '🎓', component: Grade7Screen, institutionTypes: ['PRIMARY_SCHOOL'] },
  { name: 'DirectorCurriculum', label: 'Curriculum', icon: '📖', component: CurriculumScreen, institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY'] },
  { name: 'DirectorSettings', label: 'Settings', icon: '⚙️', component: DirectorSettingsScreen, institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY'] },
  { name: 'DirectorProfile', label: 'Profile', icon: '👤', component: ProfileScreen, institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY'] },
];

export const DirectorTabNavigator: React.FC = () => {
  const institutionType = useAuthStore((state) => state.user?.institutionType);
  const drawerScreens = allDrawerScreens.filter((s) => !s.institutionTypes || (institutionType && s.institutionTypes.includes(institutionType)));

  const drawerScreenNames = useMemo(() => drawerScreens.map(s => s.name), [drawerScreens]);
  const stackScreenMap = useMemo(() => drawerScreens.filter(s => s.stackScreen).reduce((acc, s) => {
    acc[s.name] = s.stackScreen!;
    return acc;
  }, {} as Record<string, string>), [drawerScreens]);

  const [activeScreen, setActiveScreen] = useState('DirectorHome');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (drawerOpen) {
        toggleDrawer();
        return true;
      }
      if (activeScreen !== 'DirectorHome') {
        setActiveScreen('DirectorHome');
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
      return <DirectorDashboardScreen onToggleDrawer={toggleDrawer} onNavigate={handleNavigate} stackNavigation={navigation} />;
    }
    if (activeScreen === 'DirectorProfile') {
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
            <Text style={styles.drawerLogo}>🎓</Text>
            <Text style={styles.drawerTitle}>SmartTech</Text>
            <Text style={styles.drawerSubtitle}>Director Portal</Text>
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
  drawerLogo: { fontSize: 40, marginBottom: spacing.sm },
  drawerTitle: { fontSize: 20, fontWeight: '800', color: colors.primary },
  drawerSubtitle: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  drawerNav: { flex: 1, paddingVertical: spacing.sm },
  navItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  navItemActive: { backgroundColor: colors.infoLight, borderRightWidth: 3, borderRightColor: colors.primary },
  navIcon: { fontSize: 20, marginRight: spacing.md, width: 28, textAlign: 'center' },
  navLabel: { fontSize: 15, fontWeight: '500', color: colors.textSecondary },
  navLabelActive: { color: colors.primary, fontWeight: '700' },
  drawerFooter: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' },
  footerText: { fontSize: 11, color: colors.textMuted },
});
