import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HeaderBar } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';

export const SuperAdminCreateSchoolScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [form, setForm] = useState({ name: '', code: '', email: '', phone: '', address: '' });
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!form.name.trim()) { Alert.alert('Validation', 'School name is required'); return; }
    if (!form.email.trim()) { Alert.alert('Validation', 'Email is required'); return; }
    setLoading(true);
    try {
      await apiService.createSuperAdminSchool(form);
      Alert.alert('Success', 'School created successfully', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Failed to create school');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: 'name', label: 'School Name', placeholder: 'e.g. Smart Tech Academy' },
    { key: 'code', label: 'School Code', placeholder: 'e.g. STA001' },
    { key: 'email', label: 'Email', placeholder: 'admin@school.com', keyboardType: 'email-address' as const },
    { key: 'phone', label: 'Phone', placeholder: '+255 123 456 789', keyboardType: 'phone-pad' as const },
    { key: 'address', label: 'Address', placeholder: 'Street, City, Region' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar title="Register School" subtitle="Create a new school" leftIcon={{ name: '←', onPress: () => navigation.goBack() }} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {fields.map((f) => (
          <View key={f.key} style={styles.fieldGroup}>
            <Text style={styles.label}>{f.label}</Text>
            <TextInput
              style={styles.input}
              placeholder={f.placeholder}
              placeholderTextColor={colors.textLight}
              value={(form as any)[f.key]}
              onChangeText={(v) => setForm({ ...form, [f.key]: v })}
              keyboardType={(f as any).keyboardType || 'default'}
            />
          </View>
        ))}

        <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.6 }]} onPress={handleCreate} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitText}>Create School</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  fieldGroup: { marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  input: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border, ...shadows.sm },
  submitBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md, ...shadows.md },
  submitText: { fontSize: 16, fontWeight: '700', color: colors.white },
});
