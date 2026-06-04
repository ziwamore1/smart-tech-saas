import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

interface SecurityOption {
  title: string;
  description: string;
  icon: string;
  screen: string;
  color: string;
  bgColor: string;
}

export const DeviceSecurityScreen: React.FC<Props> = ({ navigation }) => {
  const options: SecurityOption[] = [
    {
      title: 'Password Management',
      description: 'Change password, generate secure passwords, view history',
      icon: '🔑',
      screen: 'PasswordManagement',
      color: colors.primary,
      bgColor: colors.infoLight,
    },
    {
      title: 'Account Recovery',
      description: 'Forgot password, forgot username, reset password',
      icon: '🔒',
      screen: 'AccountRecovery',
      color: colors.accent,
      bgColor: colors.warningLight,
    },
    {
      title: 'OTP Verification',
      description: 'Send and verify one-time passwords via email, SMS, or WhatsApp',
      icon: '📱',
      screen: 'OtpVerification',
      color: colors.teal,
      bgColor: colors.tealLight,
    },
    {
      title: 'Session & Device Manager',
      description: 'View active sessions and manage registered devices',
      icon: '💻',
      screen: 'SessionManagement',
      color: colors.purple,
      bgColor: colors.purpleLight,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Security</Text>
        </View>

        <View style={styles.introCard}>
          <Text style={styles.introIcon}>🛡️</Text>
          <Text style={styles.introTitle}>Account Security</Text>
          <Text style={styles.introDesc}>
            Manage your account security settings including passwords, devices, and recovery options.
          </Text>
        </View>

        {options.map((option, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => navigation.navigate(option.screen)}
            activeOpacity={0.7}
          >
            <Card style={styles.optionCard}>
              <View style={[styles.optionIcon, { backgroundColor: option.bgColor }]}>
                <Text style={styles.optionIconText}>{option.icon}</Text>
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionDesc}>{option.description}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Card>
          </TouchableOpacity>
        ))}

        <Card style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>🔐 Security Tips</Text>
          <View style={styles.tipItem}>
            <Text style={styles.tipBullet}>•</Text>
            <Text style={styles.tipText}>Use a unique password for this account that you don't use elsewhere</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipBullet}>•</Text>
            <Text style={styles.tipText}>Enable two-factor authentication (OTP) for added security</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipBullet}>•</Text>
            <Text style={styles.tipText}>Regularly review active sessions and remove unrecognized devices</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipBullet}>•</Text>
            <Text style={styles.tipText}>Never share your password or OTP codes with anyone</Text>
          </View>
          <View style={[styles.tipItem, { borderBottomWidth: 0 }]}>
            <Text style={styles.tipBullet}>•</Text>
            <Text style={styles.tipText}>Use a password manager to store and generate strong passwords</Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { paddingRight: spacing.md },
  backText: { fontSize: 16, color: colors.primaryLight, fontWeight: '500' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1 },
  introCard: {
    backgroundColor: colors.primary,
    margin: spacing.md,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  introIcon: { fontSize: 48, marginBottom: spacing.md },
  introTitle: { fontSize: 20, fontWeight: '700', color: colors.white, marginBottom: spacing.xs },
  introDesc: { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 18 },
  optionCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  optionIconText: { fontSize: 24 },
  optionInfo: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 2 },
  optionDesc: { fontSize: 12, color: colors.textLight, lineHeight: 16 },
  chevron: { fontSize: 24, color: colors.textMuted, marginLeft: spacing.sm },
  tipsCard: {
    margin: spacing.md,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
  },
  tipsTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  tipItem: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  tipBullet: { fontSize: 14, color: colors.success, marginRight: spacing.sm, lineHeight: 20 },
  tipText: { fontSize: 13, color: colors.textLight, flex: 1, lineHeight: 20 },
});
