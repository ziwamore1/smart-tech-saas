import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiService } from '../../services/api';
import { colors, spacing, borderRadius } from '../../theme';

const ROLES = ['Director', 'Head Teacher', 'Teacher', 'Class Teacher', 'HOD', 'Accountant', 'Secretary', 'Deputy'];

export const SuperAdminEnrollStaffScreen: React.FC<any> = ({ onToggleDrawer }) => {
  const [schools, setSchools] = useState<any[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [role, setRole] = useState('Director');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiService.getSuperAdminSchools({ limit: 100 }).then((result: any) => {
      const payload = result?.data || result;
      setSchools((Array.isArray(payload) ? payload : payload?.schools || []).filter((school: any) => school.isActive !== false));
    }).catch(() => Alert.alert('Unable to load schools', 'Please try again.')).finally(() => setLoading(false));
  }, []);

  const enroll = async () => {
    if (!schoolId) return Alert.alert('Select a school', 'Choose a school before enrolling.');
    setSaving(true);
    try {
      const result = await apiService.enrollSelfAsStaff(schoolId, role);
      Alert.alert('Enrolled', result?.message || 'You are now linked to the school.');
      setSchoolId('');
    } catch (error: any) {
      Alert.alert('Enrollment failed', error?.response?.data?.message || 'Please try again.');
    } finally { setSaving(false); }
  };

  return <View style={styles.container}>
    <View style={styles.header}>{onToggleDrawer && <TouchableOpacity onPress={onToggleDrawer}><Text style={styles.menu}>☰</Text></TouchableOpacity>}<Text style={styles.title}>Enroll as Staff</Text></View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.label}>School</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : schools.map((school) => <TouchableOpacity key={school.id} style={[styles.option, schoolId === school.id && styles.selected]} onPress={() => setSchoolId(school.id)}><Text style={styles.optionText}>{school.name}</Text><Text>{schoolId === school.id ? '✓' : ''}</Text></TouchableOpacity>)}
      <Text style={styles.label}>Role</Text>
      <View style={styles.roles}>{ROLES.map((item) => <TouchableOpacity key={item} style={[styles.role, role === item && styles.selected]} onPress={() => setRole(item)}><Text style={styles.optionText}>{item}</Text></TouchableOpacity>)}</View>
      <TouchableOpacity style={[styles.button, (!schoolId || saving) && styles.disabled]} disabled={!schoolId || saving} onPress={enroll}>{saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Enroll as Staff</Text>}</TouchableOpacity>
    </ScrollView>
  </View>;
};

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.background }, header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border }, menu: { fontSize: 25, color: colors.primary }, title: { fontSize: 22, fontWeight: '700', color: colors.text }, content: { padding: spacing.lg }, label: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm }, option: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md, backgroundColor: colors.white, borderRadius: borderRadius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border }, selected: { borderColor: colors.primary, backgroundColor: colors.infoLight }, optionText: { color: colors.text, fontSize: 14 }, roles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, role: { padding: spacing.sm, backgroundColor: colors.white, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border }, button: { marginTop: spacing.xl, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.primary, alignItems: 'center' }, disabled: { opacity: 0.5 }, buttonText: { color: colors.white, fontWeight: '700' } });
