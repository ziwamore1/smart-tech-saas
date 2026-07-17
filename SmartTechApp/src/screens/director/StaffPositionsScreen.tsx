import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface StaffPositionsProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

type Tab = 'departments' | 'positions' | 'hierarchy';

export const StaffPositionsScreen: React.FC<StaffPositionsProps> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [activeTab, setActiveTab] = useState<Tab>('departments');
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showPosModal, setShowPosModal] = useState(false);
  const [editingDept, setEditingDept] = useState<any>(null);
  const [editingPos, setEditingPos] = useState<any>(null);
  const [newDept, setNewDept] = useState({ name: '', description: '', category: '' });
  const [newPos, setNewPos] = useState({ title: '', positionType: 'TEACHING', departmentId: '', description: '' });

  const loadData = async () => {
    try {
      const [deptData, posData, hierData] = await Promise.allSettled([
        apiService.getDepartments(),
        apiService.getStaffPositions(),
        apiService.getStaffHierarchy(),
      ]);
      if (deptData.status === 'fulfilled') setDepartments(deptData.value || []);
      if (posData.status === 'fulfilled') setPositions(posData.value || []);
      if (hierData.status === 'fulfilled') setHierarchy(hierData.value);
    } catch (err) {
      console.error('Failed to load staff positions data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleRefresh = () => { setRefreshing(true); loadData(); };

  const handleSaveDept = async () => {
    if (!newDept.name) { Alert.alert('Error', 'Department name is required'); return; }
    try {
      if (editingDept) {
        await apiService.updateDepartment(editingDept.id, newDept);
        Alert.alert('Success', 'Department updated');
      } else {
        await apiService.createDepartment(newDept);
        Alert.alert('Success', 'Department created');
      }
      setShowDeptModal(false);
      setEditingDept(null);
      setNewDept({ name: '', description: '', category: '' });
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save department');
    }
  };

  const handleDeleteDept = (dept: any) => {
    Alert.alert('Delete Department', `Delete "${dept.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await apiService.deleteDepartment(dept.id); loadData(); }
        catch { Alert.alert('Error', 'Failed to delete department'); }
      }},
    ]);
  };

  const handleSavePos = async () => {
    if (!newPos.title) { Alert.alert('Error', 'Position title is required'); return; }
    try {
      if (editingPos) {
        await apiService.updateStaffPosition(editingPos.id, newPos);
        Alert.alert('Success', 'Position updated');
      } else {
        await apiService.createStaffPosition(newPos);
        Alert.alert('Success', 'Position created');
      }
      setShowPosModal(false);
      setEditingPos(null);
      setNewPos({ title: '', positionType: 'TEACHING', departmentId: '', description: '' });
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save position');
    }
  };

  const handleDeletePos = (pos: any) => {
    Alert.alert('Delete Position', `Delete "${pos.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await apiService.deleteStaffPosition(pos.id); loadData(); }
        catch { Alert.alert('Error', 'Failed to delete position'); }
      }},
    ]);
  };

  const filteredDepts = departments.filter(d =>
    d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPositions = positions.filter(p =>
    p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.positionType?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const positionTypeColors: Record<string, { bg: string; text: string }> = {
    TEACHING: { bg: colors.infoLight, text: colors.primary },
    ADMINISTRATIVE: { bg: colors.warningLight, text: colors.warning },
    LEADERSHIP: { bg: colors.successLight, text: colors.success },
    SUPPORT: { bg: colors.purpleLight, text: colors.purple },
  };

  const renderTabs = () => (
    <View style={styles.tabRow}>
      {(['departments', 'positions', 'hierarchy'] as Tab[]).map(tab => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, activeTab === tab && styles.tabActive]}
          onPress={() => setActiveTab(tab)}
        >
          <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
            {tab === 'departments' ? 'Depts' : tab === 'positions' ? 'Positions' : 'Hierarchy'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderDepartments = () => (
    <WidgetCard title={`Departments (${filteredDepts.length})`}>
      <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingDept(null); setNewDept({ name: '', description: '', category: '' }); setShowDeptModal(true); }}>
        <Text style={styles.addBtnText}>+ Add Department</Text>
      </TouchableOpacity>
      {filteredDepts.map(dept => (
        <TouchableOpacity key={dept.id} style={styles.itemCard} onLongPress={() => handleDeleteDept(dept)}>
          <View style={styles.itemHeader}>
            <View style={[styles.itemIcon, { backgroundColor: colors.primary }]}>
              <Text style={styles.itemIconText}>🏛️</Text>
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle}>{dept.name}</Text>
              {dept.description && <Text style={styles.itemSubtitle}>{dept.description}</Text>}
              {dept.category && (
                <View style={[styles.badge, { backgroundColor: colors.infoLight }]}>
                  <Text style={[styles.badgeText, { color: colors.primary }]}>{dept.category}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={() => { setEditingDept(dept); setNewDept({ name: dept.name, description: dept.description || '', category: dept.category || '' }); setShowDeptModal(true); }}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
          {dept.teacherCount !== undefined && (
            <Text style={styles.countText}>{dept.teacherCount} staff assigned</Text>
          )}
        </TouchableOpacity>
      ))}
      {filteredDepts.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🏛️</Text>
          <Text style={styles.emptyText}>No departments found</Text>
        </View>
      )}
    </WidgetCard>
  );

  const renderPositions = () => (
    <WidgetCard title={`Staff Positions (${filteredPositions.length})`}>
      <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingPos(null); setNewPos({ title: '', positionType: 'TEACHING', departmentId: '', description: '' }); setShowPosModal(true); }}>
        <Text style={styles.addBtnText}>+ Add Position</Text>
      </TouchableOpacity>
      {filteredPositions.map(pos => {
        const tc = positionTypeColors[pos.positionType] || positionTypeColors.TEACHING;
        return (
          <TouchableOpacity key={pos.id} style={styles.itemCard} onLongPress={() => handleDeletePos(pos)}>
            <View style={styles.itemHeader}>
              <View style={[styles.itemIcon, { backgroundColor: tc.bg }]}>
                <Text style={[styles.itemIconText, { color: tc.text }]}>👤</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle}>{pos.title}</Text>
                {pos.department && <Text style={styles.itemSubtitle}>{pos.department.name}</Text>}
                <View style={[styles.badge, { backgroundColor: tc.bg }]}>
                  <Text style={[styles.badgeText, { color: tc.text }]}>{pos.positionType}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.editBtn} onPress={() => { setEditingPos(pos); setNewPos({ title: pos.title, positionType: pos.positionType || 'TEACHING', departmentId: pos.departmentId || '', description: pos.description || '' }); setShowPosModal(true); }}>
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      })}
      {filteredPositions.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👤</Text>
          <Text style={styles.emptyText}>No positions found</Text>
        </View>
      )}
    </WidgetCard>
  );

  const renderHierarchy = () => (
    <WidgetCard title="Staff Hierarchy">
      {hierarchy ? (
        <View style={styles.hierarchyContainer}>
          {hierarchy.departments?.map((dept: any) => (
            <View key={dept.id} style={styles.hierarchyDept}>
              <Text style={styles.hierarchyDeptName}>🏛️ {dept.name}</Text>
              {dept.positions?.map((pos: any) => (
                <View key={pos.id} style={styles.hierarchyPos}>
                  <Text style={styles.hierarchyPosTitle}>  👤 {pos.title}</Text>
                  {pos.holders?.map((holder: any, idx: number) => (
                    <Text key={idx} style={styles.hierarchyHolder}>    • {holder.firstName} {holder.lastName}</Text>
                  ))}
                </View>
              ))}
            </View>
          ))}
          {!hierarchy.departments && (
            <Text style={styles.emptyText}>No hierarchy data available</Text>
          )}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyText}>Loading hierarchy...</Text>
        </View>
      )}
    </WidgetCard>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Staff Positions"
        subtitle={`${departments.length} Depts • ${positions.length} Positions`}
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
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {activeTab === 'departments' && renderDepartments()}
        {activeTab === 'positions' && renderPositions()}
        {activeTab === 'hierarchy' && renderHierarchy()}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* Department Modal */}
      <Modal visible={showDeptModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingDept ? 'Edit Department' : 'New Department'}</Text>
            <TextInput style={styles.modalInput} placeholder="Department name" value={newDept.name} onChangeText={v => setNewDept(p => ({ ...p, name: v }))} />
            <TextInput style={styles.modalInput} placeholder="Description (optional)" value={newDept.description} onChangeText={v => setNewDept(p => ({ ...p, description: v }))} />
            <TextInput style={styles.modalInput} placeholder="Category (optional)" value={newDept.category} onChangeText={v => setNewDept(p => ({ ...p, category: v }))} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowDeptModal(false); setEditingDept(null); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveDept}>
                <Text style={styles.saveBtnText}>{editingDept ? 'Update' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Position Modal */}
      <Modal visible={showPosModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingPos ? 'Edit Position' : 'New Position'}</Text>
            <TextInput style={styles.modalInput} placeholder="Position title" value={newPos.title} onChangeText={v => setNewPos(p => ({ ...p, title: v }))} />
            <TextInput style={styles.modalInput} placeholder="Description (optional)" value={newPos.description} onChangeText={v => setNewPos(p => ({ ...p, description: v }))} />
            <View style={styles.pickerRow}>
              <Text style={styles.pickerLabel}>Type:</Text>
              {['TEACHING', 'ADMINISTRATIVE', 'LEADERSHIP', 'SUPPORT'].map(t => (
                <TouchableOpacity key={t} style={[styles.pickerOption, newPos.positionType === t && styles.pickerOptionActive]} onPress={() => setNewPos(p => ({ ...p, positionType: t }))}>
                  <Text style={[styles.pickerOptionText, newPos.positionType === t && styles.pickerOptionTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowPosModal(false); setEditingPos(null); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSavePos}>
                <Text style={styles.saveBtnText}>{editingPos ? 'Update' : 'Create'}</Text>
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
  tabRow: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm, paddingVertical: spacing.sm },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.lg, backgroundColor: colors.white, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.white },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  searchIcon: { fontSize: 18, marginRight: spacing.sm },
  searchInput: { flex: 1, paddingVertical: spacing.md, fontSize: 15, color: colors.text },
  addBtn: { backgroundColor: colors.primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', marginBottom: spacing.md },
  addBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  itemCard: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  itemHeader: { flexDirection: 'row', alignItems: 'center' },
  itemIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  itemIconText: { fontSize: 18 },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  itemSubtitle: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.sm, alignSelf: 'flex-start', marginTop: 4 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  editBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  editBtnText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  countText: { fontSize: 12, color: colors.textLight, marginTop: 4, marginLeft: 56 },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textLight },
  hierarchyContainer: { gap: spacing.md },
  hierarchyDept: { marginBottom: spacing.md },
  hierarchyDeptName: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  hierarchyPos: { marginLeft: spacing.md, marginBottom: spacing.sm },
  hierarchyPosTitle: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  hierarchyHolder: { fontSize: 13, color: colors.textLight, marginLeft: spacing.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.lg, textAlign: 'center' },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.md, fontSize: 15, marginBottom: spacing.md, color: colors.text },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  pickerLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  pickerOption: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, backgroundColor: colors.background },
  pickerOptionActive: { backgroundColor: colors.primary },
  pickerOptionText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  pickerOptionTextActive: { color: colors.white },
  modalActions: { flexDirection: 'row', gap: spacing.md },
  cancelBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.background, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  saveBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.primary, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
});
