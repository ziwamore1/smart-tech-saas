import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';
import { useAuthStore } from '../../store';

interface Props { onToggleDrawer?: () => void; }

export const ClassTeacherResultsDeliveryScreen: React.FC<Props> = ({ onToggleDrawer }) => {
  const { user } = useAuthStore();
  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [termId, setTermId] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const [classResponse, termResponse, assignmentResponse] = await Promise.all([apiService.getClasses(), apiService.getAllTerms(), user?.id ? apiService.getTeacherClassAssignment(user.id).catch(() => null) : Promise.resolve(null)]);
      const nextClasses = classResponse?.classes || classResponse || [];
      const nextTerms = termResponse?.terms || termResponse || [];
      setClasses(Array.isArray(nextClasses) ? nextClasses : []);
      setTerms(Array.isArray(nextTerms) ? nextTerms : []);
      const assignment = assignmentResponse?.data || assignmentResponse;
      const assignedId = assignment?.classId || assignment?.class?.id || (Array.isArray(assignment) ? assignment[0]?.classId : undefined);
      const assigned = (Array.isArray(nextClasses) ? nextClasses : []).find((item: any) => item.id === assignedId);
      const current = (Array.isArray(nextTerms) ? nextTerms : []).find((item: any) => item.isCurrent);
      if (assigned?.id) setClassId(assigned.id);
      if (current?.id) setTermId(current.id);
    } catch { Alert.alert('Unable to load', 'Please check your connection and try again.'); }
  }, []);

  const loadPreview = useCallback(async () => {
    if (!classId || !termId) return;
    setLoading(true);
    try { setPreview(await apiService.getResultsSmsPreview(classId, termId)); } catch { setPreview(null); Alert.alert('Unable to load records', 'The class delivery records could not be loaded.'); } finally { setLoading(false); }
  }, [classId, termId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadPreview(); }, [loadPreview]);

  const students = Array.from(new Map((preview?.recipients || []).map((row: any) => [row.studentId, row])).values()) as any[];
  const ready = students.filter((row: any) => !row.alreadySent && row.phoneStatus === 'VALID');
  const sent = students.filter((row: any) => row.alreadySent);
  const blocked = students.filter((row: any) => !row.alreadySent && row.phoneStatus !== 'VALID');
  const send = async (studentIds?: string[]) => {
    try { setSending(true); await apiService.sendResultsSms({ classId, termId, studentIds: studentIds || ready.map(row => row.studentId) }); Alert.alert('Results queued', 'The permanent delivery record will update as each parent is processed.'); setSelected([]); loadPreview(); } catch (error: any) { Alert.alert('Not sent', error?.response?.data?.message || 'Resolve the listed problem before sending.'); } finally { setSending(false); }
  };

  return <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
    <HeaderBar title="Class Result Delivery" subtitle="Parent delivery ownership" leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }} rightIcon={{ name: '🔄', onPress: loadPreview }} />
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.instruction}>Sent records are permanent for each result version. Do not resend a student marked Sent.</Text>
      <WidgetCard title="Class and term">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>{classes.map(item => <TouchableOpacity key={item.id} onPress={() => setClassId(item.id)} style={[styles.pill, classId === item.id && styles.pillActive]}><Text style={classId === item.id ? styles.pillTextActive : styles.pillText}>{item.name}</Text></TouchableOpacity>)}</ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>{terms.map(item => <TouchableOpacity key={item.id} onPress={() => setTermId(item.id)} style={[styles.pill, termId === item.id && styles.pillActive]}><Text style={termId === item.id ? styles.pillTextActive : styles.pillText}>{item.name}</Text></TouchableOpacity>)}</ScrollView>
      </WidgetCard>
      <View style={styles.stats}><Stat label="Students" value={students.length} /><Stat label="Sent" value={sent.length} color={colors.success} /><Stat label="Blocked" value={blocked.length} color={colors.error} /><Stat label="Ready" value={ready.length} color={colors.primary} /></View>
      {loading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} /> : <WidgetCard title="Delivery checklist">{students.map(row => { const problem = row.phoneStatus !== 'VALID'; const isSelected = selected.includes(row.studentId); return <View key={row.studentId} style={[styles.studentRow, row.alreadySent && styles.sentRow, problem && styles.blockedRow]}><TouchableOpacity disabled={row.alreadySent || problem} onPress={() => setSelected(current => isSelected ? current.filter(id => id !== row.studentId) : [...current, row.studentId])}><Text style={styles.check}>{row.alreadySent ? '✓' : isSelected ? '☑' : problem ? '!' : '□'}</Text></TouchableOpacity><View style={styles.studentInfo}><Text style={styles.studentName}>{row.studentName}</Text><Text style={styles.studentDetail}>{row.alreadySent ? 'Sent and protected from duplicate sends' : problem ? (row.errorSuggestion || 'Add or correct the parent phone number in My Class.') : 'Ready to send'}</Text>{problem && <TouchableOpacity onPress={() => Alert.alert('Action required', row.errorSuggestion || 'Open Students > Parent contact, update the number, save, then refresh this screen.')}><Text style={styles.action}>How to fix this →</Text></TouchableOpacity>}</View><Text style={[styles.badge, { color: row.alreadySent ? colors.success : problem ? colors.error : colors.primary }]}>{row.alreadySent ? 'SENT' : problem ? 'BLOCKED' : 'READY'}</Text></View>; })}{!students.length && <Text style={styles.empty}>Choose a class and term to load delivery records.</Text>}</WidgetCard>}
      <TouchableOpacity disabled={sending || !ready.length} onPress={() => send()} style={[styles.sendButton, (!ready.length || sending) && styles.disabled]}><Text style={styles.sendText}>{sending ? 'Queuing...' : `Send unresolved valid results (${ready.length})`}</Text></TouchableOpacity>
      {selected.length > 0 && <TouchableOpacity disabled={sending} onPress={() => send(selected)} style={styles.selectedButton}><Text style={styles.sendText}>Send selected ({selected.length})</Text></TouchableOpacity>}
    </ScrollView>
  </SafeAreaView>;
};

