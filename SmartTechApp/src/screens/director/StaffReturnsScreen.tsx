import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface StaffReturnsProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

type Tab = 'profiles' | 'returns' | 'overview';

const ALL_FIELDS = [
  { key: 'teacherName', label: 'Teacher Name *', type: 'text', section: 'Personal Info' },
  { key: 'employeeNumber', label: 'Employee No', type: 'text', section: 'Personal Info' },
  { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'], section: 'Personal Info' },
  { key: 'dateOfBirth', label: 'Date of Birth', type: 'date', section: 'Personal Info' },
  { key: 'maritalStatus', label: 'Marital Status', type: 'select', options: ['Single', 'Married', 'Divorced', 'Widowed'], section: 'Personal Info' },
  { key: 'nationality', label: 'Nationality', type: 'text', section: 'Personal Info' },

  { key: 'nrcNumber', label: 'NRC Number', type: 'text', section: 'IDs & Numbers' },
  { key: 'tsNumber', label: 'TS Number', type: 'text', section: 'IDs & Numbers' },
  { key: 'aesNumber', label: 'AES Number', type: 'text', section: 'IDs & Numbers' },

  { key: 'emailAddress', label: 'Email', type: 'email', section: 'Contact' },
  { key: 'phoneNumber', label: 'Phone', type: 'phone', section: 'Contact' },

  { key: 'substantivePosition', label: 'Substantive Position', type: 'text', section: 'Position' },
  { key: 'substantiveScale', label: 'Substantive Scale', type: 'text', section: 'Position' },
  { key: 'currentPosition', label: 'Current Position', type: 'text', section: 'Position' },
  { key: 'actingPosition', label: 'Acting Position', type: 'text', section: 'Position' },
  { key: 'administration', label: 'Administration', type: 'text', section: 'Position' },
  { key: 'actingType', label: 'Acting Type', type: 'text', section: 'Position' },
  { key: 'gradeLevel', label: 'Grade Level', type: 'text', section: 'Position' },
  { key: 'step', label: 'Step', type: 'text', section: 'Position' },
  { key: 'province', label: 'Province', type: 'text', section: 'Position' },
  { key: 'district', label: 'District', type: 'text', section: 'Position' },
  { key: 'station', label: 'Station', type: 'text', section: 'Position' },

  { key: 'employmentStatus', label: 'Status', type: 'select', options: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'RETIRED', 'TRANSFERRED'], section: 'Employment' },
  { key: 'employmentType', label: 'Type', type: 'select', options: ['TEACHING', 'NON_TEACHING', 'PERMANENT', 'CONTRACT', 'TEMPORARY'], section: 'Employment' },
  { key: 'dateOfFirstAppointment', label: 'First Appointment', type: 'date', section: 'Employment' },
  { key: 'dateOfPresentAppointment', label: 'Present Appointment', type: 'date', section: 'Employment' },
  { key: 'dateOfActingAppointment', label: 'Acting Appointment', type: 'date', section: 'Employment' },
  { key: 'confirmed', label: 'Confirmed', type: 'bool', section: 'Employment' },
  { key: 'expectedConfirmationDate', label: 'Expected Confirmation', type: 'date', section: 'Employment' },
  { key: 'allowancesEntitled', label: 'Allowances Entitled', type: 'text', section: 'Employment' },
  { key: 'payrollPoint', label: 'Payroll Point', type: 'text', section: 'Employment' },

  { key: 'contractEffectiveDate', label: 'Contract Effective', type: 'date', section: 'Contract' },
  { key: 'contractNormalised', label: 'Contract Normalised', type: 'bool', section: 'Contract' },
  { key: 'contractEnd', label: 'Contract End', type: 'date', section: 'Contract' },
  { key: 'retirementDate', label: 'Retirement Date', type: 'date', section: 'Contract' },

  { key: 'academicQualification', label: 'Academic Qualification', type: 'text', section: 'Qualifications' },
  { key: 'professionalQualification', label: 'Professional Qualification', type: 'text', section: 'Qualifications' },
  { key: 'yearOfQualification', label: 'Qualification Year', type: 'text', section: 'Qualifications' },
  { key: 'specialization', label: 'Specialization', type: 'text', section: 'Qualifications' },

  { key: 'taxId', label: 'Tax ID', type: 'text', section: 'Financial' },
  { key: 'pensionNumber', label: 'Pension No', type: 'text', section: 'Financial' },
  { key: 'bankName', label: 'Bank Name', type: 'text', section: 'Financial' },
  { key: 'bankBranch', label: 'Bank Branch', type: 'text', section: 'Financial' },
  { key: 'bankAccount', label: 'Bank Account', type: 'text', section: 'Financial' },
  { key: 'socialSecurityNumber', label: 'SSN', type: 'text', section: 'Financial' },

  { key: 'nextOfKin', label: 'Next of Kin', type: 'text', section: 'Emergency' },
  { key: 'nextOfKinContact', label: 'Next of Kin Contact', type: 'phone', section: 'Emergency' },
  { key: 'nextOfKinRelationship', label: 'Next of Kin Relationship', type: 'text', section: 'Emergency' },
];

