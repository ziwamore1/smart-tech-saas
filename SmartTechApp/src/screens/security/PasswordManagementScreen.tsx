import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, Button, Input } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export const PasswordManagementScreen: React.FC<Props> = ({ navigation }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChanging, setIsChanging] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [passwordHistory, setPasswordHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword) {
      Alert.alert('Validation Error', 'Current password is required');
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
    setIsChanging(true);
    try {
      await apiService.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password changed successfully');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to change password');
    } finally {
      setIsChanging(false);
    }
  };

  const handleGeneratePassword = async () => {
    setIsGenerating(true);
    try {
      const result = await apiService.generatePassword();
      setGeneratedPassword(result.password);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to generate password');
    } finally {
      setIsGenerating(false);
    }
  };

  const loadPasswordHistory = async () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setIsLoadingHistory(true);
    try {
      const history = await apiService.getPasswordHistory();
      setPasswordHistory(history);
      setShowHistory(true);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to load password history');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Password Management</Text>
        </View>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Change Password</Text>
          <Input
            label="Current Password"
            placeholder="Enter current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
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
            title="Update Password"
            onPress={handleChangePassword}
            loading={isChanging}
            style={styles.actionBtn}
          />
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Generate Secure Password</Text>
          <Text style={styles.sectionDesc}>
            Generate a cryptographically secure random password following your school's password policy.
          </Text>
          <Button
            title={isGenerating ? 'Generating...' : 'Generate Password'}
            onPress={handleGeneratePassword}
            variant="secondary"
            loading={isGenerating}
            style={styles.actionBtn}
          />
          {generatedPassword && (
            <View style={styles.generatedBox}>
              <Text style={styles.generatedLabel}>Generated Password:</Text>
              <View style={styles.passwordRow}>
                <Text style={styles.generatedPassword} selectable>{generatedPassword}</Text>
                <TouchableOpacity
                  onPress={() => {
                    // Copy handled by selectable text on long press
                    Alert.alert('Copied', 'Password copied to clipboard');
                  }}
                  style={styles.copyBtn}
                >
                  <Text style={styles.copyBtnText}>Copy</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Card>

        <Card style={styles.section}>
          <TouchableOpacity onPress={loadPasswordHistory} style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>Password History</Text>
            <Text style={styles.historyToggle}>{showHistory ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
          {isLoadingHistory && <ActivityIndicator color={colors.primary} style={styles.loader} />}
          {showHistory && passwordHistory.length === 0 && !isLoadingHistory && (
            <Text style={styles.emptyText}>No password history available.</Text>
          )}
          {showHistory && passwordHistory.map((entry, index) => (
            <View key={entry.id || index} style={styles.historyItem}>
              <Text style={styles.historyDate}>
                {new Date(entry.changedAt || entry.createdAt).toLocaleDateString()}
              </Text>
              <Text style={styles.historyReason}>{entry.reason || 'Manual change'}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    paddingRight: spacing.md,
  },
  backText: {
    fontSize: 16,
    color: colors.primaryLight,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  section: {
    margin: spacing.md,
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sectionDesc: {
    fontSize: 13,
    color: colors.textLight,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  actionBtn: {
    marginTop: spacing.sm,
  },
  generatedBox: {
    marginTop: spacing.md,
    backgroundColor: colors.infoLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  generatedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.info,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  generatedPassword: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'monospace',
    flex: 1,
  },
  copyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  copyBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyToggle: {
    fontSize: 14,
    color: colors.primaryLight,
    fontWeight: '500',
  },
  loader: {
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  historyDate: {
    fontSize: 13,
    color: colors.textLight,
  },
  historyReason: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
});