const Stat = ({ label, value, color = colors.text }: any) => <View style={styles.stat}><Text style={[styles.statValue, { color }]}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, scroll: { padding: spacing.md, paddingBottom: spacing.xxl }, instruction: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: spacing.md }, stats: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }, stat: { flex: 1, backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.sm, alignItems: 'center', ...shadows.sm }, statValue: { fontSize: 21, fontWeight: '800' }, statLabel: { fontSize: 10, color: colors.textLight, marginTop: 2 }, pill: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.background, borderRadius: borderRadius.full, marginRight: spacing.sm }, pillActive: { backgroundColor: colors.primary }, pillText: { color: colors.textSecondary, fontSize: 13 }, pillTextActive: { color: colors.white, fontSize: 13, fontWeight: '700' }, studentRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }, sentRow: { backgroundColor: '#F0FDF4' }, blockedRow: { backgroundColor: '#FFF7F7' }, check: { width: 28, fontSize: 22, color: colors.primary }, studentInfo: { flex: 1 }, studentName: { fontSize: 14, fontWeight: '700', color: colors.text }, studentDetail: { fontSize: 12, color: colors.textLight, marginTop: 3, lineHeight: 17 }, action: { color: colors.primary, fontSize: 12, fontWeight: '700', marginTop: 4 }, badge: { fontSize: 10, fontWeight: '800' }, empty: { color: colors.textLight, textAlign: 'center', paddingVertical: spacing.xl }, sendButton: { backgroundColor: colors.primary, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.md }, selectedButton: { backgroundColor: colors.success, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm }, disabled: { opacity: 0.45 }, sendText: { color: colors.white, fontWeight: '700' },
});
