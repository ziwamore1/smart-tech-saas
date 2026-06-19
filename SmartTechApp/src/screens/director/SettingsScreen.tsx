import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAuthStore } from '../../store';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface DirectorSettingsProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

export const DirectorSettingsScreen: React.FC<DirectorSettingsProps> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const { user, logout } = useAuthStore();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (err) {
              console.error('Logout failed:', err);
            }
          },
        },
      ]
    );
  };

  const drawerScreens = ['DirectorReports', 'DirectorStaff', 'DirectorSettings', 'DirectorProfile', 'DirectorHome', 'DirectorClasses', 'DirectorStudents', 'DirectorLibrary', 'DirectorTimetable', 'DirectorCommunication', 'DirectorUsers'];

  const handleNav = (screen: string) => {
    if (drawerScreens.includes(screen) && onNavigate) {
      onNavigate(screen);
    } else if (stackNavigation) {
      stackNavigation.navigate(screen as never);
    } else {
      navigation.navigate(screen as never);
    }
  };

  const settingsSections = [
    {
      title: 'Account',
      items: [
        { icon: '👤', label: 'Profile Settings', action: () => handleNav('DirectorProfile') },
        { icon: '🔒', label: 'Security & Privacy', action: () => {} },
        { icon: '🔔', label: 'Notification Preferences', action: () => handleNav('Notifications') },
      ],
    },
    {
      title: 'School Management',
      items: [
        { icon: '🏫', label: 'Classes', action: () => handleNav('DirectorClasses') },
        { icon: '👨‍🎓', label: 'Students', action: () => handleNav('DirectorStudents') },
        { icon: '👥', label: 'Staff Management', action: () => handleNav('DirectorStaff') },
        { icon: '👤', label: 'Users Management', action: () => handleNav('DirectorUsers') },
        { icon: '📚', label: 'Library', action: () => handleNav('DirectorLibrary') },
        { icon: '📅', label: 'Timetable', action: () => handleNav('DirectorTimetable') },
        { icon: '💬', label: 'Communication', action: () => handleNav('DirectorCommunication') },
        { icon: '📊', label: 'Reports & Analytics', action: () => handleNav('DirectorReports') },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: '❓', label: 'Help & FAQ', action: () => {} },
        { icon: '📝', label: 'Send Feedback', action: () => {} },
        { icon: '📖', label: 'User Guide', action: () => handleNav('UserGuide') },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Settings"
        subtitle="Manage your account"
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>👤</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.firstName} {user?.lastName}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <Text style={styles.profileRole}>{(user?.roles||[]).join(', ') || 'Director'}</Text>
          </View>
        </View>

        {settingsSections.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, iIdx) => (
                <TouchableOpacity
                  key={iIdx}
                  style={[styles.settingItem, iIdx < section.items.length - 1 && styles.settingItemBorder]}
                  onPress={item.action}
                >
                  <Text style={styles.settingIcon}>{item.icon}</Text>
                  <Text style={styles.settingLabel}>{item.label}</Text>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutIcon}>🚪</Text>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>SmartTech v1.0.0</Text>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.lg, ...shadows.card },
  profileAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  profileAvatarText: { fontSize: 32 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: colors.text },
  profileEmail: { fontSize: 14, color: colors.textLight, marginTop: 2 },
  profileRole: { fontSize: 12, fontWeight: '600', color: colors.primary, marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: colors.infoLight, borderRadius: borderRadius.sm, alignSelf: 'flex-start' },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.textLight, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCard: { backgroundColor: colors.white, borderRadius: borderRadius.xl, ...shadows.card },
  settingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  settingItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  settingIcon: { fontSize: 20, marginRight: spacing.md },
  settingLabel: { flex: 1, fontSize: 15, color: colors.text },
  chevron: { fontSize: 20, color: colors.textLight },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.errorLight, borderRadius: borderRadius.lg, paddingVertical: spacing.md, marginTop: spacing.md },
  logoutIcon: { fontSize: 20, marginRight: spacing.sm },
  logoutText: { fontSize: 16, fontWeight: '600', color: colors.error },
  versionText: { textAlign: 'center', fontSize: 12, color: colors.textMuted, marginTop: spacing.lg },
});
