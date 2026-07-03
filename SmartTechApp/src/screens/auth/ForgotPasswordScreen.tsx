import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Input } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';

const { height, width } = Dimensions.get('window');

export const ForgotPasswordScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const isEmail = identifier.includes('@');

  const handleReset = async () => {
    if (!identifier.trim()) {
      Alert.alert('Error', 'Please enter your email or phone number');
      return;
    }
    setIsLoading(true);
    try {
      await apiService.forgotPassword(identifier.trim());
      setEmailSent(true);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to send reset link');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#1E3A8A', '#2563EB', '#3B82F6']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Back to Login</Text>
          </TouchableOpacity>

          <View style={styles.content}>
            <Text style={styles.icon}>🔒</Text>
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              {emailSent
                ? `We have sent a password reset ${isEmail ? 'link' : 'code'} to your ${isEmail ? 'email' : 'phone'}. Please check your ${isEmail ? 'inbox' : 'messages'}.`
                : 'Enter your email or phone number to receive a password reset link/code.'}
            </Text>

            {!emailSent && (
              <View style={styles.formCard}>
                <Input
                  label="Email or Phone Number"
                  placeholder="email@school.com or +260XXXXXXXXX"
                  value={identifier}
                  onChangeText={setIdentifier}
                  keyboardType={isEmail ? 'email-address' : 'phone-pad'}
                  autoCapitalize="none"
                />

                <TouchableOpacity onPress={handleReset} disabled={isLoading} activeOpacity={0.8} style={styles.resetBtn}>
                  <LinearGradient colors={['#F59E0B', '#D97706'] as const} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.resetBtnInner}>
                    <Text style={styles.resetBtnText}>{isLoading ? 'Sending...' : 'Send Reset Link / Code'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {emailSent && (
              <TouchableOpacity onPress={() => setEmailSent(false)} style={styles.resendBtn}>
                <Text style={styles.resendText}>Resend</Text>
              </TouchableOpacity>
            )}
          </View>
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
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  icon: { fontSize: 64, marginBottom: spacing.lg },
  title: { fontSize: 28, fontWeight: '800', color: colors.white, marginBottom: spacing.sm, textAlign: 'center' },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginBottom: spacing.xl, lineHeight: 22 },
  formCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.xxl,
    padding: spacing.xl,
    ...shadows.lg,
  },
  resetBtn: { borderRadius: borderRadius.lg, paddingVertical: 16, alignItems: 'center', marginTop: spacing.lg, ...shadows.md },
  resetBtnInner: { width: '100%', borderRadius: borderRadius.lg, paddingVertical: 16, alignItems: 'center' },
  resetBtnText: { color: colors.white, fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },
  resendBtn: { paddingVertical: spacing.md },
  resendText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '500', textDecorationLine: 'underline' },
});
