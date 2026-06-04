import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, Button, Input } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

type RecoveryMode = 'forgot-password' | 'forgot-username' | 'reset-password';

export const AccountRecoveryScreen: React.FC<Props> = ({ navigation }) => {
  const [mode, setMode] = useState<RecoveryMode>('forgot-password');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [usernameRecovered, setUsernameRecovered] = useState<string | null>(null);

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Validation Error', 'Please enter your email address');
      return;
    }
    setIsLoading(true);
    try {
      await apiService.forgotPassword(email.trim());
      setEmailSent(true);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotUsername = async () => {
    if (!email.trim() && !phone.trim()) {
      Alert.alert('Validation Error', 'Please enter your email or phone number');
      return;
    }
    setIsLoading(true);
    try {
      const result = await apiService.forgotUsername({ email: email.trim() || undefined, phone: phone.trim() || undefined });
      setUsernameRecovered(result.username);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to recover username');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!token.trim()) {
      Alert.alert('Validation Error', 'Reset token is required');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Validation Error', 'New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match');
      return;
    }
    setIsLoading(true);
    try {
      await apiService.resetPassword(token.trim(), newPassword);
      Alert.alert('Success', 'Password has been reset successfully. You can now log in with your new password.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const renderModeSelector = () => (
    <View style={styles.modeRow}>
      {(['forgot-password', 'forgot-username', 'reset-password'] as RecoveryMode[]).map((m) => (
        <TouchableOpacity
          key={m}
          onPress={() => { setMode(m); setEmailSent(false); setUsernameRecovered(null); }}
          style={[styles.modeTab, mode === m && styles.modeTabActive]}
        >
          <Text style={[styles.modeTabText, mode === m && styles.modeTabTextActive]}>
            {m === 'forgot-password' ? 'Forgot Password' : m === 'forgot-username' ? 'Forgot Username' : 'Reset Password'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderForgotPassword = () => (
    <>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>Forgot Password?</Text>
      <Text style={styles.subtitle}>
        {emailSent
          ? 'We have sent a password reset link to your email. Please check your inbox.'
          : 'Enter your email address and we will send you a link to reset your password.'}
      </Text>
      {!emailSent && (
        <>
          <Input
            label="Email Address"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Button
            title={isLoading ? 'Sending...' : 'Send Reset Link'}
            onPress={handleForgotPassword}
            loading={isLoading}
            style={styles.actionBtn}
          />
        </>
      )}
      {emailSent && (
        <TouchableOpacity onPress={() => setEmailSent(false)} style={styles.resendBtn}>
          <Text style={styles.resendText}>Resend Email</Text>
        </TouchableOpacity>
      )}
    </>
  );

  const renderForgotUsername = () => (
    <>
      <Text style={styles.icon}>👤</Text>
      <Text style={styles.title}>Forgot Username?</Text>
      <Text style={styles.subtitle}>
        Enter your email or phone number to recover your username.
      </Text>
      {usernameRecovered ? (
        <View style={styles.recoveredBox}>
          <Text style={styles.recoveredLabel}>Your Username:</Text>
          <Text style={styles.recoveredValue}>{usernameRecovered}</Text>
        </View>
      ) : (
        <>
          <Input
            label="Email Address"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Text style={styles.orText}>OR</Text>
          <Input
            label="Phone Number"
            placeholder="Enter your phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <Button
            title={isLoading ? 'Searching...' : 'Recover Username'}
            onPress={handleForgotUsername}
            loading={isLoading}
            style={styles.actionBtn}
          />
        </>
      )}
    </>
  );

  const renderResetPassword = () => (
    <>
      <Text style={styles.icon}>🔑</Text>
      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.subtitle}>
        Enter the reset token sent to your email and your new password.
      </Text>
      <Input
        label="Reset Token"
        placeholder="Enter reset token"
        value={token}
        onChangeText={setToken}
        autoCapitalize="none"
      />
      <Input
        label="New Password"
        placeholder="Enter new password (min 8 chars)"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
      />
      <Input
        label="Confirm New Password"
        placeholder="Confirm new password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      <Button
        title={isLoading ? 'Resetting...' : 'Reset Password'}
        onPress={handleResetPassword}
        loading={isLoading}
        style={styles.actionBtn}
      />
    </>
  );

  return (
    <LinearGradient colors={['#1E3A8A', '#2563EB', '#3B82F6']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {renderModeSelector()}

            <Card style={styles.formCard}>
              {mode === 'forgot-password' && renderForgotPassword()}
              {mode === 'forgot-username' && renderForgotUsername()}
              {mode === 'reset-password' && renderResetPassword()}
            </Card>
          </ScrollView>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  container: { flex: 1, paddingHorizontal: spacing.lg },
  backBtn: { paddingVertical: spacing.md },
  backText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '500' },
  scrollView: { flex: 1 },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  modeTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  modeTabActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  modeTabTextActive: {
    color: colors.white,
  },
  formCard: {
    borderRadius: borderRadius.xxl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  icon: { fontSize: 48, marginBottom: spacing.md },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: spacing.xs, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textLight, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 },
  actionBtn: { width: '100%', marginTop: spacing.md },
  resendBtn: { paddingVertical: spacing.md },
  resendText: { color: colors.primaryLight, fontSize: 15, fontWeight: '500', textDecorationLine: 'underline' },
  orText: { textAlign: 'center', color: colors.textLight, fontSize: 13, fontWeight: '600', marginVertical: spacing.sm },
  recoveredBox: {
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    width: '100%',
    alignItems: 'center',
  },
  recoveredLabel: { fontSize: 12, fontWeight: '600', color: colors.success, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs },
  recoveredValue: { fontSize: 20, fontWeight: '700', color: colors.text, fontFamily: 'monospace' },
});
