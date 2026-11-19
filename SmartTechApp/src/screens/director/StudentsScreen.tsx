import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAuthStore } from '../../store';
import { apiService } from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface DirectorStudentsProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

export const DirectorStudentsScreen: React.FC<DirectorStudentsProps> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user } = useAuthStore();
  const isPrimary = user?.institutionType === 'PRIMARY_SCHOOL';
  const [students, setStudents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [intakeFilter, setIntakeFilter] = useState<'all' | 'pre-school' | 'grade1' | 'transfers'>('all');
  const [statusStudent, setStatusStudent] = useState<any>(null);
  const [changingStatus, setChangingStatus] = useState(false);

  const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'TRANSFERRED', 'GRADUATED', 'WITHDRAWN', 'SUSPENDED'];

  const intakeTabs = [
    { key: 'all' as const, label: 'All Pupils', icon: '👨‍🎓' },
    { key: 'pre-school' as const, label: 'Pre-School', icon: '👶' },
    { key: 'grade1' as const, label: 'Grade 1 Intake', icon: '📝' },
    { key: 'transfers' as const, label: 'Transfers', icon: '🔄' },
  ];

  const loadStudents = async () => {
    try {
      const data = await apiService.getStudents();
      setStudents(data || []);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadStudents(); }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadStudents();
  };

  const applyStatusChange = async (status: string) => {
    if (!statusStudent) return;
    setChangingStatus(true);
    try {
      await apiService.changeStudentStatus(statusStudent.id, status);
      setStudents(prev => prev.map(s => s.id === statusStudent.id ? { ...s, status, isActive: status === 'ACTIVE' } : s));
      setStatusStudent(null);
    } catch (err: any) {
      console.error('Failed to change student status:', err);
    } finally {
      setChangingStatus(false);
    }
  };

  const filtered = students.filter((s) => {
    const matchesSearch = searchQuery === '' ||
      s.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.class && s.class.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.admissionNumber && s.admissionNumber.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (!isPrimary || intakeFilter === 'all') return true;

    const studentClass = (s.class || '').toLowerCase();
    if (intakeFilter === 'pre-school') return studentClass.includes('pre') || studentClass.includes('ece') || studentClass.includes('nursery') || studentClass.includes('reception');
    if (intakeFilter === 'grade1') return studentClass.includes('grade 1') || studentClass === '1';
    if (intakeFilter === 'transfers') return s.isTransfer === true;
    return true;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Students"
        subtitle={`${students.length} Total Students`}
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search students..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {isPrimary && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.intakeTabsRow}>
            {intakeTabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.intakeTab, intakeFilter === tab.key && styles.intakeTabActive]}
                onPress={() => setIntakeFilter(tab.key)}
              >
                <Text style={styles.intakeTabIcon}>{tab.icon}</Text>
                <Text style={[styles.intakeTabLabel, intakeFilter === tab.key && styles.intakeTabLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <WidgetCard title={isPrimary ? `${intakeFilter === 'all' ? 'All Pupils' : intakeFilter === 'pre-school' ? 'Pre-School' : intakeFilter === 'grade1' ? 'Grade 1 Intake' : 'Transfers'} (${filtered.length})` : `All Students (${filtered.length})`}>
          {filtered.map((student) => (
            <View key={student.id} style={styles.studentCard}>
              <View style={styles.studentAvatar}>
                <Text style={styles.studentAvatarText}>{student.firstName.charAt(0)}{student.lastName.charAt(0)}</Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{student.firstName} {student.lastName}</Text>
                <Text style={styles.studentClass}>{student.class}{student.admissionNumber ? ` • ${student.admissionNumber}` : ''}</Text>
              </View>
              <TouchableOpacity
                style={styles.statusPill}
                onPress={() => setStatusStudent(student)}
                disabled={changingStatus}
              >
                <Text style={styles.statusPillText}>{student.status || (student.isActive ? 'ACTIVE' : 'INACTIVE')}</Text>
              </TouchableOpacity>
            </View>
          ))}
          {filtered.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>👨‍🎓</Text>
              <Text style={styles.emptyText}>No students found</Text>
            </View>
          )}
        </WidgetCard>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <Modal visible={!!statusStudent} transparent animationType="fade" onRequestClose={() => !changingStatus && setStatusStudent(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Student Status</Text>
            <Text style={styles.modalSubtitle}>{statusStudent ? `${statusStudent.firstName} ${statusStudent.lastName}` : ''}</Text>
            {changingStatus && <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.sm }} />}
            {STATUS_OPTIONS.map(option => (
              <TouchableOpacity
                key={option}
                style={styles.statusOption}
                onPress={() => applyStatusChange(option)}
                disabled={changingStatus}
              >
                <Text style={styles.statusOptionText}>{option}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setStatusStudent(null)} disabled={changingStatus}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  searchIcon: { fontSize: 18, marginRight: spacing.sm },
  searchInput: { flex: 1, paddingVertical: spacing.md, fontSize: 15, color: colors.text },
  intakeTabsRow: { marginBottom: spacing.md },
  intakeTab: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.white, borderRadius: borderRadius.lg, marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border },
  intakeTabActive: { backgroundColor: colors.infoLight, borderColor: colors.primary },
  intakeTabIcon: { fontSize: 14, marginRight: spacing.xs },
  intakeTabLabel: { fontSize: 13, color: colors.text, fontWeight: '500' },
  intakeTabLabelActive: { color: colors.primary, fontWeight: '700' },
  studentCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  studentAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  studentAvatarText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '600', color: colors.text },
  studentClass: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full, backgroundColor: colors.success + '20', marginLeft: spacing.sm },
  statusPillText: { fontSize: 10, fontWeight: '700', color: colors.success },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  modalCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: colors.textLight, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.md },
  statusOption: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.background, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border },
  statusOptionText: { fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'center' },
  modalCancel: { paddingVertical: spacing.sm, alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: colors.textLight },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textLight },
});
