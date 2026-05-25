import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
import { ProfileScreen } from '../screens/common/ProfileScreen';
import { colors, spacing, borderRadius, shadows } from '../theme';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = 280;

const drawerScreens = [
  { name: 'DirectorHome', label: 'Dashboard', icon: '🏠', component: DirectorDashboardScreen },
  { name: 'DirectorClasses', label: 'Classes', icon: '🏫', component: DirectorClassesScreen },
  { name: 'DirectorStudents', label: 'Students', icon: '👨‍🎓', component: DirectorStudentsScreen },
  { name: 'DirectorStaff', label: 'Staff', icon: '👥', component: DirectorStaffScreen },
  { name: 'DirectorLibrary', label: 'Library', icon: '📚', component: DirectorLibraryScreen },
  { name: 'DirectorTimetable', label: 'Timetable', icon: '📅', component: DirectorTimetableScreen },
  { name: 'DirectorCommunication', label: 'Communication', icon: '💬', component: DirectorCommunicationScreen },
  { name: 'DirectorUsers', label: 'Users', icon: '👤', component: DirectorUsersScreen },
  { name: 'DirectorExams', label: 'Exams', icon: '📋', stackScreen: 'ExamList' },
  { name: 'DirectorTemplates', label: 'Templates', icon: '📄', stackScreen: 'TemplateMarketplace' },
  { name: 'DirectorAnalytics', label: 'Analytics', icon: '📊', stackScreen: 'Analytics' },
  { name: 'DirectorAiTutor', label: 'AI Tutor', icon: '🤖', stackScreen: 'AiTutor' },
  { name: 'DirectorReports', label: 'Reports', icon: '📈', component: DirectorReportsScreen },
  { name: 'DirectorStamps', label: 'Digital Stamps', icon: '🔏', stackScreen: 'DigitalStamps' },
  { name: 'DirectorApprovals', label: 'Approvals', icon: '✅', stackScreen: 'ApprovalWorkflow' },
  { name: 'DirectorSettings', label: 'Settings', icon: '⚙️', component: DirectorSettingsScreen },
  { name: 'DirectorProfile', label: 'Profile', icon: '👤', component: ProfileScreen },
];

const drawerScreenNames = drawerScreens.map(s => s.name);
const stackScreenMap = drawerScreens.filter(s => s.stackScreen).reduce((acc, s) => {
  acc[s.name] = s.stackScreen!;
  return acc;
}, {} as Record<string, string>);

export const DirectorTabNavigator: React.FC = () => {
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
