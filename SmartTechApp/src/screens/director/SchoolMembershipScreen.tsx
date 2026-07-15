import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Modal, RefreshControl, FlatList } from 'react-native';
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

const TAB_OPTIONS = ['All', 'Teaching Staff', 'Admin', 'By Role'];
const ROLE_OPTIONS = ['Director', 'Teacher', 'Class Teacher', 'HOD', 'Accountant', 'Deputy', 'Head Teacher', 'Lower Primary Senior Teacher', 'Upper Primary Senior Teacher'];

export const SchoolMembershipScreen: React.FC<Props> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const [members, setMembers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [addSearchResults, setAddSearchResults] = useState<any[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedRole, setSelectedRole] = useState('Teacher');
  const [addingMember, setAddingMember] = useState(false);

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleMember, setRoleMember] = useState<any | null>(null);
  const [roleAction, setRoleAction] = useState<'assign' | 'remove'>('assign');
  const [assigningRole, setAssigningRole] = useState(false);

  const loadMembers = async () => {
    try {
      let data: any[];
      if (activeTab === 'All') {
        data = await apiService.getSchoolMembers();
      } else if (activeTab === 'Teaching Staff') {
        data = await apiService.getSchoolTeachingStaff();
      } else if (activeTab === 'By Role') {
        data = await apiService.getSchoolMembers();
      } else {
        data = await apiService.getSchoolMembers();
      }
      setMembers(data || []);
    } catch (err) {
      console.error('Failed to load school members:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadMembers(); }, [activeTab]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadMembers();
  };

  const filtered = members.filter((m) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      m.firstName?.toLowerCase().includes(query) ||
      m.lastName?.toLowerCase().includes(query) ||
      m.email?.toLowerCase().includes(query) ||
      m.roles?.some((r: string) => r.toLowerCase().includes(query));
    if (!matchesSearch) return false;
    if (activeTab === 'All') return true;
    if (activeTab === 'Teaching Staff') return m.roles?.some((r: string) => r.toLowerCase().includes('teacher'));
    if (activeTab === 'Admin') return m.roles?.some((r: string) => ['director', 'deputy', 'hod', 'accountant', 'head teacher'].includes(r.toLowerCase()));
    return true;
  }, members);

  const totalMembers = members.length;
  const activeCount = members.filter((m) => m.isActive !== false).length;
  const teacherCount = members.filter((m) => m.roles?.some((r: string) => r.toLowerCase().includes('teacher'))).length;
  const adminCount = members.filter((m) => m.roles?.some((r: string) => ['director', 'deputy', 'hod', 'accountant', 'head teacher'].includes(r.toLowerCase()))).length;

  const handleSearchAddMember = async (query: string) => {
    setAddSearchQuery(query);
    if (query.length < 2) {
      setAddSearchResults([]);
      setSelectedUser(null);
      return;
    }
    setAddSearching(true);
    try {
      const data = await apiService.searchUsers?.(query) || [];
      setAddSearchResults(data);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setAddSearching(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUser) {
      Alert.alert('Error', 'Please select a user');
      return;
    }
    setAddingMember(true);
    try {
      await apiService.addSchoolMember({ userId: selectedUser.id, role: selectedRole });
      setShowAddModal(false);
      setSelectedUser(null);
      setAddSearchQuery('');
      setAddSearchResults([]);
      setSelectedRole('Teacher');
      loadMembers();
      Alert.alert('Success', `${selectedUser.firstName || selectedUser.name} added to school`);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = (member: any) => {
    Alert.alert(
      'Remove Member',
      `Remove ${member.firstName || member.name} ${member.lastName || ''} from the school?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.removeSchoolMember(member.userId || member.id);
              loadMembers();
              Alert.alert('Success', 'Member removed');
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const openRoleModal = (member: any, action: 'assign' | 'remove') => {
    setRoleMember(member);
    setRoleAction(action);
    setShowRoleModal(true);
  };

  const handleAssignRole = async (role: string) => {
    if (!roleMember) return;
    setAssigningRole(true);
    try {
      if (roleAction === 'assign') {
        await apiService.assignSchoolRole({ userId: roleMember.userId || roleMember.id, role });
        Alert.alert('Success', `Role "${role}" assigned`);
      } else {
        await apiService.removeSchoolRole({ userId: roleMember.userId || roleMember.id, role });
        Alert.alert('Success', `Role "${role}" removed`);
      }
      setShowRoleModal(false);
      loadMembers();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update role');
    } finally {
      setAssigningRole(false);
    }
  };

  const renderMemberCard = (member: any) => (
    <View key={member.id || member.userId} style={styles.memberCard}>
      <View style={styles.memberTop}>
        <View style={styles.memberAvatar}>
          <Text style={styles.memberAvatarText}>
            {(member.firstName || member.name || '?').charAt(0)}{(member.lastName || '').charAt(0)}
          </Text>
        </View>
        <View style={styles.memberInfo}>
          <View style={styles.memberNameRow}>
            <Text style={styles.memberName}>{member.firstName || member.name} {member.lastName || ''}</Text>
            {member.isActive !== false ? (
              <View style={styles.activeDot} />
            ) : (
              <View style={styles.inactiveDot} />
            )}
          </View>
          <Text style={styles.memberEmail}>{member.email}</Text>
          <View style={styles.roleChipRow}>
            {member.roles?.map((role: string, idx: number) => (
              <View key={idx} style={styles.roleChip}>
                <Text style={styles.roleChipText}>{role}</Text>
              </View>
            ))}
            {!member.roles?.length && <Text style={styles.noRoleText}>No roles</Text>}
          </View>
        </View>
      </View>

      <View style={styles.memberActions}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.memberActionBtn, styles.assignRoleBtn]}
          onPress={() => openRoleModal(member, 'assign')}
        >
          <Text style={styles.assignRoleBtnText}>+ Role</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.memberActionBtn, styles.removeRoleBtn]}
          onPress={() => openRoleModal(member, 'remove')}
        >
          <Text style={styles.removeRoleBtnText}>- Role</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.memberActionBtn, styles.removeMemberBtn]}
          onPress={() => handleRemoveMember(member)}
        >
          <Text style={styles.removeMemberBtnText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="School Membership"
        subtitle={`${totalMembers} Members`}
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '➕', onPress: () => setShowAddModal(true) }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.infoLight }]}>
            <Text style={[styles.statValue, { color: colors.primaryLight }]}>{totalMembers}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.statValue, { color: colors.success }]}>{activeCount}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.tealLight || '#E0F7F6' }]}>
            <Text style={[styles.statValue, { color: colors.teal }]}>{teacherCount}</Text>
            <Text style={styles.statLabel}>Teachers</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.purpleLight }]}>
            <Text style={[styles.statValue, { color: colors.purple }]}>{adminCount}</Text>
            <Text style={styles.statLabel}>Admin</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          {TAB_OPTIONS.map((tab) => (
            <TouchableOpacity
              key={tab}
              activeOpacity={0.7}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search members by name, email, role..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading members...</Text>
          </View>
        ) : (
          <WidgetCard title={`${activeTab} Members`}>
            {filtered.map((member) => renderMemberCard(member))}
            {filtered.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyText}>No members found</Text>
              </View>
            )}
          </WidgetCard>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add School Member</Text>

            <TextInput
              style={styles.input}
              placeholder="Search by email or username..."
              value={addSearchQuery}
              onChangeText={handleSearchAddMember}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {addSearching && <Text style={styles.searchingText}>Searching...</Text>}

            {selectedUser ? (
              <View style={styles.selectedUserCard}>
                <View style={styles.memberAvatarSmall}>
                  <Text style={styles.memberAvatarSmallText}>
                    {(selectedUser.firstName || selectedUser.name || '?').charAt(0)}{(selectedUser.lastName || '').charAt(0)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedUserName}>{selectedUser.firstName || selectedUser.name} {selectedUser.lastName || ''}</Text>
                  <Text style={styles.selectedUserEmail}>{selectedUser.email}</Text>
                </View>
                <TouchableOpacity onPress={() => { setSelectedUser(null); setAddSearchQuery(''); setAddSearchResults([]); }}>
                  <Text style={styles.clearSelection}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              addSearchResults.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={styles.searchResultItem}
                  onPress={() => { setSelectedUser(user); setAddSearchResults([]); setAddSearchQuery(''); }}
                >
                  <View style={styles.memberAvatarSmall}>
                    <Text style={styles.memberAvatarSmallText}>
                      {(user.firstName || user.name || '?').charAt(0)}{(user.lastName || '').charAt(0)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultName}>{user.firstName || user.name} {user.lastName || ''}</Text>
                    <Text style={styles.searchResultEmail}>{user.email}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}

            <Text style={styles.roleLabel}>Assign Initial Role:</Text>
            <View style={styles.roleRow}>
              {ROLE_OPTIONS.map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[styles.roleChip, selectedRole === role && styles.roleChipActive]}
                  onPress={() => setSelectedRole(role)}
                >
                  <Text style={[styles.roleChipText, selectedRole === role && styles.roleChipTextActive]}>{role}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCreateBtn, addingMember && styles.btnDisabled]}
                onPress={handleAddMember}
                disabled={addingMember || !selectedUser}
              >
                <Text style={styles.modalCreateText}>{addingMember ? 'Adding...' : 'Add Member'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showRoleModal} transparent animationType="slide" onRequestClose={() => setShowRoleModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              {roleAction === 'assign' ? 'Assign Role' : 'Remove Role'}
            </Text>
            {roleMember && (
              <Text style={styles.modalSubtitle}>
                {roleAction === 'assign' ? 'Add a role to' : 'Remove a role from'} {roleMember.firstName || roleMember.name} {roleMember.lastName || ''}
              </Text>
            )}

            {roleAction === 'remove' ? (
              <View style={styles.roleRow}>
                {roleMember?.roles?.map((role: string, idx: number) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.roleChip, styles.roleChipRemove]}
                    onPress={() => handleAssignRole(role)}
                    disabled={assigningRole}
                  >
                    <Text style={[styles.roleChipText, styles.roleChipRemoveText]}>{role} ✕</Text>
                  </TouchableOpacity>
                ))}
                {(!roleMember?.roles || roleMember.roles.length === 0) && (
                  <Text style={styles.emptyText}>No roles to remove</Text>
                )}
              </View>
            ) : (
              <View style={styles.roleRow}>
                {ROLE_OPTIONS.filter((role) => !roleMember?.roles?.includes(role)).map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleChip, styles.roleChipAssign]}
                    onPress={() => handleAssignRole(role)}
                    disabled={assigningRole}
                  >
                    <Text style={[styles.roleChipText, styles.roleChipAssignText]}>+ {role}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowRoleModal(false)}>
                <Text style={styles.modalCancelText}>Close</Text>
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
  scroll: { padding: spacing.md },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { flex: 1, padding: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, color: colors.textLight, marginTop: 4, fontWeight: '500' },

  tabRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md, flexWrap: 'wrap' },
  tabBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: colors.textLight },
  tabBtnTextActive: { color: colors.white },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  searchIcon: { fontSize: 18, marginRight: spacing.sm },
  searchInput: { flex: 1, paddingVertical: spacing.md, fontSize: 15, color: colors.text },

  memberCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, ...shadows.card },
  memberTop: { flexDirection: 'row', marginBottom: spacing.sm },
  memberAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  memberAvatarText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  memberInfo: { flex: 1 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  memberName: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  inactiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textMuted || '#C0C0C0' },
  memberEmail: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  roleChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  roleChip: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.sm, backgroundColor: colors.background || '#F5F5F5' },
  roleChipText: { fontSize: 11, fontWeight: '600', color: colors.text },
  noRoleText: { fontSize: 12, color: colors.textMuted || '#C0C0C0', fontStyle: 'italic' },

  memberActions: { flexDirection: 'row', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: spacing.sm },
  memberActionBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center' },
  assignRoleBtn: { backgroundColor: colors.successLight },
  assignRoleBtnText: { fontSize: 12, fontWeight: '600', color: colors.success },
  removeRoleBtn: { backgroundColor: colors.warningLight },
  removeRoleBtnText: { fontSize: 12, fontWeight: '600', color: colors.warning },
  removeMemberBtn: { backgroundColor: colors.errorLight || '#FDEAEA' },
  removeMemberBtnText: { fontSize: 12, fontWeight: '600', color: colors.error },

  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textLight },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xxl, borderTopRightRadius: borderRadius.xxl, padding: spacing.lg, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.xs, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: colors.textLight, marginBottom: spacing.lg, textAlign: 'center' },

  input: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: 15, color: colors.text, marginBottom: spacing.sm },
  searchingText: { fontSize: 13, color: colors.textLight, marginBottom: spacing.sm, fontStyle: 'italic' },

  selectedUserCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background || '#F5F5F5', padding: spacing.md, borderRadius: borderRadius.lg, marginBottom: spacing.sm },
  memberAvatarSmall: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
  memberAvatarSmallText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  selectedUserName: { fontSize: 14, fontWeight: '600', color: colors.text },
  selectedUserEmail: { fontSize: 12, color: colors.textLight },
  clearSelection: { fontSize: 18, color: colors.textLight, paddingHorizontal: spacing.sm },

  searchResultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  searchResultName: { fontSize: 14, fontWeight: '600', color: colors.text },
  searchResultEmail: { fontSize: 12, color: colors.textLight },

  roleLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm, marginTop: spacing.sm },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  roleChipActive: { backgroundColor: colors.primary },
  roleChipTextActive: { color: colors.white },
  roleChipAssign: { backgroundColor: colors.successLight },
  roleChipAssignText: { color: colors.success },
  roleChipRemove: { backgroundColor: colors.errorLight || '#FDEAEA' },
  roleChipRemoveText: { color: colors.error },

  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.md },
  modalCancelBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  modalCancelText: { fontSize: 15, color: colors.textLight, fontWeight: '600' },
  modalCreateBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: borderRadius.lg },
  modalCreateText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
});
