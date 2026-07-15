import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Modal, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Props {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

interface TeachingAssignment {
  id: string;
  teacher?: { id: string; firstName: string; lastName: string; user?: { firstName: string; lastName: string } };
  subject?: { id: string; name: string };
  class?: { id: string; name: string };
  academicYear?: { id: string; name: string };
}

export const TeachingAssignmentsScreen: React.FC<Props> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classSubjects, setClassSubjects] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [teachingStaff, setTeachingStaff] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<TeachingAssignment | null>(null);
  const [form, setForm] = useState({ teacherId: '', classId: '', subjectId: '', academicYearId: '' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [assignmentsData, classesData, subjectsData, yearsData, staffData] = await Promise.all([
        apiService.getTeachingAssignments().catch(() => []),
        apiService.getClasses().catch(() => []),
        apiService.getSubjects().catch(() => []),
        apiService.getAcademicYears().catch(() => []),
        apiService.getSchoolTeachingStaff().catch(() => []),
      ]);
      setAssignments(Array.isArray(assignmentsData) ? assignmentsData : []);
      setClasses(Array.isArray(classesData) ? classesData : []);
      setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
      const years = Array.isArray(yearsData) ? yearsData : [];
      setAcademicYears(years);
      setTeachingStaff(Array.isArray(staffData) ? staffData : []);

      const currentYear = years.find((y: any) => y.isCurrent) || years[0];
      if (currentYear) {
        setForm(prev => ({ ...prev, academicYearId: currentYear.id }));
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, []);

  useEffect(() => {
    if (form.classId) {
      apiService.getClassSubjects(form.classId)
        .then((data: any) => setClassSubjects(Array.isArray(data) ? data : []))
        .catch(() => setClassSubjects([]));
    } else {
      setClassSubjects([]);
    }
  }, [form.classId]);

  const filtered = assignments.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const teacherName = `${a.teacher?.user?.firstName || a.teacher?.firstName || ''} ${a.teacher?.user?.lastName || a.teacher?.lastName || ''}`.toLowerCase();
    const subjectName = (a.subject?.name || '').toLowerCase();
    const className = (a.class?.name || '').toLowerCase();
    return teacherName.includes(q) || subjectName.includes(q) || className.includes(q);
  });

  const openCreate = () => {
    setEditingAssignment(null);
    setForm({ teacherId: '', classId: '', subjectId: '', academicYearId: academicYears.find((y: any) => y.isCurrent)?.id || '' });
    setShowModal(true);
  };

  const openEdit = (assignment: TeachingAssignment) => {
    setEditingAssignment(assignment);
    setForm({
      teacherId: assignment.teacher?.id || '',
      classId: assignment.class?.id || '',
      subjectId: assignment.subject?.id || '',
      academicYearId: assignment.academicYear?.id || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.teacherId || !form.classId || !form.subjectId || !form.academicYearId) {
      Alert.alert('Required', 'Please fill all fields.');
      return;
    }
    setSaving(true);
    try {
      if (editingAssignment?.id) {
        await apiService.deleteTeachingAssignment(editingAssignment.id);
      }
      await apiService.createTeachingAssignment(form);
      setShowModal(false);
      setEditingAssignment(null);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save assignment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Assignment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setDeletingId(id);
          try {
            await apiService.deleteTeachingAssignment(id);
            loadData();
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to delete');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const teacherName = (t: any) => {
    if (t.user) return `${t.user.firstName} ${t.user.lastName}`;
    return `${t.firstName || ''} ${t.lastName || ''}`;
  };

  const teacherInitials = (t: any) => {
    const first = t.user?.firstName?.[0] || t.firstName?.[0] || '?';
    const last = t.user?.lastName?.[0] || t.lastName?.[0] || '';
    return `${first}${last}`;
  };

  const totalSubjects = new Set(assignments.map(a => a.subject?.id)).size;
  const totalTeachers = new Set(assignments.map(a => a.teacher?.id)).size;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Teaching Assignments"
        subtitle={`${assignments.length} Assignments`}
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '➕', onPress: openCreate }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.infoLight }]}>
            <Text style={[styles.statValue, { color: colors.primaryLight }]}>{assignments.length}</Text>
            <Text style={styles.statLabel}>Assignments</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.statValue, { color: colors.success }]}>{totalTeachers}</Text>
            <Text style={styles.statLabel}>Teachers</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.warningLight }]}>
            <Text style={[styles.statValue, { color: colors.warning }]}>{totalSubjects}</Text>
            <Text style={styles.statLabel}>Subjects</Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by teacher, subject, class..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <WidgetCard title={`All Assignments (${filtered.length})`}>
          {loading ? (
            <View style={styles.centeredState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading assignments...</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📚</Text>
              <Text style={styles.emptyTitle}>No Assignments</Text>
              <Text style={styles.emptyText}>{searchQuery ? 'Try a different search' : 'Tap + to create an assignment'}</Text>
            </View>
          ) : (
            filtered.map((assignment) => (
              <View key={assignment.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.teacherAvatar}>
                    <Text style={styles.teacherAvatarText}>
                      {teacherInitials(assignment.teacher || {})}
                    </Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>
                      {teacherName(assignment.teacher || {})}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                      {assignment.subject?.name || 'Unknown Subject'} • {assignment.class?.name || 'Unknown Class'}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {assignment.academicYear?.name || ''}
                    </Text>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.editBtn}
                      activeOpacity={0.7}
                      onPress={() => openEdit(assignment)}
                    >
                      <Text style={styles.editBtnText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.deleteBtn, deletingId === assignment.id && styles.disabledBtn]}
                      activeOpacity={0.7}
                      onPress={() => handleDelete(assignment.id)}
                    >
                      {deletingId === assignment.id ? (
                        <ActivityIndicator size="small" color={colors.danger} />
                      ) : (
                        <Text style={styles.deleteBtnText}>🗑️</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </WidgetCard>
      </ScrollView>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editingAssignment ? 'Edit Assignment' : 'New Assignment'}</Text>

              <Text style={styles.fieldLabel}>Teacher *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                {teachingStaff.map((staff: any) => {
                  const isSelected = form.teacherId === staff.id;
                  return (
                    <TouchableOpacity
                      key={staff.id}
                      style={[styles.pill, isSelected && styles.pillSelected]}
                      activeOpacity={0.7}
                      onPress={() => setForm(prev => ({ ...prev, teacherId: staff.id }))}
                    >
                      <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                        {staff.user?.firstName || staff.firstName} {staff.user?.lastName || staff.lastName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.fieldLabel}>Class *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                {classes.map((cls: any) => {
                  const isSelected = form.classId === cls.id;
                  return (
                    <TouchableOpacity
                      key={cls.id}
                      style={[styles.pill, isSelected && styles.pillSelected]}
                      activeOpacity={0.7}
                      onPress={() => setForm(prev => ({ ...prev, classId: cls.id, subjectId: '' }))}
                    >
                      <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                        {cls.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.fieldLabel}>Subject *</Text>
              {!form.classId ? (
                <Text style={styles.fieldHint}>Select a class first</Text>
              ) : classSubjects.length === 0 ? (
                <Text style={styles.fieldHint}>No subjects assigned to this class</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                  {classSubjects.map((sub: any) => {
                    const isSelected = form.subjectId === sub.id;
                    return (
                      <TouchableOpacity
                        key={sub.id}
                        style={[styles.pill, isSelected && styles.pillSelected]}
                        activeOpacity={0.7}
                        onPress={() => setForm(prev => ({ ...prev, subjectId: sub.id }))}
                      >
                        <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                          {sub.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              <Text style={styles.fieldLabel}>Academic Year *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                {academicYears.map((year: any) => {
                  const isSelected = form.academicYearId === year.id;
                  return (
                    <TouchableOpacity
                      key={year.id}
                      style={[styles.pill, isSelected && styles.pillSelected]}
                      activeOpacity={0.7}
                      onPress={() => setForm(prev => ({ ...prev, academicYearId: year.id }))}
                    >
                      <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                        {year.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.cancelBtn}
                  onPress={() => setShowModal(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.saveBtn, saving && styles.disabledBtn]}
                  onPress={handleSave}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.saveBtnText}>{editingAssignment ? 'Update' : 'Create'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { flex: 1, padding: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 12, color: colors.textLight, marginTop: 4 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  searchIcon: { fontSize: 18, marginRight: spacing.sm },
  searchInput: { flex: 1, paddingVertical: spacing.md, fontSize: 15, color: colors.text },
  clearIcon: { fontSize: 16, color: colors.textMuted, paddingHorizontal: spacing.sm },
  centeredState: { alignItems: 'center', paddingVertical: spacing.xl * 2 },
  loadingText: { fontSize: 14, color: colors.textLight, marginTop: spacing.md },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl * 2 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  emptyText: { fontSize: 13, color: colors.textLight, textAlign: 'center' },
  card: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  teacherAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight + '20', justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  teacherAvatarText: { fontSize: 16, fontWeight: '700', color: colors.primaryLight },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  cardSubtitle: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: spacing.xs },
  editBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.infoLight, justifyContent: 'center', alignItems: 'center' },
  editBtnText: { fontSize: 14 },
  deleteBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.errorLight, justifyContent: 'center', alignItems: 'center' },
  deleteBtnText: { fontSize: 14 },
  disabledBtn: { opacity: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.md },
  fieldHint: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginBottom: spacing.sm },
  pickerScroll: { marginBottom: spacing.xs },
  pill: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.borderLight, marginRight: spacing.xs },
  pillSelected: { backgroundColor: colors.primaryLight },
  pillText: { fontSize: 13, color: colors.textLight },
  pillTextSelected: { color: colors.white, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, marginBottom: spacing.md },
  cancelBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.borderLight, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.textLight },
  saveBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.primaryLight, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: colors.white },
});
