import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, Input } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Props {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

export const TermManagementScreen: React.FC<Props> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<any>();
  const academicYearId = route.params?.academicYearId;
  const academicYearName = route.params?.academicYearName || '';

  const [terms, setTerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTerm, setEditingTerm] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);
  const [settingCurrentId, setSettingCurrentId] = useState<string | null>(null);

  const loadTerms = async () => {
    if (!academicYearId) return;
    try {
      const data = await apiService.getTerms(academicYearId);
      setTerms(data || []);
    } catch (err) {
      console.error('Failed to load terms:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadTerms(); }, [academicYearId]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadTerms();
  };

  const openCreate = () => {
    setEditingTerm(null);
    setForm({ name: '', startDate: '', endDate: '' });
    setShowModal(true);
  };

  const openEdit = (term: any) => {
    setEditingTerm(term);
    setForm({
      name: term.name || '',
      startDate: term.startDate ? term.startDate.split('T')[0] : '',
      endDate: term.endDate ? term.endDate.split('T')[0] : '',
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
      if (editingTerm) {
        await apiService.updateTerm(editingTerm.id, form);
        Alert.alert('Success', 'Term updated');
      } else {
        await apiService.createTerm({ ...form, academicYearId });
        Alert.alert('Success', 'Term created');
      }
      setShowModal(false);
      loadTerms();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save term');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (term: any) => {
    Alert.alert(
      'Delete Term',
      `Delete "${term.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteTerm(term.id);
              loadTerms();
              Alert.alert('Success', 'Term deleted');
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  const handleSetCurrent = async (term: any) => {
    setSettingCurrentId(term.id);
    try {
      await apiService.setCurrentTerm(term.id);
      Alert.alert('Success', `${term.name} set as current term`);
      loadTerms();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to set current term');
    } finally {
      setSettingCurrentId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title={academicYearName || 'Terms'}
        subtitle="Manage terms for this academic year"
        leftIcon={{ name: '← Back', onPress: () => navigation.goBack() }}
        rightIcon={{ name: '➕', onPress: openCreate }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : terms.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📆</Text>
            <Text style={styles.emptyTitle}>No Terms</Text>
            <Text style={styles.emptyDesc}>Tap + to create your first term for this academic year.</Text>
          </View>
        ) : (
          terms.map((term) => (
            <View key={term.id} style={styles.termCard}>
              <View style={styles.termHeader}>
                <Text style={styles.termName}>{term.name}</Text>
                {term.isCurrent && <View style={styles.currentBadge}><Text style={styles.currentBadgeText}>Active</Text></View>}
              </View>
              <Text style={styles.termDate}>{term.startDate?.split('T')[0]} → {term.endDate?.split('T')[0]}</Text>
              <View style={styles.termActions}>
                {!term.isCurrent && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.setBtn]}
                    onPress={() => handleSetCurrent(term)}
                    disabled={settingCurrentId === term.id}
                  >
                    <Text style={styles.actionBtnText}>{settingCurrentId === term.id ? 'Setting...' : 'Set Active'}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => openEdit(term)}>
                  <Text style={styles.actionBtnWhite}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(term)}>
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
            <Text style={styles.modalTitle}>{editingTerm ? 'Edit Term' : 'Create Term'}</Text>
            <Input label="Term Name" placeholder="e.g. Term 1" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
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
  termCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadows.card },
  termHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  termName: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1 },
  currentBadge: { backgroundColor: colors.successLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full },
  currentBadgeText: { fontSize: 11, fontWeight: '700', color: colors.success },
  termDate: { fontSize: 13, color: colors.textLight, marginBottom: spacing.md },
  termActions: { flexDirection: 'row', gap: spacing.sm },
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
