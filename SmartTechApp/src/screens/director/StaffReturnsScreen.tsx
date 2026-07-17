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
  const [newProfile, setNewProfile] = useState({
    teacherName: '', employeeNumber: '', gender: '', substantivePosition: '',
    province: '', district: '', station: '', emailAddress: '', phoneNumber: '',
  });

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
    if (!newProfile.teacherName) { Alert.alert('Error', 'Teacher name is required'); return; }
    try {
      if (editingProfile) {
        await apiService.updateStaffRecordProfile(editingProfile.id, newProfile);
        Alert.alert('Success', 'Profile updated');
      } else {
        await apiService.createStaffRecordProfile(newProfile);
        Alert.alert('Success', 'Profile created');
      }
      setShowProfileModal(false);
      setEditingProfile(null);
      setNewProfile({ teacherName: '', employeeNumber: '', gender: '', substantivePosition: '', province: '', district: '', station: '', emailAddress: '', phoneNumber: '' });
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save profile');
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
      <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingProfile(null); setNewProfile({ teacherName: '', employeeNumber: '', gender: '', substantivePosition: '', province: '', district: '', station: '', emailAddress: '', phoneNumber: '' }); setShowProfileModal(true); }}>
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
              <TouchableOpacity style={styles.editBtn} onPress={() => { setEditingProfile(profile); setNewProfile({ teacherName: profile.teacherName || '', employeeNumber: profile.employeeNumber || '', gender: profile.gender || '', substantivePosition: profile.substantivePosition || '', province: profile.province || '', district: profile.district || '', station: profile.station || '', emailAddress: profile.emailAddress || '', phoneNumber: profile.phoneNumber || '' }); setShowProfileModal(true); }}>
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

      {/* Profile Modal */}
      <Modal visible={showProfileModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editingProfile ? 'Edit Profile' : 'New Profile'}</Text>
              <TextInput style={styles.modalInput} placeholder="Teacher name *" value={newProfile.teacherName} onChangeText={v => setNewProfile(p => ({ ...p, teacherName: v }))} />
              <TextInput style={styles.modalInput} placeholder="Employee number" value={newProfile.employeeNumber} onChangeText={v => setNewProfile(p => ({ ...p, employeeNumber: v }))} />
              <TextInput style={styles.modalInput} placeholder="Gender" value={newProfile.gender} onChangeText={v => setNewProfile(p => ({ ...p, gender: v }))} />
              <TextInput style={styles.modalInput} placeholder="Substantive position" value={newProfile.substantivePosition} onChangeText={v => setNewProfile(p => ({ ...p, substantivePosition: v }))} />
              <TextInput style={styles.modalInput} placeholder="Province" value={newProfile.province} onChangeText={v => setNewProfile(p => ({ ...p, province: v }))} />
              <TextInput style={styles.modalInput} placeholder="District" value={newProfile.district} onChangeText={v => setNewProfile(p => ({ ...p, district: v }))} />
              <TextInput style={styles.modalInput} placeholder="Station" value={newProfile.station} onChangeText={v => setNewProfile(p => ({ ...p, station: v }))} />
              <TextInput style={styles.modalInput} placeholder="Email address" value={newProfile.emailAddress} onChangeText={v => setNewProfile(p => ({ ...p, emailAddress: v }))} keyboardType="email-address" />
              <TextInput style={styles.modalInput} placeholder="Phone number" value={newProfile.phoneNumber} onChangeText={v => setNewProfile(p => ({ ...p, phoneNumber: v }))} keyboardType="phone-pad" />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowProfileModal(false); setEditingProfile(null); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
                  <Text style={styles.saveBtnText}>{editingProfile ? 'Update' : 'Create'}</Text>
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.lg, textAlign: 'center' },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.md, fontSize: 15, marginBottom: spacing.md, color: colors.text },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  cancelBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.background, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  saveBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.primary, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
});
