import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
  Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';
import { useAuthStore, useAppStore } from '../../store';

type Tab = 'overview' | 'attendance' | 'results';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  gender?: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
}

export const PrimaryClassTeacherScreen: React.FC = () => {
  const { user } = useAuthStore();
  const { dashboard } = useAppStore();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [refreshing, setRefreshing] = useState(false);

  // Shared data
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Attendance state
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceStatuses, setAttendanceStatuses] = useState<Record<string, string>>({});
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Results state
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<any>(null);
  const [maxScore, setMaxScore] = useState('100');
  const [scores, setScores] = useState<Record<string, string>>({});
  const [submittingResults, setSubmittingResults] = useState(false);

  useEffect(() => { loadInitialData(); }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [clsRes, subjRes] = await Promise.allSettled([
        apiService.getTeacherClasses(),
        apiService.getSubjects(),
      ]);
      if (clsRes.status === 'fulfilled') {
        const d = clsRes.value?.data || clsRes.value;
        const list = Array.isArray(d) ? d : d?.classes || [];
        setClasses(list);
        if (list.length > 0) {
          setSelectedClass(list[0]);
          loadStudents(list[0].id || list[0]._id);
        }
      }
      if (subjRes.status === 'fulfilled') {
        const d = subjRes.value?.data || subjRes.value;
        setSubjects(Array.isArray(d) ? d : []);
      }
    } catch (e) { console.error('Failed to load initial data', e); }
    finally { setLoading(false); }
  };

  const loadStudents = async (classId: string) => {
    try {
      const res = await apiService.getStudents(classId);
      const data = Array.isArray(res) ? res : res?.data || res?.students || [];
      setStudents(data);
      const statuses: Record<string, string> = {};
      data.forEach((s: any) => { statuses[s.id] = 'PRESENT'; });
      setAttendanceStatuses(statuses);
      const initialScores: Record<string, string> = {};
      data.forEach((s: any) => { initialScores[s.id] = ''; });
      setScores(initialScores);
    } catch (e) { console.error('Failed to load students', e); }
  };

  const loadAssessments = async (classId: string, subjectId: string) => {
    try {
      const termId = dashboard?.currentTerm?.id;
      if (!termId) return;
      const res = await apiService.getAssessmentConfigurations(classId, subjectId, termId);
      const data = Array.isArray(res) ? res : res?.data || [];
      setAssessments(data);
      if (data.length > 0) setSelectedAssessment(data[0]);
    } catch (e) { console.error('Failed to load assessments', e); }
  };

  const handleClassChange = (cls: any) => {
    setSelectedClass(cls);
    loadStudents(cls.id || cls._id);
    setSelectedSubject(null);
    setSelectedAssessment(null);
  };

  const handleSubjectChange = (subj: any) => {
    setSelectedSubject(subj);
    if (selectedClass) loadAssessments(selectedClass.id || selectedClass._id, subj.id);
  };

  // Attendance
  const cycleStatus = (studentId: string) => {
    const cycle = ['PRESENT', 'LATE', 'EXCUSED', 'ABSENT'];
    const current = attendanceStatuses[studentId] || 'PRESENT';
    const idx = cycle.indexOf(current);
    setAttendanceStatuses(prev => ({ ...prev, [studentId]: cycle[(idx + 1) % cycle.length] }));
  };

  const markAllPresent = () => {
    const allPresent: Record<string, string> = {};
    students.forEach(s => { allPresent[s.id] = 'PRESENT'; });
    setAttendanceStatuses(allPresent);
  };

  const saveAttendance = async () => {
    if (!selectedClass) return;
    setSavingAttendance(true);
    try {
      const records = students.map(s => ({
        studentId: s.id,
        status: attendanceStatuses[s.id] || 'PRESENT',
      }));
      await apiService.submitBulkAttendance(
        selectedClass.id || selectedClass._id,
        attendanceDate,
        records,
      );
      Alert.alert('Done', 'Attendance saved successfully');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to save attendance');
    } finally { setSavingAttendance(false); }
  };

  const getAttendanceStats = () => {
    const values = Object.values(attendanceStatuses);
    return {
      total: values.length,
      present: values.filter(v => v === 'PRESENT').length,
      absent: values.filter(v => v === 'ABSENT').length,
      late: values.filter(v => v === 'LATE').length,
      excused: values.filter(v => v === 'EXCUSED').length,
    };
  };

  // Results
  const submitResults = async () => {
    if (!selectedClass || !selectedSubject || !selectedAssessment) {
      Alert.alert('Error', 'Select class, subject, and assessment');
      return;
    }
    const termId = dashboard?.currentTerm?.id;
    if (!termId) { Alert.alert('Error', 'No active term'); return; }
    setSubmittingResults(true);
    try {
      const scoresArray = Object.entries(scores)
        .filter(([, v]) => v.trim() !== '')
        .map(([studentId, rawScore]) => ({ studentId, rawScore: parseFloat(rawScore) }));
      await apiService.submitBulkAssessmentScores({
        classId: selectedClass.id || selectedClass._id,
        subjectId: selectedSubject.id,
        termId,
        assessmentDefId: selectedAssessment.id || selectedAssessment.assessmentDefId,
        maxScore: parseFloat(maxScore) || 100,
        scores: scoresArray,
      });
      Alert.alert('Done', 'Results submitted successfully');
      const reset: Record<string, string> = {};
      students.forEach(s => { reset[s.id] = ''; });
      setScores(reset);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to submit results');
    } finally { setSubmittingResults(false); }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  }, []);

  const attStats = getAttendanceStats();

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading classroom...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'attendance', label: 'Attendance', icon: '✅' },
    { key: 'results', label: 'Results', icon: '📝' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Primary Class Teacher</Text>
        <Text style={styles.headerSub}>{user?.firstName} {user?.lastName}</Text>
      </View>

      {/* Class Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classStrip}>
        {classes.map((cls: any) => (
          <TouchableOpacity
            key={cls.id || cls._id}
            style={[styles.classChip, selectedClass?.id === cls.id && styles.classChipActive]}
            onPress={() => handleClassChange(cls)}
          >
            <Text style={[styles.classChipText, selectedClass?.id === cls.id && styles.classChipTextActive]}>
              {cls.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {tabs.map(t => (
          <TouchableOpacity key={t.key} style={[styles.tab, activeTab === t.key && styles.tabActive]} onPress={() => setActiveTab(t.key)}>
            <Text style={styles.tabIcon}>{t.icon}</Text>
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: '#EEF2FF' }]}>
                <Text style={[styles.statValue, { color: '#4F46E5' }]}>{students.length}</Text>
                <Text style={styles.statLabel}>Pupils</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}>
                <Text style={[styles.statValue, { color: '#16A34A' }]}>{attStats.present}/{attStats.total}</Text>
                <Text style={styles.statLabel}>Present Today</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#FEFCE8' }]}>
                <Text style={[styles.statValue, { color: '#CA8A04' }]}>{dashboard?.currentTerm?.name || '—'}</Text>
                <Text style={styles.statLabel}>Current Term</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#FEF2F2' }]}>
                <Text style={[styles.statValue, { color: '#DC2626' }]}>{attStats.absent}</Text>
                <Text style={styles.statLabel}>Absent</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Pupils in {selectedClass?.name || 'Class'}</Text>
            {students.map((s) => (
              <View key={s.id} style={styles.studentRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{s.firstName[0]}{s.lastName[0]}</Text>
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{s.firstName} {s.lastName}</Text>
                  <Text style={styles.studentAdm}>{s.admissionNumber}</Text>
                </View>
                <View style={[styles.statusDot, {
                  backgroundColor: (attendanceStatuses[s.id] || 'PRESENT') === 'PRESENT' ? '#10B981' :
                    (attendanceStatuses[s.id] || 'PRESENT') === 'ABSENT' ? '#EF4444' :
                    (attendanceStatuses[s.id] || 'PRESENT') === 'LATE' ? '#F59E0B' : '#3B82F6',
                }]} />
              </View>
            ))}
          </>
        )}

        {/* ATTENDANCE TAB */}
        {activeTab === 'attendance' && (
          <>
            <View style={styles.attHeader}>
              <TextInput style={styles.dateInput} value={attendanceDate} onChangeText={setAttendanceDate} placeholder="YYYY-MM-DD" />
              <TouchableOpacity style={styles.markAllBtn} onPress={markAllPresent}>
                <Text style={styles.markAllText}>All Present</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveAttendance} disabled={savingAttendance}>
                <Text style={styles.saveText}>{savingAttendance ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.attStatsRow}>
              <View style={[styles.attStat, { backgroundColor: '#F0FDF4' }]}><Text style={[styles.attStatNum, { color: '#16A34A' }]}>{attStats.present}</Text><Text style={styles.attStatLabel}>Present</Text></View>
              <View style={[styles.attStat, { backgroundColor: '#FEF2F2' }]}><Text style={[styles.attStatNum, { color: '#DC2626' }]}>{attStats.absent}</Text><Text style={styles.attStatLabel}>Absent</Text></View>
              <View style={[styles.attStat, { backgroundColor: '#FEFCE8' }]}><Text style={[styles.attStatNum, { color: '#CA8A04' }]}>{attStats.late}</Text><Text style={styles.attStatLabel}>Late</Text></View>
              <View style={[styles.attStat, { backgroundColor: '#EFF6FF' }]}><Text style={[styles.attStatNum, { color: '#3B82F6' }]}>{attStats.excused}</Text><Text style={styles.attStatLabel}>Excused</Text></View>
            </View>

            {students.map((s) => {
              const status = attendanceStatuses[s.id] || 'PRESENT';
              const statusColors: Record<string, string> = {
                PRESENT: '#10B981', LATE: '#F59E0B', EXCUSED: '#3B82F6', ABSENT: '#EF4444',
              };
              const statusBg: Record<string, string> = {
                PRESENT: '#F0FDF4', LATE: '#FEFCE8', EXCUSED: '#EFF6FF', ABSENT: '#FEF2F2',
              };
              return (
                <TouchableOpacity key={s.id} style={styles.attRow} onPress={() => cycleStatus(s.id)}>
                  <View style={[styles.attAvatar, { backgroundColor: statusBg[status] }]}>
                    <Text style={[styles.attAvatarText, { color: statusColors[status] }]}>
                      {s.firstName[0]}{s.lastName[0]}
                    </Text>
                  </View>
                  <View style={styles.attInfo}>
                    <Text style={styles.attName}>{s.firstName} {s.lastName}</Text>
                    <Text style={styles.attAdm}>{s.admissionNumber}</Text>
                  </View>
                  <View style={[styles.attBadge, { backgroundColor: statusBg[status] }]}>
                    <Text style={[styles.attBadgeText, { color: statusColors[status] }]}>{status}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* RESULTS TAB */}
        {activeTab === 'results' && (
          <>
            <View style={styles.resultSelectors}>
              <Text style={styles.selectorLabel}>Subject</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorRow}>
                {subjects.map((subj: any) => (
                  <TouchableOpacity
                    key={subj.id}
                    style={[styles.selectorChip, selectedSubject?.id === subj.id && styles.selectorChipActive]}
                    onPress={() => handleSubjectChange(subj)}
                  >
                    <Text style={[styles.selectorChipText, selectedSubject?.id === subj.id && styles.selectorChipTextActive]}>{subj.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {selectedSubject && (
              <>
                <View style={styles.resultSelectors}>
                  <Text style={styles.selectorLabel}>Assessment</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorRow}>
                    {assessments.map((a: any) => (
                      <TouchableOpacity
                        key={a.id || a.assessmentDefId}
                        style={[styles.selectorChip, selectedAssessment?.id === a.id && styles.selectorChipActive]}
                        onPress={() => setSelectedAssessment(a)}
                      >
                        <Text style={[styles.selectorChipText, selectedAssessment?.id === a.id && styles.selectorChipTextActive]}>{a.name || a.assessmentDef?.name || a.code}</Text>
                      </TouchableOpacity>
                    ))}
                    {assessments.length === 0 && <Text style={styles.noDataText}>No assessments configured for this subject</Text>}
                  </ScrollView>
                </View>

                <View style={styles.maxScoreRow}>
                  <Text style={styles.selectorLabel}>Max Score</Text>
                  <TextInput style={styles.maxScoreInput} value={maxScore} onChangeText={setMaxScore} keyboardType="numeric" />
                </View>
              </>
            )}

            {selectedSubject && students.map((s) => (
              <View key={s.id} style={styles.scoreRow}>
                <View style={styles.scoreInfo}>
                  <Text style={styles.scoreName}>{s.firstName} {s.lastName}</Text>
                  <Text style={styles.scoreAdm}>{s.admissionNumber}</Text>
                </View>
                <TextInput
                  style={styles.scoreInput}
                  value={scores[s.id] || ''}
                  onChangeText={(v) => setScores(prev => ({ ...prev, [s.id]: v }))}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor="#D1D5DB"
                />
              </View>
            ))}

            {selectedSubject && (
              <TouchableOpacity style={styles.submitBtn} onPress={submitResults} disabled={submittingResults}>
                <Text style={styles.submitText}>{submittingResults ? 'Submitting...' : `Submit ${Object.values(scores).filter(v => v.trim()).length} Scores`}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: colors.textLight },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  headerSub: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  classStrip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, maxHeight: 48 },
  classChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.white, marginRight: 8, borderWidth: 1, borderColor: colors.border },
  classChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  classChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  classChipTextActive: { color: colors.white },
  tabRow: { flexDirection: 'row', marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: 3 },
  tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10, borderRadius: borderRadius.md, gap: 6 },
  tabActive: { backgroundColor: colors.primary },
  tabIcon: { fontSize: 16 },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textLight },
  tabTextActive: { color: colors.white },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 40 },
  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  statCard: { padding: 14, borderRadius: borderRadius.lg, flex: 1, minWidth: '45%', alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 10, marginTop: 4 },
  studentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, padding: 12, borderRadius: borderRadius.md, marginBottom: 6, borderWidth: 1, borderColor: '#F3F4F6' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 14, fontWeight: '600', color: colors.text },
  studentAdm: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  attHeader: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  dateInput: { flex: 1, backgroundColor: colors.white, borderRadius: borderRadius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, borderWidth: 1, borderColor: colors.border },
  markAllBtn: { backgroundColor: '#16A34A', paddingHorizontal: 14, paddingVertical: 10, borderRadius: borderRadius.md, justifyContent: 'center' },
  markAllText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  saveBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: borderRadius.md, justifyContent: 'center' },
  saveText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  attStatsRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  attStat: { flex: 1, paddingVertical: 10, borderRadius: borderRadius.md, alignItems: 'center' },
  attStatNum: { fontSize: 18, fontWeight: '700' },
  attStatLabel: { fontSize: 10, fontWeight: '600', color: '#6B7280', marginTop: 2 },
  attRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, padding: 10, borderRadius: borderRadius.md, marginBottom: 5, borderWidth: 1, borderColor: '#F3F4F6' },
  attAvatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  attAvatarText: { fontSize: 11, fontWeight: '700' },
  attInfo: { flex: 1 },
  attName: { fontSize: 13, fontWeight: '600', color: colors.text },
  attAdm: { fontSize: 11, color: colors.textLight, marginTop: 1 },
  attBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.sm },
  attBadgeText: { fontSize: 11, fontWeight: '700' },
  resultSelectors: { marginBottom: 12 },
  selectorLabel: { fontSize: 12, fontWeight: '600', color: colors.textLight, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  selectorRow: { flexDirection: 'row', maxHeight: 38 },
  selectorChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.white, marginRight: 6, borderWidth: 1, borderColor: colors.border },
  selectorChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  selectorChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
  selectorChipTextActive: { color: colors.white },
  maxScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  maxScoreInput: { backgroundColor: colors.white, borderRadius: borderRadius.md, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, borderWidth: 1, borderColor: colors.border, width: 80, textAlign: 'center' },
  noDataText: { fontSize: 12, color: colors.textMuted, paddingVertical: 8 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, padding: 10, borderRadius: borderRadius.md, marginBottom: 5, borderWidth: 1, borderColor: '#F3F4F6' },
  scoreInfo: { flex: 1 },
  scoreName: { fontSize: 13, fontWeight: '600', color: colors.text },
  scoreAdm: { fontSize: 11, color: colors.textLight, marginTop: 1 },
  scoreInput: { backgroundColor: '#F9FAFB', borderRadius: borderRadius.md, paddingHorizontal: 12, paddingVertical: 6, fontSize: 15, fontWeight: '600', borderWidth: 1, borderColor: colors.border, width: 64, textAlign: 'center' },
  submitBtn: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: borderRadius.lg, alignItems: 'center', marginTop: 16 },
  submitText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
