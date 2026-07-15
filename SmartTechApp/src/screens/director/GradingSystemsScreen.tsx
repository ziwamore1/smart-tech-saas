import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Modal, RefreshControl, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface GradeScale {
  id?: string;
  grade: string;
  min: string;
  max: string;
  remark: string;
  points: string;
}

interface GradingSystem {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  gradeType?: string;
  scales?: GradeScale[];
}

interface Props {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

const SCHOOL_LEVELS = ['PRIMARY', 'SECONDARY', 'BOTH'];

const DEFAULT_SCALE_TEMPLATE: GradeScale = { grade: '', min: '', max: '', remark: '', points: '' };

export const GradingSystemsScreen: React.FC<Props> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const [systems, setSystems] = useState<GradingSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSchoolSettingModal, setShowSchoolSettingModal] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState<GradingSystem | null>(null);
  const [editingSystem, setEditingSystem] = useState<GradingSystem | null>(null);
  const [saving, setSaving] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingSchoolLevel, setUpdatingSchoolLevel] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    gradeType: 'STANDARD',
    scales: [{ ...DEFAULT_SCALE_TEMPLATE }] as GradeScale[],
  });

  const [schoolLevel, setSchoolLevel] = useState('SECONDARY');

  const loadSystems = useCallback(async () => {
    try {
      const data = await apiService.getGradingSystems();
      setSystems(Array.isArray(data) ? data : data?.data || []);
    } catch (err) {
      console.error('Failed to load grading systems:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadSystems(); }, [loadSystems]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadSystems();
  };

  const defaultSystem = systems.find((s) => s.isDefault);

  const openCreate = () => {
    setEditingSystem(null);
    setForm({
      name: '',
      description: '',
      gradeType: 'STANDARD',
      scales: [
        { grade: 'A', min: '80', max: '100', remark: 'Excellent', points: '4.0' },
        { grade: 'B', min: '70', max: '79', remark: 'Very Good', points: '3.0' },
        { grade: 'C', min: '60', max: '69', remark: 'Good', points: '2.0' },
        { grade: 'D', min: '50', max: '59', remark: 'Satisfactory', points: '1.0' },
        { grade: 'F', min: '0', max: '49', remark: 'Fail', points: '0.0' },
      ],
    });
    setShowCreateModal(true);
  };

  const openEdit = (system: GradingSystem) => {
    setEditingSystem(system);
    setForm({
      name: system.name || '',
      description: system.description || '',
      gradeType: system.gradeType || 'STANDARD',
      scales: system.scales?.length
        ? system.scales.map((s) => ({ ...s, min: String(s.min), max: String(s.max), points: String(s.points) }))
        : [{ ...DEFAULT_SCALE_TEMPLATE }],
    });
    setShowCreateModal(true);
  };

  const openDetail = (system: GradingSystem) => {
    setSelectedSystem(system);
    setShowDetailModal(true);
  };

  const addScaleRow = () => {
    setForm((prev) => ({
      ...prev,
      scales: [...prev.scales, { ...DEFAULT_SCALE_TEMPLATE }],
    }));
  };

  const removeScaleRow = (index: number) => {
    if (form.scales.length <= 1) return;
    setForm((prev) => ({
      ...prev,
      scales: prev.scales.filter((_, i) => i !== index),
    }));
  };

  const updateScale = (index: number, field: keyof GradeScale, value: string) => {
    setForm((prev) => {
      const updated = [...prev.scales];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, scales: updated };
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Grading system name is required');
      return;
    }
    const validScales = form.scales.filter((s) => s.grade.trim() && s.min.trim() && s.max.trim());
    if (validScales.length === 0) {
      Alert.alert('Error', 'At least one grade scale with grade, min, and max is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        gradeType: form.gradeType,
        scales: validScales.map((s) => ({
          grade: s.grade.trim(),
          min: Number(s.min),
          max: Number(s.max),
          remark: s.remark.trim(),
          points: Number(s.points) || 0,
        })),
      };

      if (editingSystem) {
        await apiService.updateGradingSystem(editingSystem.id, payload);
        Alert.alert('Success', 'Grading system updated');
      } else {
        await apiService.createGradingSystem(payload);
        Alert.alert('Success', 'Grading system created');
      }
      setShowCreateModal(false);
      loadSystems();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save grading system');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (system: GradingSystem) => {
    Alert.alert(
      'Delete Grading System',
      `Delete "${system.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(system.id);
            try {
              await apiService.deleteGradingSystem(system.id);
              loadSystems();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to delete');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (system: GradingSystem) => {
    setSettingDefaultId(system.id);
    try {
      await apiService.setDefaultGradingSystem(system.id);
      Alert.alert('Success', `"${system.name}" set as default grading system`);
      loadSystems();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to set default');
    } finally {
      setSettingDefaultId(null);
    }
  };

  const handleUpdateSchoolLevel = async () => {
    setUpdatingSchoolLevel(true);
    try {
      await apiService.updateSchoolGradingSystem({ gradingSystem: schoolLevel });
      Alert.alert('Success', `School grading level set to ${schoolLevel}`);
      setShowSchoolSettingModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update school setting');
    } finally {
      setUpdatingSchoolLevel(false);
    }
  };

  const renderGradeTable = (scales: GradeScale[] | undefined, compact?: boolean) => {
    if (!scales || scales.length === 0) {
      return <Text style={styles.emptyText}>No grade scales configured</Text>;
    }
    return (
      <View style={styles.tableContainer}>
        <View style={[styles.tableHeader, compact && styles.tableHeaderCompact]}>
          <Text style={[styles.tableHeaderText, { flex: 0.8 }]}>Grade</Text>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Min</Text>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Max</Text>
          <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Remark</Text>
          <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Points</Text>
        </View>
        {scales.map((scale, idx) => (
          <View
            key={idx}
            style={[
              styles.tableRow,
              idx % 2 === 1 && styles.tableRowAlt,
              compact && styles.tableRowCompact,
            ]}
          >
            <Text style={[styles.tableCellBold, { flex: 0.8, color: scale.grade === 'F' || scale.grade === 'E' ? colors.error : scale.grade === 'A' ? colors.success : colors.text }]}>
              {scale.grade}
            </Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{scale.min}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{scale.max}</Text>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>{scale.remark}</Text>
            <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{scale.points}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Grading Systems"
        subtitle="Manage school grading systems and scales"
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '➕', onPress: openCreate }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {loading ? (
          <View style={styles.centeredState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading grading systems...</Text>
          </View>
        ) : (
          <>
            {defaultSystem && (
              <View style={styles.defaultBanner}>
                <View style={styles.defaultBannerLeft}>
                  <Text style={styles.defaultBannerIcon}>⭐</Text>
                  <View>
                    <Text style={styles.defaultBannerLabel}>Current Default</Text>
                    <Text style={styles.defaultBannerName}>{defaultSystem.name}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.schoolLevelBtn}
                  onPress={() => setShowSchoolSettingModal(true)}
                >
                  <Text style={styles.schoolLevelBtnText}>School Level</Text>
                </TouchableOpacity>
              </View>
            )}

            <WidgetCard title="All Grading Systems" action={{ label: 'School Settings', onPress: () => setShowSchoolSettingModal(true) }}>
              {systems.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyIcon}>📊</Text>
                  <Text style={styles.emptyTitle}>No Grading Systems</Text>
                  <Text style={styles.emptyDesc}>Tap + to create your first grading system.</Text>
                </View>
              ) : (
                systems.map((system) => (
                  <TouchableOpacity key={system.id} activeOpacity={0.85} style={styles.systemCard} onPress={() => openDetail(system)}>
                    <View style={styles.systemHeader}>
                      <View style={styles.systemHeaderLeft}>
                        <Text style={styles.systemName}>{system.name}</Text>
                        {system.description ? (
                          <Text style={styles.systemDesc} numberOfLines={1}>{system.description}</Text>
                        ) : null}
                      </View>
                      <View style={styles.systemBadges}>
                        {system.isDefault && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>⭐ Default</Text>
                          </View>
                        )}
                        <View style={styles.scaleCountBadge}>
                          <Text style={styles.scaleCountText}>{system.scales?.length || 0} scales</Text>
                        </View>
                      </View>
                    </View>

                    {system.scales && system.scales.length > 0 && (
                      <View style={styles.scalesPreview}>
                        <Text style={styles.scalesPreviewLabel}>Grade Scale Preview</Text>
                        <View style={styles.previewRow}>
                          {system.scales.slice(0, 6).map((s, i) => (
                            <View key={i} style={[styles.previewChip, i === 0 && styles.previewChipFirst]}>
                              <Text style={styles.previewChipGrade}>{s.grade}</Text>
                              <Text style={styles.previewChipRange}>{s.min}-{s.max}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    <View style={styles.systemActions}>
                      {!system.isDefault && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          style={[styles.actionBtn, styles.setDefaultBtn]}
                          onPress={() => handleSetDefault(system)}
                          disabled={settingDefaultId === system.id}
                        >
                          <Text style={styles.setDefaultBtnText}>
                            {settingDefaultId === system.id ? 'Setting...' : '⭐ Set Default'}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity activeOpacity={0.7} style={[styles.actionBtn, styles.editBtn]} onPress={() => openEdit(system)}>
                        <Text style={styles.actionBtnWhite}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={[styles.actionBtn, styles.deleteBtn, deletingId === system.id && styles.btnDisabled]}
                        onPress={() => handleDelete(system)}
                        disabled={deletingId === system.id}
                      >
                        {deletingId === system.id ? (
                          <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                          <Text style={styles.actionBtnWhite}>Del</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </WidgetCard>

            <View style={{ height: spacing.xxl }} />
          </>
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={showDetailModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.modalContentLarge]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedSystem?.name}</Text>
                {selectedSystem?.description && (
                  <Text style={styles.modalSubtitle}>{selectedSystem.description}</Text>
                )}
              </View>
              {selectedSystem?.isDefault && (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultBadgeText}>⭐ Default</Text>
                </View>
              )}
            </View>
            <Text style={styles.tableSectionTitle}>Grade Scale Table</Text>
            {renderGradeTable(selectedSystem?.scales)}
            <View style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.cancelBtn}
                onPress={() => setShowDetailModal(false)}
              >
                <Text style={styles.cancelBtnText}>Close</Text>
              </TouchableOpacity>
              {selectedSystem && !selectedSystem.isDefault && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.setDefaultModalBtn}
                  onPress={() => {
                    setShowDetailModal(false);
                    handleSetDefault(selectedSystem);
                  }}
                >
                  <Text style={styles.setDefaultModalBtnText}>⭐ Set as Default</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.editModalBtn}
                onPress={() => {
                  setShowDetailModal(false);
                  if (selectedSystem) openEdit(selectedSystem);
                }}
              >
                <Text style={styles.saveBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create/Edit Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.modalContentLarge]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editingSystem ? 'Edit Grading System' : 'Create Grading System'}</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Zambian National Grading"
                  placeholderTextColor={colors.textMuted}
                  value={form.name}
                  onChangeText={(v) => setForm({ ...form, name: v })}
                  editable={!saving}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Optional description"
                  placeholderTextColor={colors.textMuted}
                  value={form.description}
                  onChangeText={(v) => setForm({ ...form, description: v })}
                  editable={!saving}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Grade Type</Text>
                <View style={styles.typeRow}>
                  {['STANDARD', 'COMPETENCY', 'GPA'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      activeOpacity={0.7}
                      style={[styles.typeChip, form.gradeType === type && styles.typeChipActive]}
                      onPress={() => setForm({ ...form, gradeType: type })}
                      disabled={saving}
                    >
                      <Text style={[styles.typeChipText, form.gradeType === type && styles.typeChipTextActive]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <View style={styles.scalesHeader}>
                  <Text style={styles.label}>Grade Scales *</Text>
                  <TouchableOpacity activeOpacity={0.7} style={styles.addScaleBtn} onPress={addScaleRow} disabled={saving}>
                    <Text style={styles.addScaleBtnText}>+ Add Row</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.scaleTableHeader}>
                  <Text style={[styles.scaleTableHeaderText, { flex: 0.7 }]}>Grade</Text>
                  <Text style={[styles.scaleTableHeaderText, { flex: 0.8 }]}>Min</Text>
                  <Text style={[styles.scaleTableHeaderText, { flex: 0.8 }]}>Max</Text>
                  <Text style={[styles.scaleTableHeaderText, { flex: 1.2 }]}>Remark</Text>
                  <Text style={[styles.scaleTableHeaderText, { flex: 0.7 }]}>Pts</Text>
                  <Text style={[styles.scaleTableHeaderText, { flex: 0.4 }]}></Text>
                </View>

                {form.scales.map((scale, idx) => (
                  <View key={idx} style={[styles.scaleEditRow, idx % 2 === 1 && styles.scaleEditRowAlt]}>
                    <TextInput
                      style={[styles.scaleInput, { flex: 0.7 }]}
                      placeholder="A"
                      placeholderTextColor={colors.textMuted}
                      value={scale.grade}
                      onChangeText={(v) => updateScale(idx, 'grade', v)}
                      editable={!saving}
                      maxLength={2}
                    />
                    <TextInput
                      style={[styles.scaleInput, { flex: 0.8 }]}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      value={scale.min}
                      onChangeText={(v) => updateScale(idx, 'min', v)}
                      keyboardType="numeric"
                      editable={!saving}
                    />
                    <TextInput
                      style={[styles.scaleInput, { flex: 0.8 }]}
                      placeholder="100"
                      placeholderTextColor={colors.textMuted}
                      value={scale.max}
                      onChangeText={(v) => updateScale(idx, 'max', v)}
                      keyboardType="numeric"
                      editable={!saving}
                    />
                    <TextInput
                      style={[styles.scaleInput, { flex: 1.2 }]}
                      placeholder="Remark"
                      placeholderTextColor={colors.textMuted}
                      value={scale.remark}
                      onChangeText={(v) => updateScale(idx, 'remark', v)}
                      editable={!saving}
                    />
                    <TextInput
                      style={[styles.scaleInput, { flex: 0.7 }]}
                      placeholder="4.0"
                      placeholderTextColor={colors.textMuted}
                      value={scale.points}
                      onChangeText={(v) => updateScale(idx, 'points', v)}
                      keyboardType="numeric"
                      editable={!saving}
                    />
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.removeScaleBtn}
                      onPress={() => removeScaleRow(idx)}
                      disabled={saving || form.scales.length <= 1}
                    >
                      <Text style={[styles.removeScaleBtnText, (saving || form.scales.length <= 1) && styles.btnDisabled]}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.cancelBtn, saving && styles.btnDisabled]}
                  onPress={() => setShowCreateModal(false)}
                  disabled={saving}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.saveBtn, saving && styles.savingBtn]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <View style={styles.savingRow}>
                      <ActivityIndicator size="small" color={colors.white} />
                      <Text style={styles.saveBtnText}>  Saving...</Text>
                    </View>
                  ) : (
                    <Text style={styles.saveBtnText}>{editingSystem ? 'Update' : 'Create'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* School Level Setting Modal */}
      <Modal visible={showSchoolSettingModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>School Grading Level</Text>
            <Text style={styles.schoolLevelDesc}>Set the grading level for your school. This determines which grading system and policies apply.</Text>
            <View style={styles.schoolLevelOptions}>
              {SCHOOL_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level}
                  activeOpacity={0.7}
                  style={[styles.schoolLevelOption, schoolLevel === level && styles.schoolLevelOptionActive]}
                  onPress={() => setSchoolLevel(level)}
                >
                  <View style={styles.schoolLevelOptionLeft}>
                    <View style={[styles.radioOuter, schoolLevel === level && styles.radioOuterActive]}>
                      {schoolLevel === level && <View style={styles.radioInner} />}
                    </View>
                    <View>
                      <Text style={[styles.schoolLevelOptionTitle, schoolLevel === level && styles.schoolLevelOptionTitleActive]}>{level}</Text>
                      <Text style={styles.schoolLevelOptionDesc}>
                        {level === 'PRIMARY' ? 'Grades 1-7, competency-based lower, 35% pass' : level === 'SECONDARY' ? 'Grades 8-12, standard percentage, 50% pass' : 'Both primary and secondary levels'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.cancelBtn, updatingSchoolLevel && styles.btnDisabled]}
                onPress={() => setShowSchoolSettingModal(false)}
                disabled={updatingSchoolLevel}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.saveBtn, updatingSchoolLevel && styles.savingBtn]}
                onPress={handleUpdateSchoolLevel}
                disabled={updatingSchoolLevel}
              >
                {updatingSchoolLevel ? (
                  <View style={styles.savingRow}>
                    <ActivityIndicator size="small" color={colors.white} />
                    <Text style={styles.saveBtnText}>  Saving...</Text>
                  </View>
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
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
  centeredState: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  loadingText: { textAlign: 'center', color: colors.textLight, fontSize: 14, marginTop: spacing.md },
  emptyBox: { alignItems: 'center', marginTop: 40, paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyDesc: { fontSize: 14, color: colors.textLight, marginTop: spacing.xs, textAlign: 'center' },
  emptyText: { fontSize: 14, color: colors.textLight, textAlign: 'center', paddingVertical: spacing.lg },

  defaultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    ...shadows.card,
  },
  defaultBannerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  defaultBannerIcon: { fontSize: 24, marginRight: spacing.md },
  defaultBannerLabel: { fontSize: 11, fontWeight: '600', color: colors.textLight, textTransform: 'uppercase' },
  defaultBannerName: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 2 },
  schoolLevelBtn: {
    backgroundColor: colors.infoLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  schoolLevelBtnText: { fontSize: 12, fontWeight: '600', color: colors.info },

  systemCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  systemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  systemHeaderLeft: { flex: 1, marginRight: spacing.sm },
  systemName: { fontSize: 16, fontWeight: '700', color: colors.text },
  systemDesc: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  systemBadges: { flexDirection: 'row', gap: spacing.xs },
  defaultBadge: { backgroundColor: colors.warningLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full },
  defaultBadgeText: { fontSize: 11, fontWeight: '700', color: colors.accentDark },
  scaleCountBadge: { backgroundColor: colors.infoLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full },
  scaleCountText: { fontSize: 11, fontWeight: '600', color: colors.info },

  scalesPreview: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight },
  scalesPreviewLabel: { fontSize: 11, fontWeight: '600', color: colors.textLight, textTransform: 'uppercase', marginBottom: spacing.xs },
  previewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  previewChip: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    minWidth: 50,
  },
  previewChipFirst: { marginLeft: 0 },
  previewChipGrade: { fontSize: 14, fontWeight: '700', color: colors.text },
  previewChipRange: { fontSize: 10, color: colors.textLight },

  systemActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, backgroundColor: colors.infoLight },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: colors.info },
  setDefaultBtn: { backgroundColor: colors.warningLight },
  setDefaultBtnText: { fontSize: 13, fontWeight: '600', color: colors.accentDark },
  editBtn: { backgroundColor: colors.primary },
  actionBtnWhite: { fontSize: 13, fontWeight: '600', color: colors.white },
  deleteBtn: { backgroundColor: colors.error },
  btnDisabled: { opacity: 0.5 },

  tableContainer: { marginTop: spacing.sm },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: colors.border, paddingBottom: spacing.sm, marginBottom: spacing.xs },
  tableHeaderCompact: { paddingBottom: spacing.xs },
  tableHeaderText: { fontSize: 11, fontWeight: '700', color: colors.textLight, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  tableRowAlt: { backgroundColor: colors.borderLight + '40' },
  tableRowCompact: { paddingVertical: spacing.xs },
  tableCell: { fontSize: 13, color: colors.text },
  tableCellBold: { fontSize: 13, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.md },
  modalContent: { backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.xl, maxHeight: '80%' },
  modalContentLarge: { maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  modalSubtitle: { fontSize: 13, color: colors.textLight, marginTop: 4 },
  tableSectionTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm, marginTop: spacing.sm },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg },
  cancelBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.border },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.text },
  saveBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.primary, minWidth: 90, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: colors.white },
  editModalBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.primary },
  setDefaultModalBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.warningLight },
  setDefaultModalBtnText: { fontSize: 14, fontWeight: '600', color: colors.accentDark },
  savingBtn: { backgroundColor: colors.primaryLight || '#7C9EE0', opacity: 0.8 },
  savingRow: { flexDirection: 'row', alignItems: 'center' },

  formGroup: { marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.white,
  },
  typeRow: { flexDirection: 'row', gap: spacing.sm },
  typeChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
  typeChipTextActive: { color: colors.white },

  scalesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  addScaleBtn: { backgroundColor: colors.successLight, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
  addScaleBtnText: { fontSize: 12, fontWeight: '600', color: colors.success },

  scaleTableHeader: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: colors.border, paddingBottom: spacing.xs, marginBottom: spacing.xs },
  scaleTableHeaderText: { fontSize: 10, fontWeight: '700', color: colors.textLight, textTransform: 'uppercase' },
  scaleEditRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  scaleEditRowAlt: { backgroundColor: colors.borderLight + '40', borderRadius: borderRadius.sm },
  scaleInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.white,
  },
  removeScaleBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  removeScaleBtnText: { fontSize: 16, fontWeight: '700', color: colors.error },

  schoolLevelDesc: { fontSize: 13, color: colors.textLight, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 18 },
  schoolLevelOptions: { gap: spacing.sm },
  schoolLevelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  schoolLevelOptionActive: { borderColor: colors.primary, backgroundColor: colors.infoLight + '30' },
  schoolLevelOptionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, marginRight: spacing.md, alignItems: 'center', justifyContent: 'center' },
  radioOuterActive: { borderColor: colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  schoolLevelOptionTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  schoolLevelOptionTitleActive: { color: colors.primary },
  schoolLevelOptionDesc: { fontSize: 12, color: colors.textLight, marginTop: 2 },
});
