import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, Input } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Props {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

export const AcademicYearManagementScreen: React.FC<Props> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [years, setYears] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingYear, setEditingYear] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);

  const loadYears = async () => {
    try {
      const data = await apiService.getAcademicYears();
      setYears(data || []);
    } catch (err) {
      console.error('Failed to load academic years:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadYears(); }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadYears();
  };

  const openCreate = () => {
    setEditingYear(null);
    setForm({ name: '', startDate: '', endDate: '' });
    setShowModal(true);
  };

  const openEdit = (year: any) => {
    setEditingYear(year);
    setForm({
      name: year.name || '',
      startDate: year.startDate ? year.startDate.split('T')[0] : '',
      endDate: year.endDate ? year.endDate.split('T')[0] : '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.startDate || !form.endDate) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    setSaving(true);
    try {
      if (editingYear) {
        await apiService.updateAcademicYear(editingYear.id, form);
        Alert.alert('Success', 'Academic year updated');
      } else {
        await apiService.createAcademicYear(form);
        Alert.alert('Success', 'Academic year created');
      }
      setShowModal(false);
      loadYears();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save academic year');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (year: any) => {
    Alert.alert(
      'Delete Academic Year',
      `Delete "${year.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteAcademicYear(year.id);
              loadYears();
              Alert.alert('Success', 'Academic year deleted');
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  const handleSetCurrent = async (year: any) => {
    try {
      await apiService.updateAcademicYear(year.id, { isCurrent: true });
      Alert.alert('Success', `${year.name} set as current`);
      loadYears();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to set current');
    }
  };

  const navigateToTerms = (year: any) => {
    if (stackNavigation) {
      stackNavigation.navigate('TermManagement', { academicYearId: year.id, academicYearName: year.name });
    } else {
      navigation.navigate('TermManagement', { academicYearId: year.id, academicYearName: year.name });
    }
  };

  const handleNav = (screen: string) => {
    if (onNavigate && ['DirectorHome', 'DirectorSettings'].includes(screen)) {
      onNavigate(screen);
    } else {
      navigation.navigate(screen as never);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Academic Years"
        subtitle="Manage school academic years"
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '➕', onPress: openCreate }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : years.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>No Academic Years</Text>
            <Text style={styles.emptyDesc}>Tap + to create your first academic year.</Text>
          </View>
        ) : (
          years.map((year) => (
            <View key={year.id} style={styles.yearCard}>
              <View style={styles.yearHeader}>
                <Text style={styles.yearName}>{year.name}</Text>
                {year.isCurrent && <View style={styles.currentBadge}><Text style={styles.currentBadgeText}>Current</Text></View>}
              </View>
              <Text style={styles.yearDate}>{year.startDate?.split('T')[0]} → {year.endDate?.split('T')[0]}</Text>
              <View style={styles.yearActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => navigateToTerms(year)}>
                  <Text style={styles.actionBtnText}>📋 Terms</Text>
                </TouchableOpacity>
                {!year.isCurrent && (
                  <TouchableOpacity style={[styles.actionBtn, styles.setBtn]} onPress={() => handleSetCurrent(year)}>
                    <Text style={styles.actionBtnText}>Set Current</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => openEdit(year)}>
                  <Text style={styles.actionBtnWhite}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(year)}>
                  <Text style={styles.actionBtnWhite}>Del</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingYear ? 'Edit Academic Year' : 'Create Academic Year'}</Text>
            <Input label="Name" placeholder="e.g. 2025" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
            <Input label="Start Date" placeholder="YYYY-MM-DD" value={form.startDate} onChangeText={(v) => setForm({ ...form, startDate: v })} />
            <Input label="End Date" placeholder="YYYY-MM-DD" value={form.endDate} onChangeText={(v) => setForm({ ...form, endDate: v })} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.btnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  loadingText: { textAlign: 'center', color: colors.textLight, marginTop: spacing.xl },
  emptyBox: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyDesc: { fontSize: 14, color: colors.textLight, marginTop: spacing.xs, textAlign: 'center' },
  yearCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadows.card },
  yearHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  yearName: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1 },
  currentBadge: { backgroundColor: colors.successLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full },
  currentBadgeText: { fontSize: 11, fontWeight: '700', color: colors.success },
  yearDate: { fontSize: 13, color: colors.textLight, marginBottom: spacing.md },
  yearActions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, backgroundColor: colors.infoLight },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: colors.info },
  setBtn: { backgroundColor: colors.successLight },
  editBtn: { backgroundColor: colors.primary },
  actionBtnWhite: { fontSize: 13, fontWeight: '600', color: colors.white },
  deleteBtn: { backgroundColor: colors.error },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  modalContent: { backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.xl },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg },
  cancelBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.border },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.text },
  saveBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.primary },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: colors.white },
  btnDisabled: { opacity: 0.6 },
});