const SECTIONS = ['Personal Info', 'IDs & Numbers', 'Contact', 'Position', 'Employment', 'Contract', 'Qualifications', 'Financial', 'Emergency'];

function emptyForm(): any {
  const f: any = {};
  ALL_FIELDS.forEach(field => { f[field.key] = ''; });
  f.employmentStatus = 'ACTIVE';
  f.employmentType = 'TEACHING';
  f.gender = 'Male';
  f.confirmed = 'false';
  f.contractNormalised = 'false';
  return f;
}

export const StaffReturnsScreen: React.FC<StaffReturnsProps> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm());
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [profilesRes, returnsRes, analyticsRes] = await Promise.allSettled([
        apiService.getStaffRecordProfiles(),
        apiService.getStaffRecordReturns(),
        apiService.getStaffRecordAnalytics(),
      ]);
      if (profilesRes.status === 'fulfilled') setProfiles(profilesRes.value || []);
      if (returnsRes.status === 'fulfilled') setReturns(returnsRes.value || []);
      if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value);
    } catch (err) {
      console.error('Failed to load staff records:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = () => { setRefreshing(true); loadData(); };

  const handleSaveProfile = async () => {
    if (!form.teacherName) { Alert.alert('Error', 'Teacher name is required'); return; }
    setSaving(true);
    try {
      const payload: any = {};
      ALL_FIELDS.forEach(f => {
        const val = form[f.key];
        if (val !== null && val !== undefined) {
          if (f.type === 'bool') payload[f.key] = (val === 'true' || val === true) ? 'true' : '';
          else payload[f.key] = val === '' ? null : val;
        }
      });

      if (editingProfile) {
        await apiService.updateStaffRecordProfile(editingProfile.id, payload);
        Alert.alert('Success', 'Profile updated');
      } else {
        await apiService.createStaffRecordProfile(payload);
        Alert.alert('Success', 'Profile created');
      }
      setShowProfileModal(false);
      setEditingProfile(null);
      setForm(emptyForm());
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfile = (profile: any) => {
    Alert.alert('Delete Profile', `Delete "${profile.teacherName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await apiService.deleteStaffRecordProfile(profile.id); loadData(); }
        catch { Alert.alert('Error', 'Failed to delete profile'); }
      }},
    ]);
  };

  const openCreate = () => {
    setEditingProfile(null);
    setForm(emptyForm());
    setShowProfileModal(true);
  };

  const openEdit = (profile: any) => {
    setEditingProfile(profile);
    const f: any = {};
    ALL_FIELDS.forEach(field => {
      const val = profile[field.key];
      f[field.key] = val !== null && val !== undefined ? String(val) : '';
    });
    setForm(f);
    setShowProfileModal(true);
  };

  const updateField = (key: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [key]: value }));
  };

  const filteredProfiles = profiles.filter(p =>
    p.teacherName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.employeeNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.substantivePosition?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredReturns = returns.filter(r =>
    r.teacherName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusColors: Record<string, { bg: string; text: string }> = {
    ACTIVE: { bg: colors.successLight, text: colors.success },
    PENDING: { bg: colors.warningLight, text: colors.warning },
    COMPLETED: { bg: colors.infoLight, text: colors.primaryLight },
    INACTIVE: { bg: '#F3F4F6', text: colors.textMuted },
  };

  const renderTabs = () => (
    <View style={styles.tabRow}>
      {(['overview', 'profiles', 'returns'] as Tab[]).map(tab => (
        <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
          <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
            {tab === 'overview' ? 'Overview' : tab === 'profiles' ? 'Profiles' : 'Returns'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderOverview = () => (
    <>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.infoLight }]}>
          <Text style={[styles.statValue, { color: colors.primaryLight }]}>{analytics?.totalProfiles || profiles.length}</Text>
          <Text style={styles.statLabel}>Profiles</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.successLight }]}>
          <Text style={[styles.statValue, { color: colors.success }]}>{analytics?.totalReturns || returns.length}</Text>
          <Text style={styles.statLabel}>Returns</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.warningLight }]}>
          <Text style={[styles.statValue, { color: colors.warning }]}>{analytics?.pendingReturns || 0}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.purpleLight }]}>
          <Text style={[styles.statValue, { color: colors.purple }]}>{analytics?.completedReturns || 0}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>
      <WidgetCard title="Quick Info">
        <Text style={styles.infoText}>
          The Staff Returns & HR Intelligence Hub manages staff HR profiles, returns submissions, and workforce analytics. Use the Profiles and Returns tabs to manage data.
        </Text>
      </WidgetCard>
    </>
  );

  const renderProfiles = () => (
    <WidgetCard title={`HR Profiles (${filteredProfiles.length})`}>
      <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
        <Text style={styles.addBtnText}>+ Add Profile</Text>
      </TouchableOpacity>
      {filteredProfiles.map(profile => {
        const sc = statusColors[profile.employmentStatus || 'ACTIVE'] || statusColors.ACTIVE;
        return (
          <TouchableOpacity key={profile.id} style={styles.itemCard} onLongPress={() => handleDeleteProfile(profile)}>
            <View style={styles.itemHeader}>
              <View style={[styles.itemAvatar, { backgroundColor: colors.teal }]}>
                <Text style={styles.itemAvatarText}>{(profile.teacherName || '??').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle}>{profile.teacherName}</Text>
                <Text style={styles.itemSubtitle}>{profile.employeeNumber || 'No emp#'} • {profile.substantivePosition || 'No position'}</Text>
                <View style={styles.itemMeta}>
                  {profile.gender && <Text style={styles.metaText}>{profile.gender}</Text>}
                  {profile.district && <Text style={styles.metaText}>{profile.district}</Text>}
                  <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusText, { color: sc.text }]}>{profile.employmentStatus || 'ACTIVE'}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(profile)}>
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      })}
      {filteredProfiles.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👤</Text>
          <Text style={styles.emptyText}>No profiles found</Text>
        </View>
      )}
    </WidgetCard>
  );

  const renderReturns = () => (
    <WidgetCard title={`Staff Returns (${filteredReturns.length})`}>
      {filteredReturns.map(ret => {
        const sc = statusColors[ret.status || 'PENDING'] || statusColors.PENDING;
        return (
          <View key={ret.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <View style={[styles.itemAvatar, { backgroundColor: colors.purple }]}>
                <Text style={styles.itemAvatarText}>📋</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle}>{ret.teacherName || ret.title || 'Return'}</Text>
                <Text style={styles.itemSubtitle}>{ret.type || 'General'} • {ret.period || ''}</Text>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.statusText, { color: sc.text }]}>{ret.status || 'PENDING'}</Text>
                </View>
              </View>
            </View>
          </View>
        );
      })}
      {filteredReturns.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No returns found</Text>
        </View>
      )}
    </WidgetCard>
  );

  const renderFormField = (fieldDef: typeof ALL_FIELDS[0]) => {
    const val = form[fieldDef.key] || '';

    if (fieldDef.type === 'select') {
      return (
        <View key={fieldDef.key} style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{fieldDef.label}</Text>
          <View style={styles.selectRow}>
            {(fieldDef.options || []).map(opt => (
              <TouchableOpacity
                key={opt}
                style={[styles.selectOpt, form[fieldDef.key] === opt && styles.selectOptActive]}
                onPress={() => updateField(fieldDef.key, opt)}
              >
                <Text style={[styles.selectOptText, form[fieldDef.key] === opt && styles.selectOptTextActive]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    if (fieldDef.type === 'bool') {
      return (
        <View key={fieldDef.key} style={styles.fieldGroup}>
          <TouchableOpacity style={styles.boolRow} onPress={() => updateField(fieldDef.key, val === 'true' ? 'false' : 'true')}>
            <View style={[styles.checkbox, (val === 'true' || val === true) && styles.checkboxActive]}>
              {(val === 'true' || val === true) && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.fieldLabel}>{fieldDef.label}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View key={fieldDef.key} style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{fieldDef.label}</Text>
        <TextInput
          style={styles.fieldInput}
          value={val}
          onChangeText={v => updateField(fieldDef.key, v)}
          placeholder={fieldDef.label}
          placeholderTextColor={colors.textMuted}
          keyboardType={fieldDef.type === 'email' ? 'email-address' : fieldDef.type === 'phone' ? 'phone-pad' : 'default'}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Staff Returns Hub"
        subtitle={`${profiles.length} Profiles • ${returns.length} Returns`}
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      {renderTabs()}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput style={styles.searchInput} placeholder="Search profiles & returns..." value={searchQuery} onChangeText={setSearchQuery} />
        </View>

        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'profiles' && renderProfiles()}
        {activeTab === 'returns' && renderReturns()}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <Modal visible={showProfileModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{editingProfile ? 'Edit HR Profile' : 'New HR Profile'}</Text>

              {SECTIONS.map(section => {
                const sectionFields = ALL_FIELDS.filter(f => f.section === section);
                return (
                  <View key={section} style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>{section}</Text>
                    {sectionFields.map(renderFormField)}
                  </View>
                );
              })}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowProfileModal(false); setEditingProfile(null); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                {editingProfile && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => { setShowProfileModal(false); handleDeleteProfile(editingProfile); }}>
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSaveProfile} disabled={saving}>
                  <Text style={styles.saveBtnText}>{saving ? 'Saving...' : editingProfile ? 'Update' : 'Create'}</Text>
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
  tabRow: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm, paddingVertical: spacing.sm },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.lg, backgroundColor: colors.white, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.white },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  searchIcon: { fontSize: 18, marginRight: spacing.sm },
  searchInput: { flex: 1, paddingVertical: spacing.md, fontSize: 15, color: colors.text },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { flex: 1, padding: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 12, color: colors.textLight, marginTop: 4 },
  infoText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  addBtn: { backgroundColor: colors.primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', marginBottom: spacing.md },
  addBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  itemCard: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  itemHeader: { flexDirection: 'row', alignItems: 'center' },
  itemAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  itemAvatarText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  itemSubtitle: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4, flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: colors.textMuted },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.sm },
  statusText: { fontSize: 11, fontWeight: '600' },
  editBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  editBtnText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textLight },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingTop: 80 },
  modalContent: { backgroundColor: colors.white, borderRadius: 20, padding: spacing.lg, maxHeight: '85%', marginHorizontal: spacing.md },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.md, textAlign: 'center' },
  sectionCard: { backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.primary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldGroup: { marginBottom: spacing.sm },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  fieldInput: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.sm, fontSize: 14, color: colors.text, backgroundColor: colors.white },
  selectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  selectOpt: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  selectOptActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  selectOptText: { fontSize: 12, fontWeight: '500', color: colors.textLight },
  selectOptTextActive: { color: colors.white },
  boolRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: colors.white, fontSize: 14, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, paddingBottom: spacing.lg },
  cancelBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.border, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  deleteBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.errorLight, alignItems: 'center' },
  deleteBtnText: { fontSize: 15, fontWeight: '600', color: colors.error },
  saveBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.primary, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
});
