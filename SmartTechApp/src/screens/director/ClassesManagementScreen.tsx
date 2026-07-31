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

interface ClassItem {
  id: string;
  name: string;
  section?: string;
  capacity?: number;
  studentCount?: number;
  classTeacher?: { id: string; firstName: string; lastName: string } | null;
  teachers?: { id: string; firstName: string; lastName: string }[];
  subjects?: { id: string; name: string }[];
}

interface TeacherItem {
  id: string;
  firstName: string;
  lastName: string;
  roles?: string[];
}

export const ClassesManagementScreen: React.FC<Props> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [staff, setStaff] = useState<TeacherItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [form, setForm] = useState({ name: '', section: '', capacity: '' });
  const [saving, setSaving] = useState(false);

  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [assigningClassId, setAssigningClassId] = useState<string | null>(null);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [assigningTeacher, setAssigningTeacher] = useState<string | null>(null);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailClass, setDetailClass] = useState<ClassItem | null>(null);
  const [detailEnrollments, setDetailEnrollments] = useState<any[]>([]);
  const [detailSubjects, setDetailSubjects] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [addingSubject, setAddingSubject] = useState(false);
  const [removingSubjectId, setRemovingSubjectId] = useState<string | null>(null);
  const [removingEnrollmentId, setRemovingEnrollmentId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [classesData, staffData] = await Promise.all([
        apiService.getClasses(),
        apiService.getStaff(),
      ]);
      setClasses(classesData || []);
      setStaff(staffData || []);
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

  const totalStudents = classes.reduce((sum, c) => sum + (c.studentCount || 0), 0);
  const classesWithTeacher = classes.filter((c) => c.classTeacher).length;

  const filtered = classes.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.section || '').toLowerCase().includes(q) ||
      (c.classTeacher?.firstName || '').toLowerCase().includes(q) ||
      (c.classTeacher?.lastName || '').toLowerCase().includes(q)
    );
  });

  const openCreate = () => {
    setEditingClass(null);
    setForm({ name: '', section: '', capacity: '' });
    setShowFormModal(true);
  };

  const openEdit = (cls: ClassItem) => {
    setEditingClass(cls);
    setForm({
      name: cls.name || '',
      section: cls.section || '',
      capacity: cls.capacity ? String(cls.capacity) : '',
    });
    setShowFormModal(true);
  };

  const handleSaveClass = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Class name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        section: form.section.trim() || undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
      };
      if (editingClass) {
        await apiService.updateClass(editingClass.id, payload);
        Alert.alert('Success', 'Class updated');
      } else {
        await apiService.createClass(payload);
        Alert.alert('Success', 'Class created');
      }
      setShowFormModal(false);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save class');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClass = (cls: ClassItem) => {
    Alert.alert(
      'Delete Class',
      `Delete "${cls.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(cls.id);
            try {
              await apiService.deleteClass(cls.id);
              loadData();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to delete class');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const openTeacherPicker = (cls: ClassItem) => {
    setAssigningClassId(cls.id);
    setTeacherSearchQuery('');
    setShowTeacherModal(true);
  };

  const handleAssignTeacher = async (teacher: TeacherItem) => {
    if (!assigningClassId) return;
    setAssigningTeacher(teacher.id);
    try {
      await apiService.setClassTeacher(assigningClassId, teacher.id);
      Alert.alert('Success', `${teacher.firstName} ${teacher.lastName} assigned as class teacher`);
      setShowTeacherModal(false);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to assign teacher');
    } finally {
      setAssigningTeacher(null);
    }
  };

  const handleRemoveTeacher = (cls: ClassItem) => {
    if (!cls.classTeacher) return;
    Alert.alert(
      'Remove Class Teacher',
      `Remove ${cls.classTeacher.firstName} ${cls.classTeacher.lastName} as class teacher for "${cls.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.setClassTeacher(cls.id, null);
              loadData();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to remove teacher');
            }
          },
        },
      ]
    );
  };

  const openClassDetails = async (cls: ClassItem) => {
    setDetailClass(cls);
    setShowDetailModal(true);
    setDetailLoading(true);
    setDetailEnrollments([]);
    setDetailSubjects([]);
    setSelectedSubjectId('');
    try {
      const [enrollments, subjects, allSubjectsData] = await Promise.all([
        apiService.getEnrollmentsByClass(cls.id).catch(() => []),
        apiService.getClassSubjects(cls.id).catch(() => []),
        apiService.getSubjects().catch(() => []),
      ]);
      setDetailEnrollments(enrollments || []);
      setDetailSubjects(subjects || []);
      setAllSubjects(allSubjectsData || []);
    } catch {
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredTeachers = staff.filter((s) => {
    const isTeacher = s.roles?.some((r) =>
      r.toLowerCase().includes('teacher') || r.toLowerCase().includes('class teacher')
    );
    if (!isTeacher) return false;
    if (!teacherSearchQuery) return true;
    const q = teacherSearchQuery.toLowerCase();
    return (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q)
    );
  });

  const handleAddSubject = async () => {
    if (!detailClass || !selectedSubjectId) return;
    setAddingSubject(true);
    try {
      await apiService.addClassSubject(detailClass.id, selectedSubjectId);
      setSelectedSubjectId('');
      const updated = await apiService.getClassSubjects(detailClass.id).catch(() => []);
      setDetailSubjects(updated || []);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to add subject');
    } finally {
      setAddingSubject(false);
    }
  };

  const handleRemoveSubject = async (subjectId: string) => {
    if (!detailClass) return;
    setRemovingSubjectId(subjectId);
    try {
      await apiService.removeClassSubject(detailClass.id, subjectId);
      const updated = await apiService.getClassSubjects(detailClass.id).catch(() => []);
      setDetailSubjects(updated || []);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to remove subject');
    } finally {
      setRemovingSubjectId(null);
    }
  };

  const handleRemoveEnrollment = async (enr: any) => {
    if (!detailClass || removingEnrollmentId) return;
    const studentName = `${enr.student?.firstName || enr.firstName || ''} ${enr.student?.lastName || enr.lastName || ''}`.trim();
    Alert.alert(
      'Remove from Class',
      `Remove ${studentName || 'this student'} from ${detailClass.name}? The class register will be re-sequenced automatically.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingEnrollmentId(enr.id);
            try {
              await apiService.removeFromClass(enr.id);
              setDetailEnrollments(prev => prev.filter(e => e.id !== enr.id));
              Alert.alert('Removed', 'Student removed from class. Register re-sequenced automatically.');
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'Failed to remove student from class.');
            } finally {
              setRemovingEnrollmentId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Classes Management"
        subtitle={`${classes.length} Classes`}
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
            <Text style={[styles.statValue, { color: colors.primaryLight }]}>{classes.length}</Text>
            <Text style={styles.statLabel}>Total Classes</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.statValue, { color: colors.success }]}>{totalStudents}</Text>
            <Text style={styles.statLabel}>Total Students</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.purpleLight }]}>
            <Text style={[styles.statValue, { color: colors.purple }]}>{classesWithTeacher}</Text>
            <Text style={styles.statLabel}>With Teacher</Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search classes, sections, teachers..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <WidgetCard title={`All Classes (${filtered.length})`}>
          {loading ? (
            <View style={styles.centeredState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading classes...</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🏫</Text>
              <Text style={styles.emptyTitle}>No Classes Found</Text>
              <Text style={styles.emptyText}>{searchQuery ? 'Try a different search term' : 'Tap + to create your first class'}</Text>
            </View>
          ) : (
            filtered.map((cls) => (
              <TouchableOpacity key={cls.id} style={styles.classCard} onPress={() => openClassDetails(cls)} activeOpacity={0.7}>
                <View style={[styles.classIcon, { backgroundColor: cls.classTeacher ? colors.successLight : colors.infoLight }]}>
                  <Text style={styles.classIconText}>🏫</Text>
                </View>
                <View style={styles.classInfo}>
                  <View style={styles.classNameRow}>
                    <Text style={styles.className}>{cls.name}</Text>
                    {cls.section ? <Text style={styles.sectionBadge}>{cls.section}</Text> : null}
                  </View>
                  <Text style={styles.classTeacherName}>
                    {cls.classTeacher
                      ? `${cls.classTeacher.firstName} ${cls.classTeacher.lastName}`
                      : 'No class teacher'}
                  </Text>
                  {cls.capacity ? (
                    <Text style={styles.classCapacity}>Capacity: {cls.studentCount || 0}/{cls.capacity}</Text>
                  ) : null}
                </View>
                <View style={styles.classRight}>
                  <Text style={styles.studentCount}>{cls.studentCount || 0}</Text>
                  <Text style={styles.studentLabel}>students</Text>
                </View>
                <View style={styles.classActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.teacherBtn]}
                    onPress={(e) => { e.stopPropagation(); openTeacherPicker(cls); }}
                  >
                    <Text style={styles.teacherBtnText}>👤</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.editBtn]}
                    onPress={(e) => { e.stopPropagation(); openEdit(cls); }}
                  >
                    <Text style={styles.editBtnText}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteActionBtn, deletingId === cls.id && styles.btnDisabled]}
                    onPress={(e) => { e.stopPropagation(); handleDeleteClass(cls); }}
                    disabled={deletingId === cls.id}
                  >
                    {deletingId === cls.id ? (
                      <ActivityIndicator size="small" color={colors.error} />
                    ) : (
                      <Text style={styles.deleteActionText}>🗑️</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </WidgetCard>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* Create / Edit Class Modal */}
      <Modal visible={showFormModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editingClass ? 'Edit Class' : 'Create New Class'}</Text>

              <Text style={styles.inputLabel}>Class Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Grade 7, Form 3"
                value={form.name}
                onChangeText={(t) => setForm({ ...form, name: t })}
                editable={!saving}
              />

              <Text style={styles.inputLabel}>Section</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Blue, A"
                value={form.section}
                onChangeText={(t) => setForm({ ...form, section: t })}
                editable={!saving}
              />

              <Text style={styles.inputLabel}>Capacity</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 45"
                value={form.capacity}
                onChangeText={(t) => setForm({ ...form, capacity: t.replace(/[^0-9]/g, '') })}
                keyboardType="numeric"
                editable={!saving}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.cancelBtn, saving && styles.btnDisabled]}
                  onPress={() => setShowFormModal(false)}
                  disabled={saving}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.saveBtn, saving && styles.savingBtn]}
                  onPress={handleSaveClass}
                  disabled={saving}
                >
                  {saving ? (
                    <View style={styles.savingRow}>
                      <ActivityIndicator size="small" color={colors.white} />
                      <Text style={styles.saveBtnText}>  Saving...</Text>
                    </View>
                  ) : (
                    <Text style={styles.saveBtnText}>{editingClass ? 'Update' : 'Create'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Assign Teacher Modal */}
      <Modal visible={showTeacherModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assign Class Teacher</Text>

            <View style={styles.teacherSearchContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search teachers..."
                value={teacherSearchQuery}
                onChangeText={setTeacherSearchQuery}
              />
            </View>

            <ScrollView style={styles.teacherList} showsVerticalScrollIndicator={false}>
              {filteredTeachers.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>👤</Text>
                  <Text style={styles.emptyText}>No teachers found</Text>
                </View>
              ) : (
                filteredTeachers.map((teacher) => {
                  const currentClass = classes.find((c) => c.classTeacher?.id === teacher.id);
                  return (
                    <TouchableOpacity
                      key={teacher.id}
                      style={[styles.teacherItem, assigningTeacher === teacher.id && styles.teacherItemActive]}
                      onPress={() => handleAssignTeacher(teacher)}
                      disabled={assigningTeacher !== null}
                    >
                      <View style={styles.teacherAvatar}>
                        <Text style={styles.teacherAvatarText}>{teacher.firstName.charAt(0)}{teacher.lastName.charAt(0)}</Text>
                      </View>
                      <View style={styles.teacherInfo}>
                        <Text style={styles.teacherName}>{teacher.firstName} {teacher.lastName}</Text>
                        <Text style={styles.teacherRoles}>{teacher.roles?.join(', ') || 'Teacher'}</Text>
                      </View>
                      {currentClass && (
                        <Text style={styles.teacherCurrentClass}>Currently: {currentClass.name}</Text>
                      )}
                      {assigningTeacher === teacher.id && (
                        <ActivityIndicator size="small" color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.cancelBtn}
                onPress={() => setShowTeacherModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Class Details Modal */}
      <Modal visible={showDetailModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.detailHeader}>
                <View style={styles.detailIcon}>
                  <Text style={styles.detailIconText}>🏫</Text>
                </View>
                <View style={styles.detailHeaderInfo}>
                  <Text style={styles.detailTitle}>{detailClass?.name}</Text>
                  {detailClass?.section && <Text style={styles.detailSubtitle}>Section: {detailClass.section}</Text>}
                </View>
              </View>

              <View style={styles.detailStatsRow}>
                <View style={[styles.detailStatCard, { backgroundColor: colors.infoLight }]}>
                  <Text style={[styles.detailStatValue, { color: colors.primaryLight }]}>{detailClass?.studentCount || 0}</Text>
                  <Text style={styles.detailStatLabel}>Students</Text>
                </View>
                <View style={[styles.detailStatCard, { backgroundColor: colors.warningLight }]}>
                  <Text style={[styles.detailStatValue, { color: colors.warning }]}>{detailClass?.capacity || '--'}</Text>
                  <Text style={styles.detailStatLabel}>Capacity</Text>
                </View>
                <View style={[styles.detailStatCard, { backgroundColor: colors.successLight }]}>
                  <Text style={[styles.detailStatValue, { color: colors.success }]}>{detailSubjects.length}</Text>
                  <Text style={styles.detailStatLabel}>Subjects</Text>
                </View>
              </View>

              {detailClass?.classTeacher && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Class Teacher</Text>
                  <View style={styles.detailTeacherRow}>
                    <View style={styles.teacherAvatar}>
                      <Text style={styles.teacherAvatarText}>{detailClass.classTeacher.firstName.charAt(0)}{detailClass.classTeacher.lastName.charAt(0)}</Text>
                    </View>
                    <Text style={styles.detailTeacherName}>{detailClass.classTeacher.firstName} {detailClass.classTeacher.lastName}</Text>
                    <TouchableOpacity style={styles.removeTeacherBtn} onPress={() => { setShowDetailModal(false); handleRemoveTeacher(detailClass); }}>
                      <Text style={styles.removeTeacherText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Subjects ({detailSubjects.length})</Text>

                <View style={styles.subjectAddRow}>
                  <TouchableOpacity
                    style={[styles.subjectPicker, addingSubject && styles.disabledBtn]}
                    activeOpacity={0.7}
                    onPress={() => {
                      const available = allSubjects.filter((s: any) => !detailSubjects.some((ds: any) => ds.id === s.id));
                      if (available.length === 0) {
                        Alert.alert('No Subjects', 'All subjects are already assigned to this class.');
                        return;
                      }
                      Alert.alert(
                        'Add Subject',
                        'Select a subject to add:',
                        [
                          ...available.slice(0, 10).map((s: any) => ({
                            text: s.name,
                            onPress: () => { setSelectedSubjectId(s.id); setTimeout(() => handleAddSubject(), 50); },
                          })),
                          { text: 'Cancel', style: 'cancel' as const },
                        ]
                      );
                    }}
                  >
                    {addingSubject ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text style={styles.subjectPickerText}>➕ Add Subject</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {detailLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.md }} />
                ) : detailSubjects.length > 0 ? (
                  detailSubjects.map((sub: any, idx: number) => (
                    <View key={sub.id || idx} style={styles.subjectRow}>
                      <View style={styles.subjectInfo}>
                        <View style={[styles.detailBullet, { backgroundColor: colors.primary }]} />
                        <Text style={styles.detailListItemText}>{sub.name}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.removeSubjectBtn, removingSubjectId === sub.id && styles.disabledBtn]}
                        activeOpacity={0.7}
                        onPress={() => {
                          Alert.alert('Remove Subject', `Remove ${sub.name} from this class?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => handleRemoveSubject(sub.id) },
                          ]);
                        }}
                      >
                        {removingSubjectId === sub.id ? (
                          <ActivityIndicator size="small" color={colors.danger} />
                        ) : (
                          <Text style={styles.removeSubjectText}>✕</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No subjects assigned — tap "Add Subject" above</Text>
                )}
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Enrolled Students ({detailEnrollments.length})</Text>
                {detailLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.md }} />
                ) : detailEnrollments.length > 0 ? (
                  detailEnrollments.map((enr: any, idx: number) => (
                    <View key={enr.id || idx} style={styles.detailListItem}>
                      <View style={[styles.detailBullet, { backgroundColor: colors.success }]} />
                      <Text style={styles.detailListItemText}>
                        {enr.student?.firstName || enr.firstName || ''} {enr.student?.lastName || enr.lastName || ''}
                      </Text>
                      <TouchableOpacity
                        style={[styles.removeEnrollmentBtn, removingEnrollmentId === enr.id && styles.btnDisabled]}
                        onPress={() => handleRemoveEnrollment(enr)}
                        disabled={removingEnrollmentId === enr.id}
                      >
                        {removingEnrollmentId === enr.id ? (
                          <ActivityIndicator size="small" color={colors.error} />
                        ) : (
                          <Text style={styles.removeEnrollmentText}>✕</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No students enrolled</Text>
                )}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.cancelBtn}
                  onPress={() => setShowDetailModal(false)}
                >
                  <Text style={styles.cancelBtnText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.saveBtn}
                  onPress={() => { setShowDetailModal(false); if (detailClass) openEdit(detailClass); }}
                >
                  <Text style={styles.saveBtnText}>Edit Class</Text>
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
  classCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  classIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  classIconText: { fontSize: 20 },
  classInfo: { flex: 1 },
  classNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  className: { fontSize: 15, fontWeight: '600', color: colors.text },
  sectionBadge: { fontSize: 11, fontWeight: '600', color: colors.primary, backgroundColor: colors.infoLight, paddingHorizontal: 6, paddingVertical: 1, borderRadius: borderRadius.sm, overflow: 'hidden' },
  classTeacherName: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  classCapacity: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  classRight: { alignItems: 'center', marginRight: spacing.sm, minWidth: 50 },
  studentCount: { fontSize: 18, fontWeight: '700', color: colors.primary },
  studentLabel: { fontSize: 10, color: colors.textLight, marginTop: 2 },
  classActions: { flexDirection: 'row', gap: spacing.xs },
  actionBtn: { width: 32, height: 32, borderRadius: borderRadius.sm, justifyContent: 'center', alignItems: 'center' },
  teacherBtn: { backgroundColor: colors.warningLight },
  teacherBtnText: { fontSize: 14 },
  editBtn: { backgroundColor: colors.infoLight },
  editBtnText: { fontSize: 14 },
  deleteActionBtn: { backgroundColor: colors.errorLight },
  deleteActionText: { fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
  centeredState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  loadingText: { textAlign: 'center', color: colors.textLight, fontSize: 14, marginTop: spacing.md },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 14, color: colors.textLight, marginTop: spacing.xs },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xxl, borderTopRightRadius: borderRadius.xxl, padding: spacing.lg, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.lg, textAlign: 'center' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: 15, color: colors.text, marginBottom: spacing.sm },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.lg },
  cancelBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: borderRadius.md, backgroundColor: colors.border },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.text },
  saveBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: borderRadius.md, minWidth: 90, alignItems: 'center' },
  saveBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  savingBtn: { opacity: 0.7 },
  savingRow: { flexDirection: 'row', alignItems: 'center' },
  teacherSearchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  teacherList: { maxHeight: 300 },
  teacherItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  teacherItemActive: { backgroundColor: colors.infoLight, marginHorizontal: -spacing.md, paddingHorizontal: spacing.md, borderRadius: borderRadius.md },
  teacherAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.teal, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  teacherAvatarText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  teacherInfo: { flex: 1 },
  teacherName: { fontSize: 15, fontWeight: '600', color: colors.text },
  teacherRoles: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  teacherCurrentClass: { fontSize: 11, color: colors.warning, fontWeight: '600', marginLeft: spacing.sm },
  detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  detailIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.infoLight, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  detailIconText: { fontSize: 28 },
  detailHeaderInfo: { flex: 1 },
  detailTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  detailSubtitle: { fontSize: 14, color: colors.textLight, marginTop: 2 },
  detailStatsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  detailStatCard: { flex: 1, padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
  detailStatValue: { fontSize: 20, fontWeight: '700' },
  detailStatLabel: { fontSize: 11, color: colors.textLight, marginTop: 4 },
  detailSection: { marginBottom: spacing.lg },
  detailSectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  detailTeacherRow: { flexDirection: 'row', alignItems: 'center' },
  detailTeacherName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  removeTeacherBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, backgroundColor: colors.errorLight },
  removeTeacherText: { fontSize: 12, fontWeight: '600', color: colors.error },
  detailListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
  detailBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginRight: spacing.sm },
  detailListItemText: { fontSize: 14, color: colors.text, flex: 1 },
  removeEnrollmentBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.errorLight, justifyContent: 'center', alignItems: 'center', marginLeft: spacing.sm },
  removeEnrollmentText: { color: colors.error, fontSize: 13, fontWeight: '700' },
  subjectAddRow: { marginBottom: spacing.sm },
  subjectPicker: { backgroundColor: colors.primaryLight + '15', borderRadius: borderRadius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.primaryLight + '40', borderStyle: 'dashed', alignItems: 'center' },
  subjectPickerText: { fontSize: 13, fontWeight: '600', color: colors.primaryLight },
  subjectRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  subjectInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  removeSubjectBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.errorLight, justifyContent: 'center', alignItems: 'center' },
  removeSubjectText: { fontSize: 14, fontWeight: '700', color: colors.error },
  disabledBtn: { opacity: 0.5 },
});
