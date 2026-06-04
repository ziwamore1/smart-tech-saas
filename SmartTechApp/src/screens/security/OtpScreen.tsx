import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, Button } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

type Channel = 'EMAIL' | 'SMS' | 'WHATSAPP';

export const OtpScreen: React.FC<Props> = ({ navigation }) => {
  const [destination, setDestination] = useState('');
  const [channel, setChannel] = useState<Channel>('EMAIL');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpSent, setOtpSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [purpose, setPurpose] = useState<'password_reset' | 'account_verification' | 'mfa'>('account_verification');
  const inputRefs = useRef<TextInput[]>([]);

  const handleSendOtp = async () => {
    if (!destination.trim()) {
      Alert.alert('Validation Error', `Please enter your ${channel === 'EMAIL' ? 'email address' : 'phone number'}`);
      return;
    }
    setIsSending(true);
    try {
      await apiService.sendOtp({
        destination: destination.trim(),
        channel,
        purpose,
      });
      setOtpSent(true);
      Alert.alert('OTP Sent', `An OTP has been sent to your ${channel === 'EMAIL' ? 'email' : 'phone'} via ${channel}`);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      Alert.alert('Validation Error', 'Please enter the complete 6-digit OTP');
      return;
    }
    setIsVerifying(true);
    try {
      await apiService.verifyOtp({
        destination: destination.trim(),
        otp: code,
        purpose,
      });
      setVerified(true);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Invalid or expired OTP');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text.replace(/[^0-9]/g, '').slice(0, 1);
    setOtp(newOtp);

    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const channels: { key: Channel; label: string; icon: string }[] = [
    { key: 'EMAIL', label: 'Email', icon: '📧' },
    { key: 'SMS', label: 'SMS', icon: '📱' },
    { key: 'WHATSAPP', label: 'WhatsApp', icon: '💬' },
  ];

  const purposes: { key: typeof purpose; label: string }[] = [
    { key: 'password_reset', label: 'Password Reset' },
    { key: 'account_verification', label: 'Account Verification' },
    { key: 'mfa', label: 'Multi-Factor Auth' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>OTP Verification</Text>
        </View>

        {verified ? (
          <Card style={styles.verifiedCard}>
            <Text style={styles.verifiedIcon}>✅</Text>
            <Text style={styles.verifiedTitle}>Verified Successfully</Text>
            <Text style={styles.verifiedDesc}>
              Your identity has been verified for {purpose.replace('_', ' ')}.
            </Text>
            <Button title="Done" onPress={() => navigation.goBack()} style={styles.actionBtn} />
          </Card>
        ) : (
          <>
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Select Purpose</Text>
              <View style={styles.purposeRow}>
                {purposes.map((p) => (
                  <TouchableOpacity
                    key={p.key}
                    onPress={() => setPurpose(p.key)}
                    style={[styles.purposeTab, purpose === p.key && styles.purposeTabActive]}
                  >
                    <Text style={[styles.purposeTabText, purpose === p.key && styles.purposeTabTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>

            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Delivery Channel</Text>
              <View style={styles.channelRow}>
                {channels.map((c) => (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => setChannel(c.key)}
                    style={[styles.channelCard, channel === c.key && styles.channelCardActive]}
                  >
                    <Text style={styles.channelIcon}>{c.icon}</Text>
                    <Text style={[styles.channelLabel, channel === c.key && styles.channelLabelActive]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Input
                label={channel === 'EMAIL' ? 'Email Address' : 'Phone Number'}
                placeholder={channel === 'EMAIL' ? 'Enter your email' : 'Enter your phone number'}
                value={destination}
                onChangeText={setDestination}
                keyboardType={channel === 'EMAIL' ? 'email-address' : 'phone-pad'}
                autoCapitalize="none"
              />

              <Button
                title={isSending ? 'Sending...' : otpSent ? 'Resend OTP' : 'Send OTP'}
                onPress={handleSendOtp}
                loading={isSending}
                variant={otpSent ? 'outline' : 'primary'}
                style={styles.actionBtn}
              />
            </Card>

            {otpSent && (
              <Card style={styles.section}>
                <Text style={styles.sectionTitle}>Enter OTP</Text>
                <Text style={styles.sectionDesc}>
                  Enter the 6-digit code sent to your {channel === 'EMAIL' ? 'email' : 'phone'}.
                </Text>
                <View style={styles.otpRow}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => { if (ref) inputRefs.current[index] = ref; }}
                      style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
                      value={digit}
                      onChangeText={(text) => handleOtpChange(text, index)}
                      onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, index)}
                      keyboardType="numeric"
                      maxLength={1}
                      selectTextOnFocus
                    />
                  ))}
                </View>
                <Button
                  title={isVerifying ? 'Verifying...' : 'Verify OTP'}
                  onPress={handleVerifyOtp}
                  loading={isVerifying}
                  style={styles.actionBtn}
                />
                <TouchableOpacity onPress={handleSendOtp} style={styles.resendBtn}>
                  <Text style={styles.resendText}>Resend Code</Text>
                </TouchableOpacity>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const Input: React.FC<{
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}> = ({ label, placeholder, value, onChangeText, keyboardType = 'default', autoCapitalize = 'none' }) => (
  <View style={localInputStyles.container}>
    <Text style={localInputStyles.label}>{label}</Text>
    <TextInput
      style={localInputStyles.input}
      placeholder={placeholder}
      placeholderTextColor={colors.textLight}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
    />
  </View>
);

const localInputStyles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '500', color: colors.textLight, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
  },
});

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
  section: { margin: spacing.md, padding: spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  sectionDesc: { fontSize: 13, color: colors.textLight, marginBottom: spacing.md, lineHeight: 18 },
  actionBtn: { marginTop: spacing.sm },
  purposeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  purposeTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  purposeTabActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryLight,
  },
  purposeTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textLight,
    textAlign: 'center',
  },
  purposeTabTextActive: {
    color: colors.white,
  },
  channelRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  channelCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  channelCardActive: {
    backgroundColor: colors.infoLight,
    borderColor: colors.info,
  },
  channelIcon: { fontSize: 28, marginBottom: spacing.xs },
  channelLabel: { fontSize: 12, fontWeight: '600', color: colors.textLight },
  channelLabelActive: { color: colors.info },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: colors.white,
  },
  otpInputFilled: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.infoLight,
  },
  resendBtn: { alignItems: 'center', paddingVertical: spacing.md },
  resendText: { color: colors.primaryLight, fontSize: 14, fontWeight: '500', textDecorationLine: 'underline' },
  verifiedCard: {
    margin: spacing.md,
    padding: spacing.xxl,
    alignItems: 'center',
    marginTop: spacing.xxl * 2,
  },
  verifiedIcon: { fontSize: 64, marginBottom: spacing.lg },
  verifiedTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  verifiedDesc: { fontSize: 14, color: colors.textLight, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 20 },
});
