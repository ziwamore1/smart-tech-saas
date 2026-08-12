import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store';
import { apiService } from '../../services/api';
import { LinkedIdentity } from '../../types';
import { colors, spacing, borderRadius, shadows } from '../../theme';

export const SuperAdminSwitchSchoolScreen: React.FC<any> = ({ onToggleDrawer }) => {
  const navigation = useNavigation<any>();
  const switchToSchool = useAuthStore((state) => state.switchToSchool);
  const [identities, setIdentities] = useState<LinkedIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await apiService.getLinkedIdentities();
      setIdentities(result?.identities || []);
    } catch (error: any) {
      Alert.alert('Unable to load schools', error?.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSwitch = async (schoolId: string) => {
    setSwitching(schoolId);
    try {
      await switchToSchool(schoolId);
    } catch (error: any) {
      Alert.alert('Switch failed', error?.response?.data?.message || error?.message || 'You are not linked to this school.');
    } finally {
      setSwitching(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onToggleDrawer && <TouchableOpacity onPress={onToggleDrawer}><Text style={styles.menu}>☰</Text></TouchableOpacity>}
        <View><Text style={styles.title}>Linked Schools</Text><Text style={styles.subtitle}>Open a school dashboard with your existing credentials</Text></View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.enrollButton} onPress={() => navigation.navigate('SuperAdminEnrollStaff')}>
          <Text style={styles.enrollText}>＋ Enroll as staff at another school</Text>
        </TouchableOpacity>
        {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : identities.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyTitle}>No linked schools</Text><Text style={styles.emptyText}>Enroll yourself as staff to access a school's dashboard.</Text></View>
        ) : identities.map((identity) => (
          <View key={identity.schoolId} style={styles.card}>
            <View style={styles.icon}><Text>🏫</Text></View>
            <View style={styles.details}><Text style={styles.schoolName}>{identity.schoolName}</Text><Text style={styles.roles}>{identity.roles.join(', ') || 'Staff'}</Text></View>
            <TouchableOpacity style={styles.switchButton} disabled={!!switching} onPress={() => handleSwitch(identity.schoolId)}>
              {switching === identity.schoolId ? <ActivityIndicator color={colors.white} /> : <Text style={styles.switchText}>Open</Text>}
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  menu: { fontSize: 25, color: colors.primary },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textLight, marginTop: 3 },
  content: { padding: spacing.lg },
  enrollButton: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.lg, alignItems: 'center', ...shadows.sm },
  enrollText: { color: colors.white, fontWeight: '700' },
  loader: { marginTop: spacing.xl },
  empty: { alignItems: 'center', padding: spacing.xl },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  emptyText: { color: colors.textLight, textAlign: 'center', marginTop: spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  icon: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.infoLight, alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, marginHorizontal: spacing.md },
  schoolName: { fontSize: 15, fontWeight: '700', color: colors.text },
  roles: { fontSize: 12, color: colors.textLight, marginTop: 3 },
  switchButton: { backgroundColor: colors.success, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, minWidth: 58, alignItems: 'center' },
  switchText: { color: colors.white, fontWeight: '700' },
});
