import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Dimensions, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Input } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAuthStore } from '../../store';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';

const { height, width } = Dimensions.get('window');
const extra = Constants.expoConfig?.extra || {};
const API_BASE_URL = extra.apiBaseUrl || 'https://api.smarttechsaas.com/api/v1';
const BASE_URL = API_BASE_URL.replace('/api/v1', '');

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);
  const [loginMode, setLoginMode] = useState<'email' | 'phone' | 'student' | 'username'>('email');
  const { login, superAdminLogin, isLoading } = useAuthStore();

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/system/logo`);
        const data = await response.json();
        if (data?.url) {
          const resolved = data.url.startsWith('http') ? data.url : `${BASE_URL}${data.url}`;
          setLogoUrl(resolved);
          return;
        }
      } catch {}
      setLogoUrl(`${BASE_URL}/uploads/logo.png`);
    })();
  }, []);

  const handleLogin = async () => {
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter password');
      return;
    }
    if (!email.trim()) {
      const fieldLabel = loginMode === 'student' ? 'student number' : loginMode === 'phone' ? 'phone number' : loginMode === 'username' ? 'username' : 'email';
      Alert.alert('Error', `Please enter ${fieldLabel}`);
      return;
    }
    try {
      if (loginMode === 'student') {
        await login('', password, undefined, email.trim());
      } else if (loginMode === 'phone') {
        await login('', password, undefined, email.trim());
      } else if (loginMode === 'username') {
        await login('', password, undefined, email.trim());
      } else {
        await login(email.trim(), password, undefined);
      }
    } catch (err: any) {
      Alert.alert('Login Failed', err.response?.data?.message || 'Invalid credentials');
    }
  };

  const handleSuperAdminLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    try {
      await superAdminLogin(email.trim(), password);
    } catch (err: any) {
      Alert.alert('Login Failed', err.response?.data?.message || 'Invalid SuperAdmin credentials');
    }
  };

  const handleClearSession = async () => {
    Alert.alert(
      'Clear Session',
      'This will clear your saved login session. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('auth-storage');
              Alert.alert('Session Cleared', 'Please login again');
            } catch (err) {
              Alert.alert('Error', 'Failed to clear session');
            }
          },
        },
      ]
    );
  };

  if (showForgotPassword) {
    return <ForgotPasswordScreen onBack={() => setShowForgotPassword(false)} />;
  }

  return (
    <LinearGradient colors={['#1E3A8A', '#2563EB', '#3B82F6']} style={styles.gradient}>
      <View style={styles.waveTop} />
      <View style={styles.waveMid} />
      <View style={styles.blob1} />
      <View style={styles.blob2} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.topSection}>
              {logoUrl && !logoError ? (
                <Image
                  source={{ uri: logoUrl }}
                  style={styles.logoImage}
                  resizeMode="contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <Image
                  source={require('../../../assets/icon.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              )}
              <Text style={styles.title}>SmartTech</Text>
              <Text style={styles.subtitle}>Welcome to your school intelligence platform</Text>
            </View>

            <View style={styles.formCard}>
              {!showSuperAdmin && (
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, loginMode === 'email' && styles.toggleBtnActive]}
                    onPress={() => { setLoginMode('email'); setEmail(''); }}
                  >
                    <Text style={[styles.toggleText, loginMode === 'email' && styles.toggleTextActive]}>Email</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleBtn, loginMode === 'username' && styles.toggleBtnActive]}
                    onPress={() => { setLoginMode('username'); setEmail(''); }}
                  >
                    <Text style={[styles.toggleText, loginMode === 'username' && styles.toggleTextActive]}>Username</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleBtn, loginMode === 'phone' && styles.toggleBtnActive]}
                    onPress={() => { setLoginMode('phone'); setEmail(''); }}
                  >
                    <Text style={[styles.toggleText, loginMode === 'phone' && styles.toggleTextActive]}>Phone</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleBtn, loginMode === 'student' && styles.toggleBtnActive]}
                    onPress={() => { setLoginMode('student'); setEmail(''); }}
                  >
                    <Text style={[styles.toggleText, loginMode === 'student' && styles.toggleTextActive]}>Student No.</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.inputGroup}>
                <View style={styles.inputIconWrap}>
                  <Text style={styles.inputIcon}>
                    {loginMode === 'student' ? '🎓' : loginMode === 'phone' ? '📱' : loginMode === 'username' ? '👤' : '✉️'}
                  </Text>
                </View>
                <View style={styles.inputField}>
                  <Input
                    label={loginMode === 'student' ? 'Student Number' : loginMode === 'phone' ? 'Phone Number' : loginMode === 'username' ? 'Username' : 'Email'}
                    placeholder={loginMode === 'student' ? 'Enter admission number' : loginMode === 'phone' ? '+260XXXXXXXXX' : loginMode === 'username' ? 'Enter your username' : 'Enter your email'}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType={loginMode === 'email' ? 'email-address' : loginMode === 'student' ? 'default' : 'default'}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputIconWrap}>
                  <Text style={styles.inputIcon}>🔒</Text>
                </View>
                <View style={styles.inputField}>
                  <Input
                    label="Password"
                    placeholder="Enter your password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>
              </View>

              {showSuperAdmin && (
                <View style={styles.saBadge}>
                  <Text style={styles.saBadgeText}>SuperAdmin Access</Text>
                </View>
              )}

              <TouchableOpacity onPress={showSuperAdmin ? handleSuperAdminLogin : handleLogin} disabled={isLoading} activeOpacity={0.8} style={{ marginTop: spacing.md }}>
                <LinearGradient colors={showSuperAdmin ? ['#DC2626', '#B91C1C'] as const : ['#F59E0B', '#D97706'] as const} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.loginBtn}>
                  <Text style={styles.loginBtnText}>{isLoading ? 'Signing in...' : showSuperAdmin ? 'SuperAdmin Sign In' : 'Sign In'}</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setShowForgotPassword(true)} style={{ marginTop: spacing.md }}>
                <Text style={styles.forgotPassword}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setShowSuperAdmin(!showSuperAdmin)} style={styles.clearSessionBtn}>
                <Text style={styles.saToggle}>{showSuperAdmin ? 'Back to School Login' : 'System Owner Login'}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleClearSession} style={styles.clearSessionBtn}>
                <Text style={styles.clearSessionText}>Clear Saved Session</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.bottomSection}>
              <View style={styles.featureRow}>
                <View style={styles.featureBadge}>
                  <Text style={styles.featureBadgeIcon}>🔒</Text>
                </View>
                <Text style={styles.featureText}>Secure encrypted platform</Text>
              </View>
              <View style={styles.featureRow}>
                <View style={styles.featureBadge}>
                  <Text style={styles.featureBadgeIcon}>💬</Text>
                </View>
                <Text style={styles.featureText}>School communication hub</Text>
              </View>
              <Text style={styles.contactText}>Contact your school for account setup</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, minHeight: height * 0.85 },

  waveTop: {
    position: 'absolute',
    top: -60,
    left: -40,
    width: width * 1.3,
    height: 200,
    borderRadius: 200,
    backgroundColor: 'rgba(255,255,255,0.04)',
    transform: [{ rotate: '-10deg' }],
  },
  waveMid: {
    position: 'absolute',
    top: -30,
    right: -60,
    width: width * 0.9,
    height: 160,
    borderRadius: 160,
    backgroundColor: 'rgba(255,255,255,0.06)',
    transform: [{ rotate: '15deg' }],
  },
  blob1: {
    position: 'absolute',
    bottom: '20%',
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  blob2: {
    position: 'absolute',
    bottom: '10%',
    right: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  topSection: { alignItems: 'center', marginBottom: spacing.xl },
  logoImage: { width: 120, height: 120, marginBottom: spacing.md, borderRadius: 20 },
  textLogo: { width: 120, height: 120, marginBottom: spacing.md, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  textLogoMain: { fontSize: 22, fontWeight: '800', color: colors.white, letterSpacing: -0.5 },
  textLogoSub: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)', letterSpacing: 2 },
  shieldOuter: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  shieldLogo: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  shieldInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  shieldIcon: { fontSize: 32 },
  title: { fontSize: 34, fontWeight: '800', color: colors.white, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.8)', marginTop: spacing.xs, textAlign: 'center' },

  formCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xxl,
    padding: spacing.xl,
    ...shadows.lg,
  },
  toggleRow: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: borderRadius.md, padding: 3, marginBottom: spacing.md },
  toggleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: borderRadius.sm },
  toggleBtnActive: { backgroundColor: colors.white, ...shadows.sm },
  toggleText: { fontSize: 13, fontWeight: '500', color: colors.textLight },
  toggleTextActive: { color: colors.primary, fontWeight: '700' },
  inputGroup: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  inputIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  inputIcon: { fontSize: 20 },
  inputField: { flex: 1 },
  loginBtn: { borderRadius: borderRadius.lg, paddingVertical: 16, alignItems: 'center', ...shadows.md },
  loginBtnText: { color: colors.white, fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },
  forgotPassword: { textAlign: 'center', color: colors.textLight, fontSize: 14, fontWeight: '500', marginTop: spacing.lg },
  clearSessionBtn: { marginTop: spacing.sm, paddingVertical: spacing.sm, alignItems: 'center' },
  clearSessionText: { fontSize: 12, color: colors.primaryLight, fontWeight: '500' },
  saToggle: { fontSize: 13, color: '#DC2626', fontWeight: '600', letterSpacing: 0.3 },
  saBadge: { backgroundColor: '#FEE2E2', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 12, alignSelf: 'center', marginBottom: spacing.sm },
  saBadgeText: { fontSize: 12, fontWeight: '700', color: '#DC2626' },

  bottomSection: { alignItems: 'center', marginTop: spacing.xl, gap: spacing.md },
  featureRow: { flexDirection: 'row', alignItems: 'center' },
  featureBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
  featureBadgeIcon: { fontSize: 12 },
  featureText: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.75)' },
  contactText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: spacing.md, textAlign: 'center' },
});
