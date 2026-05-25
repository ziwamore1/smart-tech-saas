import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, TextInput, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { HeaderBar } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAuthStore, useAppStore } from '../../store';
import { apiService } from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface StudentRecord {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  photoUrl?: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
}

const STATUS_COLORS = {
  PRESENT: colors.success,
  ABSENT: colors.error,
  LATE: colors.warning,
  EXCUSED: colors.info,
};

const STATUS_BG = {
  PRESENT: colors.successLight,
  ABSENT: colors.errorLight,
  LATE: colors.warningLight,
  EXCUSED: colors.infoLight,
};

export const AttendanceScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user } = useAuthStore();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [classes, setClasses] = useState<any[]>([]);

  const triggerHaptic = (type: string) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      ReactNativeHapticFeedback.trigger(type as any, hapticOptions);
    }
  };

  const toggleStudentStatus = (studentId: string) => {
    triggerHaptic('selection');
    setStudents(prev => prev.map(s => {
      if (s.id !== studentId) return s;
      const cycle: StudentRecord['status'][] = ['PRESENT', 'LATE', 'EXCUSED', 'ABSENT'];
      const idx = cycle.indexOf(s.status);
      return { ...s, status: cycle[(idx + 1) % cycle.length] };
    }));
    setHasChanges(true);
  };

  const toggleSelection = (studentId: string) => {
    triggerHaptic('selection');
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const selectAll = () => {
    triggerHaptic('selection');
    setSelectedIds(new Set(students.map(s => s.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const applyBulkStatus = (status: StudentRecord['status']) => {
    triggerHaptic('impactMedium');
    setStudents(prev => prev.map(s =>
      selectedIds.has(s.id) ? { ...s, status } : s
    ));
    setHasChanges(true);
    setSelectedIds(new Set());
  };

  const markAllPresent = async () => {
    if (!selectedClass) return;
    triggerHaptic('impactMedium');
    setSaving(true);
    try {
      await apiService.markAllAttendance(selectedClass.id, selectedDate, 'PRESENT');
      setStudents(prev => prev.map(s => ({ ...s, status: 'PRESENT' as const })));
      setHasChanges(false);
      await saveCache();
    } catch (err) {
      Alert.alert('Error', 'Failed to mark all present');
    } finally {
      setSaving(false);
    }
  };

  const saveAttendance = async () => {
    if (!selectedClass) return;
    setSaving(true);
    try {
      const records = students.map(s => ({
        studentId: s.id,
        status: s.status,
      }));
      await apiService.submitBulkAttendance(selectedClass.id, selectedDate, records);
      setHasChanges(false);
      setUnsavedQueue([]);
      await saveCache();
      Alert.alert('Success', 'Attendance saved successfully');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save attendance. Changes queued for offline sync.');
      setUnsavedQueue(students.map(s => ({ studentId: s.id, status: s.status, classId: selectedClass.id, date: selectedDate })));
      await AsyncStorage.setItem('attendance_offline_queue', JSON.stringify(unsavedQueue));
    } finally {
      setSaving(false);
    }
  };

  const saveCache = async () => {
    if (!selectedClass) return;
    const cacheKey = `attendance_${selectedClass.id}_${selectedDate}`;
    await AsyncStorage.setItem(cacheKey, JSON.stringify({ students, timestamp: Date.now() }));
  };

  const getStats = () => {
    return {
      total: students.length,
      present: students.filter(s => s.status === 'PRESENT').length,
      absent: students.filter(s => s.status === 'ABSENT').length,
      late: students.filter(s => s.status === 'LATE').length,
      excused: students.filter(s => s.status === 'EXCUSED').length,
    };
  };

  const stats = getStats();

  const renderStudent = ({ item }: { item: StudentRecord }) => {
    const isSelected = selectedIds.has(item.id);
    const statusColor = STATUS_COLORS[item.status];
    const statusBg = STATUS_BG[item.status];

    return (
      <TouchableOpacity
        style={[styles.studentRow, isSelected && styles.studentRowSelected]}
        onPress={() => isSelectionMode ? toggleSelection(item.id) : toggleStudentStatus(item.id)}
        onLongPress={() => toggleSelection(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.statusIndicator, { backgroundColor: statusBg }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        </View>

        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {item.firstName.charAt(0)}{item.lastName.charAt(0)}
          </Text>
        </View>

        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{item.firstName} {item.lastName}</Text>
          <Text style={styles.studentAdm}>{item.admissionNumber}</Text>
        </View>

        <TouchableOpacity
          style={[styles.statusBadge, { backgroundColor: statusBg }]}
          onPress={() => toggleStudentStatus(item.id)}
        >
          <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
        </TouchableOpacity>

        {isSelectionMode && (
          <View style={[styles.checkCircle, isSelected ? styles.checkCircleSelected : styles.checkCircleEmpty]}>
            {isSelected && <Text style={styles.checkText}>✓</Text>}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (!selectedClass) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <HeaderBar
          title="Attendance"
          subtitle="Select a class to begin"
          leftIcon={{ name: '☰', onPress: () => {} }}
        />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No classes available</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Attendance"
        subtitle={`${selectedClass.name} • ${selectedDate}`}
        leftIcon={{ name: '☰', onPress: () => {} }}
        rightIcon={{ name: saving ? '⏳' : hasChanges ? '💾' : '✅', onPress: hasChanges ? saveAttendance : () => {} }}
      />

      <View style={styles.controlsRow}>
        <TouchableOpacity style={styles.controlBtn} onPress={() => setShowClassPicker(true)}>
          <Text style={styles.controlBtnIcon}>🏫</Text>
          <Text style={styles.controlBtnText} numberOfLines={1}>{selectedClass.name}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.controlBtnIcon}>📅</Text>
          <Text style={styles.controlBtnText}>{selectedDate}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.controlBtn, styles.markAllBtn]} onPress={markAllPresent} disabled={saving}>
          <Text style={styles.markAllText}>All Present</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: STATUS_BG.PRESENT }]}>
          <Text style={[styles.statNum, { color: STATUS_COLORS.PRESENT }]}>{stats.present}</Text>
          <Text style={styles.statLabel}>Present</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: STATUS_BG.ABSENT }]}>
          <Text style={[styles.statNum, { color: STATUS_COLORS.ABSENT }]}>{stats.absent}</Text>
          <Text style={styles.statLabel}>Absent</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: STATUS_BG.LATE }]}>
          <Text style={[styles.statNum, { color: STATUS_COLORS.LATE }]}>{stats.late}</Text>
          <Text style={styles.statLabel}>Late</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: STATUS_BG.EXCUSED }]}>
          <Text style={[styles.statNum, { color: STATUS_COLORS.EXCUSED }]}>{stats.excused}</Text>
          <Text style={styles.statLabel}>Excused</Text>
        </View>
      </View>

      {isSelectionMode && (
        <View style={styles.actionBar}>
          <View style={styles.actionBarLeft}>
            <Text style={styles.actionBarCount}>{selectedIds.size} selected</Text>
          </View>
          <View style={styles.actionBarButtons}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: STATUS_BG.PRESENT }]} onPress={() => applyBulkStatus('PRESENT')}>
              <Text style={[styles.actionBtnText, { color: STATUS_COLORS.PRESENT }]}>Present</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: STATUS_BG.ABSENT }]} onPress={() => applyBulkStatus('ABSENT')}>
              <Text style={[styles.actionBtnText, { color: STATUS_COLORS.ABSENT }]}>Absent</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: STATUS_BG.LATE }]} onPress={() => applyBulkStatus('LATE')}>
              <Text style={[styles.actionBtnText, { color: STATUS_COLORS.LATE }]}>Late</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: STATUS_BG.EXCUSED }]} onPress={() => applyBulkStatus('EXCUSED')}>
              <Text style={[styles.actionBtnText, { color: STATUS_COLORS.EXCUSED }]}>Excused</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.background }]} onPress={clearSelection}>
              <Text style={[styles.actionBtnText, { color: colors.textLight }]}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading attendance...</Text>
        </View>
      ) : (
        <FlashList
          data={students}
          renderItem={renderStudent}
          keyExtractor={(item: StudentRecord) => item.id}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={<View style={{ height: isSelectionMode ? 120 : spacing.xxl }} />}
        />
      )}

      {hasChanges && !isSelectionMode && (
        <TouchableOpacity style={styles.saveFab} onPress={saveAttendance} disabled={saving}>
          <Text style={styles.saveFabText}>{saving ? 'Saving...' : `Save (${students.filter(s => s.status !== 'PRESENT').length} changes)`}</Text>
        </TouchableOpacity>
      )}

      <Modal visible={showClassPicker} transparent animationType="slide" onRequestClose={() => setShowClassPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowClassPicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Class</Text>
            {classes.map((cls: any) => (
              <TouchableOpacity
                key={cls.id}
                style={[styles.modalItem, selectedClass?.id === cls.id && styles.modalItemSelected]}
                onPress={() => { setSelectedClass(cls); setShowClassPicker(false); }}
              >
                <Text style={[styles.modalItemText, selectedClass?.id === cls.id && styles.modalItemTextSelected]}>{cls.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowDatePicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Date</Text>
            <TextInput
              style={styles.dateInput}
              value={selectedDate}
              onChangeText={(t) => {
                const cleaned = t.replace(/[^0-9-]/g, '');
                if (/^\d{4}-\d{0,2}-\d{0,2}$/.test(cleaned) || cleaned === '') {
                  setSelectedDate(cleaned);
                }
              }}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              autoFocus
            />
            <TouchableOpacity
              style={styles.modalConfirmBtn}
              onPress={() => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
                  setShowDatePicker(false);
                } else {
                  Alert.alert('Invalid Date', 'Please use YYYY-MM-DD format');
                }
              }}
            >
              <Text style={styles.modalConfirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 64, marginBottom: spacing.md },
  emptyText: { fontSize: 16, color: colors.textLight },
  controlsRow: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm },
  controlBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...shadows.sm, flex: 1 },
  controlBtnIcon: { fontSize: 16, marginRight: spacing.xs },
  controlBtnText: { fontSize: 13, fontWeight: '600', color: colors.text, flex: 1 },
  markAllBtn: { backgroundColor: colors.success, flex: 1.2 },
  markAllText: { color: colors.white, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  statBox: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.lg, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.textLight, marginTop: 2 },
  actionBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, padding: spacing.sm, marginHorizontal: spacing.md, borderRadius: borderRadius.lg, ...shadows.lg, marginBottom: spacing.sm },
  actionBarLeft: { flex: 1, paddingLeft: spacing.sm },
  actionBarCount: { fontSize: 14, fontWeight: '700', color: colors.primary },
  actionBarButtons: { flexDirection: 'row', gap: spacing.xs },
  actionBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.md },
  actionBtnText: { fontSize: 11, fontWeight: '700' },
  listContent: { paddingHorizontal: spacing.md },
  studentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadows.sm },
  studentRowSelected: { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.infoLight },
  statusIndicator: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  avatarText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '600', color: colors.text },
  studentAdm: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.md },
  statusText: { fontSize: 11, fontWeight: '700' },
  checkCircle: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: spacing.sm },
  checkCircleSelected: { backgroundColor: colors.primary },
  checkCircleEmpty: { borderWidth: 2, borderColor: colors.border },
  checkText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing.md, fontSize: 14, color: colors.textLight },
  saveFab: { position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg, backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: spacing.md, alignItems: 'center', ...shadows.lg },
  saveFabText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xxl, borderTopRightRadius: borderRadius.xxl, padding: spacing.lg, maxHeight: '70%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.lg, textAlign: 'center' },
  modalItem: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  modalItemSelected: { backgroundColor: colors.infoLight },
  modalItemText: { fontSize: 16, color: colors.text, textAlign: 'center' },
  modalItemTextSelected: { fontWeight: '700', color: colors.primary },
  dateInput: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: 18, textAlign: 'center', marginBottom: spacing.lg },
  modalConfirmBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: spacing.md, alignItems: 'center' },
  modalConfirmText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
