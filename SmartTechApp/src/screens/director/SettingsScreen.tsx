import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAuthStore } from '../../store';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiService } from '../../services/api';
import { refreshSchoolBranding, setStoredSchoolLogo, canManageSchoolBranding } from '../../services/branding';

interface DirectorSettingsProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

export const DirectorSettingsScreen: React.FC<DirectorSettingsProps> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const { user, logout } = useAuthStore();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [logoUri, setLogoUri] = useState<string | null>(user?.school?.logo ?? null);
  const [brandingBusy, setBrandingBusy] = useState(false);

  useEffect(() => {
    refreshSchoolBranding()
      .then((url) => { if (url) setLogoUri(url); })
      .catch(() => {});
  }, []);

  const schoolName = user?.school?.name || user?.schoolName || '';
  const schoolInitials =
    schoolName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => (w[0] || '').toUpperCase()).join('') || '?';

  const handleChangeLogo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to upload a school logo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.length) return;

      setBrandingBusy(true);
      const res = await apiService.uploadSchoolLogo(result.assets[0].uri);
      const url = res?.logoUrl || null;
      if (!url) throw new Error('Upload succeeded but no logo URL was returned');
      await setStoredSchoolLogo(url);
      setLogoUri(url);
      Alert.alert('Success', 'School logo updated. It will now appear on your dashboards.');
    } catch (err: any) {
      console.error('Logo upload failed:', err);
      Alert.alert('Upload failed', err?.response?.data?.message || err?.message || 'Could not upload the logo. Please try again.');
    } finally {
      setBrandingBusy(false);
    }
  };

  const handleRemoveLogo = () => {
    Alert.alert(
      'Remove Logo',
      'Remove the school logo? Your dashboards will fall back to initials.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setBrandingBusy(true);
              await apiService.deleteSchoolLogo();
              await setStoredSchoolLogo(null);
              setLogoUri(null);
              Alert.alert('Success', 'School logo removed.');
            } catch (err: any) {
              console.error('Logo removal failed:', err);
              Alert.alert('Failed', err?.response?.data?.message || 'Could not remove the logo. Please try again.');
            } finally {
              setBrandingBusy(false);
            }
          },
        },
      ]
    );
  };

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
        { icon: '🔒', label: 'Security & Privacy', action: () => handleNav('PasswordManagement') },
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
        { icon: '📅', label: 'Academic Years & Terms', action: () => handleNav('AcademicYearManagement') },
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

        {canManageSchoolBranding(user) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>School Branding</Text>
            <View style={[styles.sectionCard, styles.brandingCard]}>
              <View style={styles.brandingRow}>
                {logoUri ? (
                  <Image source={{ uri: logoUri }} style={styles.brandingLogo} />
                ) : (
                  <View style={[styles.brandingLogo, styles.brandingLogoFallback]}>
                    <Text style={styles.brandingLogoInitials}>{schoolInitials}</Text>
                  </View>
                )}
                <View style={styles.brandingInfo}>
                  <Text style={styles.brandingName} numberOfLines={1}>{schoolName || 'Your school'}</Text>
                  <Text style={styles.brandingHint}>
                    {logoUri
                      ? 'Shown on dashboards and reports on every device.'
                      : 'Upload your school logo to personalise your dashboards.'}
                  </Text>
                </View>
              </View>
              <View style={styles.brandingActions}>
                <TouchableOpacity
                  style={[styles.brandingPrimaryButton, brandingBusy && styles.brandingButtonDisabled]}
                  onPress={handleChangeLogo}
                  disabled={brandingBusy}
                >
                  <Text style={styles.brandingPrimaryText}>
                    {brandingBusy ? 'Working…' : logoUri ? 'Change Logo' : 'Upload Logo'}
                  </Text>
                </TouchableOpacity>
                {!!logoUri && (
                  <TouchableOpacity
                    style={[styles.brandingDangerButton, brandingBusy && styles.brandingButtonDisabled]}
                    onPress={handleRemoveLogo}
                    disabled={brandingBusy}
                  >
                    <Text style={styles.brandingDangerText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

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
  brandingCard: { paddingVertical: spacing.sm },
  brandingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  brandingLogo: { width: 72, height: 72, borderRadius: 18, backgroundColor: colors.background },
  brandingLogoFallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary },
  brandingLogoInitials: { fontSize: 24, fontWeight: '700', color: colors.white },
  brandingInfo: { flex: 1, marginLeft: spacing.md },
  brandingName: { fontSize: 16, fontWeight: '700', color: colors.text },
  brandingHint: { fontSize: 12, color: colors.textLight, marginTop: 4 },
  brandingActions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  brandingPrimaryButton: { flex: 1, backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: spacing.sm + 2, alignItems: 'center', marginRight: spacing.sm },
  brandingButtonDisabled: { opacity: 0.6 },
  brandingPrimaryText: { color: colors.white, fontSize: 14, fontWeight: '600' },
  brandingDangerButton: { backgroundColor: colors.errorLight, borderRadius: borderRadius.lg, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg, alignItems: 'center' },
  brandingDangerText: { color: colors.error, fontSize: 14, fontWeight: '600' },
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
