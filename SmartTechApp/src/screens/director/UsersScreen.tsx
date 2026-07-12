import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface DirectorUsersProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

const ROLE_OPTIONS = ['Director', 'Teacher', 'Class Teacher', 'Lower Primary Senior Teacher', 'Upper Primary Senior Teacher', 'Student', 'Parent', 'Deputy', 'Head Teacher'];

export const DirectorUsersScreen: React.FC<DirectorUsersProps> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ firstName: '', lastName: '', email: '', password: '', roles: ['Teacher'] });

  const loadUsers = async () => {
    try {
      const data = await apiService.getUsers();
      setUsers(data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const handleCreateUser = async () => {
    if (!newUser.firstName || !newUser.lastName || !newUser.email || !newUser.password) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    try {
      await apiService.createUser(newUser);
      setShowAddModal(false);
      setNewUser({ firstName: '', lastName: '', email: '', password: '', roles: ['Teacher'] });
      loadUsers();
      Alert.alert('Success', 'User created successfully');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to create user');
    }
  };

  const toggleUserStatus = async (user: any) => {
    try {
      await apiService.updateUser(user.id, { isActive: !user.isActive });
      loadUsers();
    } catch (err) {
      Alert.alert('Error', 'Failed to update user');
    }
  };

  const handleDeleteUser = (user: any) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete ${user.firstName} ${user.lastName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteUser(user.id);
              loadUsers();
              Alert.alert('Success', 'User deleted');
            } catch (err) {
              Alert.alert('Error', 'Failed to delete user');
            }
          },
        },
      ]
    );
  };

  const filtered = users.filter(
    (u) => u.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           u.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           u.roles?.some((r: string) => r.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleRole = (role: string) => {
    setNewUser(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role],
    }));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Users"
        subtitle={`${users.length} Total Users`}
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '➕', onPress: () => setShowAddModal(true) }}
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
            placeholder="Search users..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <WidgetCard title="All Users">
          {filtered.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>{user.firstName.charAt(0)}{user.lastName.charAt(0)}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.firstName} {user.lastName}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
                <Text style={styles.userRoles}>{user.roles?.join(', ') || 'No role'}</Text>
              </View>
              <View style={styles.userActions}>
                <TouchableOpacity style={[styles.actionBtn, user.isActive ? styles.deactivateBtn : styles.activateBtn]} onPress={() => toggleUserStatus(user)}>
                  <Text style={styles.actionBtnText}>{user.isActive ? 'Disable' : 'Enable'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteUser(user)}>
                  <Text style={styles.deleteBtnText}>🗑</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {filtered.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>👤</Text>
              <Text style={styles.emptyText}>No users found</Text>
            </View>
          )}
        </WidgetCard>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add New User</Text>

            <TextInput style={styles.input} placeholder="First Name" value={newUser.firstName} onChangeText={(t) => setNewUser(p => ({ ...p, firstName: t }))} />
            <TextInput style={styles.input} placeholder="Last Name" value={newUser.lastName} onChangeText={(t) => setNewUser(p => ({ ...p, lastName: t }))} />
            <TextInput style={styles.input} placeholder="Email" value={newUser.email} onChangeText={(t) => setNewUser(p => ({ ...p, email: t }))} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Password" value={newUser.password} onChangeText={(t) => setNewUser(p => ({ ...p, password: t }))} secureTextEntry />

            <Text style={styles.roleLabel}>Roles:</Text>
            <View style={styles.roleRow}>
              {ROLE_OPTIONS.map((role) => (
                <TouchableOpacity key={role} style={[styles.roleChip, newUser.roles.includes(role) && styles.roleChipActive]} onPress={() => toggleRole(role)}>
                  <Text style={[styles.roleChipText, newUser.roles.includes(role) && styles.roleChipTextActive]}>{role}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCreateBtn} onPress={handleCreateUser}>
                <Text style={styles.modalCreateText}>Create User</Text>
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
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  searchIcon: { fontSize: 18, marginRight: spacing.sm },
  searchInput: { flex: 1, paddingVertical: spacing.md, fontSize: 15, color: colors.text },
  userCard: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  userAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.purple, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  userAvatarText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '600', color: colors.text },
  userEmail: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  userRoles: { fontSize: 12, color: colors.primary, fontWeight: '500', marginTop: 2 },
  userActions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
  deactivateBtn: { backgroundColor: colors.warningLight },
  activateBtn: { backgroundColor: colors.successLight },
  actionBtnText: { fontSize: 11, fontWeight: '600', color: colors.text },
  deleteBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  deleteBtnText: { fontSize: 16 },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textLight },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xxl, borderTopRightRadius: borderRadius.xxl, padding: spacing.lg, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.lg, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: 15, color: colors.text, marginBottom: spacing.sm },
  roleLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm, marginTop: spacing.sm },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  roleChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.lg, backgroundColor: colors.background },
  roleChipActive: { backgroundColor: colors.primary },
  roleChipText: { fontSize: 12, fontWeight: '500', color: colors.textLight },
  roleChipTextActive: { color: colors.white },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.md },
  modalCancelBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  modalCancelText: { fontSize: 15, color: colors.textLight, fontWeight: '600' },
  modalCreateBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: borderRadius.lg },
  modalCreateText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
