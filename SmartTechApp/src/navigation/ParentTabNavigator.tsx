import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, BackHandler, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store';
import { ParentDashboardScreen } from '../screens/parent/DashboardScreen';
import { ParentChildrenScreen } from '../screens/parent/ChildrenScreen';
import { ParentHomeworkScreen } from '../screens/parent/HomeworkScreen';
import { ParentAssessmentsScreen } from '../screens/parent/AssessmentsScreen';
import { ParentAttendanceScreen } from '../screens/parent/AttendanceScreen';
import { ParentReportCardsScreen } from '../screens/parent/ReportCardsScreen';
import { ParentAnalyticsScreen } from '../screens/parent/AnalyticsScreen';
import { ProfileScreen } from '../screens/common/ProfileScreen';
import { colors, spacing, borderRadius, shadows } from '../theme';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = 280;

interface DrawerSection {
  title?: string;
  items: DrawerItem[];
}

interface DrawerItem {
  name: string;
  label: string;
  icon: string;
  component?: React.FC<any>;
  stackScreen?: string;
}

const drawerSections: DrawerSection[] = [
  { items: [
    { name: 'ParentHome', label: 'Dashboard', icon: '🏠', component: ParentDashboardScreen },
    { name: 'ParentChildrenList', label: 'My Children', icon: '👨‍👩‍👧‍👦', component: ParentChildrenScreen },
  ]},
  { title: 'ACADEMIC',
    items: [
      { name: 'ParentResults', label: 'Results', icon: '📝', stackScreen: 'ParentChildResults' },
      { name: 'ParentReportCards', label: 'Report Cards', icon: '📄', component: ParentReportCardsScreen },
      { name: 'ParentHomework', label: 'Homework', icon: '📚', component: ParentHomeworkScreen },
      { name: 'ParentAssessments', label: 'Assessments', icon: '📋', component: ParentAssessmentsScreen },
    ],
  },
  { title: 'MONITORING',
    items: [
      { name: 'ParentAttendance', label: 'Attendance', icon: '✅', component: ParentAttendanceScreen },
      { name: 'ParentAnalytics', label: 'Analytics', icon: '📊', component: ParentAnalyticsScreen },
    ],
  },
  { title: 'SERVICES',
    items: [
      { name: 'ParentAiTutor', label: 'AI Tutor', icon: '🤖', stackScreen: 'AiTutor' },
      { name: 'ParentProfile', label: 'Profile', icon: '👤', component: ProfileScreen },
    ],
  },
];

export const ParentTabNavigator: React.FC = () => {
  const { user, logout } = useAuthStore();

  const allItems = useMemo(() => drawerSections.flatMap(s => s.items), []);
  const stackScreenMap = useMemo(() => allItems.filter(s => s.stackScreen).reduce((acc, s) => {
    acc[s.name] = s.stackScreen!;
    return acc;
  }, {} as Record<string, string>), [allItems]);

  const [activeScreen, setActiveScreen] = useState('ParentHome');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (drawerOpen) { toggleDrawer(); return true; }
      if (activeScreen !== 'ParentHome') { setActiveScreen('ParentHome'); return true; }
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

  const allItemNames = useMemo(() => allItems.map(i => i.name), [allItems]);

  const handleNavigate = useCallback((screen: string) => {
    const item = allItems.find(i => i.name === screen);
    if (item?.stackScreen) {
      setDrawerOpen(false);
      Animated.timing(slideAnim, { toValue: -DRAWER_WIDTH, duration: 250, useNativeDriver: true }).start(() => navigation.navigate(item.stackScreen as never));
    } else if (allItemNames.includes(screen)) {
      setActiveScreen(screen);
      setDrawerOpen(false);
      Animated.timing(slideAnim, { toValue: -DRAWER_WIDTH, duration: 250, useNativeDriver: true }).start();
    } else {
      navigation.navigate(screen as never);
    }
  }, [navigation, allItemNames, allItems]);

  const navigateTo = (name: string) => {
    handleNavigate(name);
  };

  const renderActiveScreen = () => {
    const item = allItems.find(i => i.name === activeScreen);
    if (!item || item.stackScreen) return <ParentDashboardScreen onToggleDrawer={toggleDrawer} onNavigate={handleNavigate} stackNavigation={navigation} />;
    if (activeScreen === 'ParentProfile') return <ProfileScreen navigation={navigation as any} />;
    const Component = item.component as React.FC<any>;
    return <Component onToggleDrawer={toggleDrawer} onNavigate={handleNavigate} stackNavigation={navigation} />;
  };

  const initials = user ? `${(user.firstName||'')[0]||''}${(user.lastName||'')[0]||''}`.toUpperCase() : 'P';
  const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Parent';

  return (
    <View style={styles.container}>
      {renderActiveScreen()}

      {drawerOpen && <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={toggleDrawer} />}

      <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
        <SafeAreaView style={styles.drawerContent} edges={['top', 'bottom']}>
          <View style={styles.drawerHeader}>
            <Image source={require('../../assets/icon.png')} style={styles.drawerLogoImage} resizeMode="contain" />
            <Text style={styles.drawerTitle}>SmartTech</Text>
            <Text style={styles.drawerSubtitle}>{user?.school?.name || 'Parent Portal'}</Text>
            <View style={styles.divider} />
            <View style={styles.profileSection}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
              <Text style={styles.profileName}>{userName}</Text>
              <Text style={styles.profileRole}>Parent</Text>
            </View>
          </View>

          <ScrollView style={styles.drawerNav} showsVerticalScrollIndicator={false}>
            {drawerSections.map((section, si) => (
              <View key={si}>
                {section.title && <Text style={styles.sectionTitle}>{section.title}</Text>}
                {section.items.map((item) => (
                  <TouchableOpacity key={item.name} style={[styles.navItem, activeScreen === item.name && styles.navItemActive]} onPress={() => navigateTo(item.name)}>
                    <Text style={styles.navIcon}>{item.icon}</Text>
                    <Text style={[styles.navLabel, activeScreen === item.name && styles.navLabelActive]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
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
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.white },
  profileName: { fontSize: 14, fontWeight: '600', color: colors.text },
  profileRole: { fontSize: 11, color: colors.textLight, marginTop: 1 },
  drawerNav: { flex: 1, paddingVertical: spacing.xs },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs },
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
