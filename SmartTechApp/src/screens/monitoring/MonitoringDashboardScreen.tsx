import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';
import { useAuthStore } from '../../store';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HierarchyData, Department, MonitoringChain } from '../../types';

interface MonitoringProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

interface TeacherAssessmentStatus {
  teacherId: string;
  teacherName: string;
  teacherRole: string;
  deptName: string;
  pendingCount: number;
  completionRate: number;
  totalAssessments: number;
}

export const MonitoringDashboardScreen: React.FC<MonitoringProps> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const user = useAuthStore((s) => s.user);
  const [hierarchy, setHierarchy] = useState<HierarchyData | null>(null);
  const [monitoringChain, setMonitoringChain] = useState<MonitoringChain | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teacherStatuses, setTeacherStatuses] = useState<TeacherAssessmentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'departments' | 'chain' | 'assessments'>('overview');

  const loadData = useCallback(async () => {
    try {
      const [h, m, d] = await Promise.all([
        apiService.getStaffHierarchy().catch(() => null),
        apiService.getMyMonitoringChain().catch(() => null),
        apiService.getDepartments().catch(() => []),
      ]);
      setHierarchy(h);
      setMonitoringChain(m);
      setDepartments(d);
      if (m?.supervises?.length) loadTeacherAssessmentStatus(m.supervises);
    } catch (err) {
      console.error('Failed to load monitoring data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadTeacherAssessmentStatus = async (supervises: any[]) => {
    setAssessmentsLoading(true);
    try {
      let pendingData: any[] = [];
      try {
        const pendingRes = await apiService.getPendingAssessments();
        pendingData = Array.isArray(pendingRes) ? pendingRes : pendingRes?.data || pendingRes?.pending || [];
      } catch (e) {
        console.warn('Failed to fetch pending assessments:', e);
      }

      const statuses: TeacherAssessmentStatus[] = [];
      for (const s of supervises) {
        const teacherId = s.teacher?.id;
        const teacherName = `${s.teacher?.user?.firstName || ''} ${s.teacher?.user?.lastName || ''}`.trim();
        if (!teacherId) continue;

        const teacherPending = pendingData.filter((p: any) => p.teacherId === teacherId || p.teacherName === teacherName);
        const total = teacherPending.length;
        const completed = teacherPending.filter((p: any) => p.completionRate >= 100).length;
        const avgRate = total > 0 ? teacherPending.reduce((sum: number, p: any) => sum + (p.completionRate || 0), 0) / total : 100;

        statuses.push({
          teacherId,
          teacherName,
          teacherRole: s.positionType?.replace(/_/g, ' ') || 'Teacher',
          deptName: s.department?.name || '—',
          pendingCount: teacherPending.filter((p: any) => p.missingCount > 0).length,
          completionRate: Math.round(avgRate),
          totalAssessments: total,
        });
      }
      setTeacherStatuses(statuses);
    } catch (err) {
      console.error('Failed to load teacher assessment status:', err);
    } finally {
      setAssessmentsLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const isDirector = user?.roles?.some((r) => r === 'Director' || r === 'DIRECTOR');
  const isDeputyDirector = user?.roles?.some((r) => r === 'Deputy Director' || r === 'DEPUTY_DIRECTOR');
  const isHod = user?.roles?.some((r) => r === 'HOD' || r === 'HEAD_OF_DEPARTMENT');

  const getSupervisorLabel = (posType?: string) => {
    if (posType === 'LOWER_PRIMARY_SENIOR_TEACHER') return 'Lower Primary Senior Teacher';
    if (posType === 'UPPER_PRIMARY_SENIOR_TEACHER') return 'Upper Primary Senior Teacher';
    return 'HOD';
  };

  const supervisedTeacherCount = monitoringChain?.supervises?.length || 0;
  const activeDeptCount = departments.filter((d) => d.isActive).length;
  const totalTeachers = hierarchy?.departments?.reduce((sum, d) => sum + (d.members?.length || 0), 0) || 0;
  const avgCompletion = teacherStatuses.length > 0
    ? Math.round(teacherStatuses.reduce((sum, s) => sum + s.completionRate, 0) / teacherStatuses.length)
    : 0;
  const totalPendingAssessments = teacherStatuses.reduce((sum, s) => sum + s.pendingCount, 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <HeaderBar title="Staff Monitoring" leftIcon={onToggleDrawer ? { name: '☰', onPress: onToggleDrawer } : undefined} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading monitoring data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderAssessmentTab = () => (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
    >
      <Text style={styles.greeting}>Assessment Oversight</Text>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.infoLight }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{supervisedTeacherCount}</Text>
          <Text style={styles.statLabel}>Teachers</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: totalPendingAssessments > 0 ? colors.warningLight : colors.successLight }]}>
          <Text style={[styles.statValue, { color: totalPendingAssessments > 0 ? colors.warning : colors.success }]}>{totalPendingAssessments}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: avgCompletion >= 80 ? colors.successLight : avgCompletion >= 50 ? colors.warningLight : colors.errorLight }]}>
          <Text style={[styles.statValue, { color: avgCompletion >= 80 ? colors.success : avgCompletion >= 50 ? colors.warning : colors.error }]}>{avgCompletion}%</Text>
          <Text style={styles.statLabel}>Avg Complete</Text>
        </View>
      </View>

      {assessmentsLoading ? (
        <ActivityIndicator color={colors.primary} style={{ paddingVertical: 40 }} />
      ) : teacherStatuses.length === 0 ? (
        <WidgetCard title="📋 Assessment Status">
          <Text style={styles.emptyText}>No supervised teachers found. Assessment tracking will appear once teachers are assigned to your department.</Text>
        </WidgetCard>
      ) : (
        <WidgetCard title="📋 Teacher Assessment Status">
          {teacherStatuses.map((t, i) => {
            const rateColor = t.completionRate >= 80 ? colors.success : t.completionRate >= 50 ? colors.warning : colors.error;
            const rateBg = t.completionRate >= 80 ? colors.successLight : t.completionRate >= 50 ? colors.warningLight : colors.errorLight;
            return (
              <TouchableOpacity key={i} style={styles.statusRow} onPress={() => stackNavigation?.navigate('TeacherAssessmentDetail', { teacherId: t.teacherId, teacherName: t.teacherName })}>
                <View style={styles.statusHeader}>
                  <View style={[styles.avatarCircle, { backgroundColor: rateBg }]}>
                    <Text style={[styles.avatarText, { color: rateColor }]}>
                      {t.teacherName?.[0] || '?'}
                    </Text>
                  </View>
                  <View style={styles.statusInfo}>
                    <Text style={styles.statusName}>{t.teacherName}</Text>
                    <Text style={styles.statusRole}>{t.teacherRole} — {t.deptName}</Text>
                    <Text style={styles.statusMeta}>{t.totalAssessments} assessments · {t.pendingCount} pending</Text>
                  </View>
                  <View style={[styles.completionBadge, { backgroundColor: rateBg }]}>
                    <Text style={[styles.completionText, { color: rateColor }]}>{t.completionRate}%</Text>
                  </View>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${Math.min(t.completionRate, 100)}%`, backgroundColor: rateColor }]} />
                </View>
              </TouchableOpacity>
            );
          })}
        </WidgetCard>
      )}

      <TouchableOpacity
        style={styles.actionCard}
        onPress={() => stackNavigation?.navigate('PendingAssessments')}
      >
        <Text style={styles.actionCardText}>📋 View All Pending Assessments</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderOverviewTab = () => (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
    >
      <Text style={styles.greeting}>
        {(isDirector || isDeputyDirector) ? 'School Leadership Overview' : 'My Department Overview'}
      </Text>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.successLight }]}>
          <Text style={[styles.statValue, { color: colors.success }]}>{activeDeptCount}</Text>
          <Text style={styles.statLabel}>Departments</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.infoLight }]}>
          <Text style={[styles.statValue, { color: colors.primaryLight }]}>{totalTeachers}</Text>
          <Text style={styles.statLabel}>Teachers</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.purpleLight }]}>
          <Text style={[styles.statValue, { color: colors.purple }]}>{supervisedTeacherCount}</Text>
          <Text style={styles.statLabel}>Under Me</Text>
        </View>
      </View>

      {(isDirector || isDeputyDirector) && hierarchy && (
        <WidgetCard title="🗺️ Organisation Structure">
          <View style={styles.orgContainer}>
            {hierarchy.director && (
              <View style={styles.orgNode}>
                <View style={styles.orgBadge}><Text style={styles.orgBadgeText}>Director</Text></View>
                <Text style={styles.orgName}>{hierarchy.director.teacher?.user?.firstName} {hierarchy.director.teacher?.user?.lastName}</Text>
              </View>
            )}
            {hierarchy.deputyDirector && hierarchy.deputyDirector.length > 0 && (
              <>
                <View style={styles.orgConnector} />
                {hierarchy.deputyDirector.map((dd, i) => (
                  <View key={i} style={styles.orgNode}>
                    <View style={[styles.orgBadge, { backgroundColor: colors.warningLight }]}><Text style={[styles.orgBadgeText, { color: colors.warning }]}>Deputy Director</Text></View>
                    <Text style={styles.orgName}>{dd.teacher?.user?.firstName} {dd.teacher?.user?.lastName}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
          <Text style={styles.sectionTitle}>Departments</Text>
          {hierarchy.departments?.filter(d => d.hod).map((dept, i) => (
            <TouchableOpacity key={i} style={styles.deptRow} onPress={() => stackNavigation?.navigate('DepartmentTeachers', { departmentId: dept.department.id, departmentName: dept.department.name })}>
              <View style={styles.deptInfo}>
                <Text style={styles.deptName}>{dept.department.name}</Text>
                <Text style={styles.deptDetail}>{getSupervisorLabel(dept.hod?.positionType)}: {dept.hod?.teacher?.user?.firstName} {dept.hod?.teacher?.user?.lastName}</Text>
                <Text style={styles.deptDetail}>{dept.members?.length || 0} teachers</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          ))}
        </WidgetCard>
      )}

      {isHod && monitoringChain && (
        <WidgetCard title="👥 My Supervision">
          <Text style={styles.supervisionHeader}>You supervise {supervisedTeacherCount} teacher{supervisedTeacherCount !== 1 ? 's' : ''}</Text>
          {monitoringChain.supervises?.map((item, i) => (
            <View key={i} style={styles.superviseeRow}>
              <View style={styles.avatarCircle}><Text style={styles.avatarText}>{item.teacher?.user?.firstName?.[0]}{item.teacher?.user?.lastName?.[0]}</Text></View>
              <View style={styles.superviseeInfo}>
                <Text style={styles.superviseeName}>{item.teacher?.user?.firstName} {item.teacher?.user?.lastName}</Text>
                <Text style={styles.superviseeRole}>{item.positionType}</Text>
              </View>
            </View>
          ))}
          {(!monitoringChain.supervises || monitoringChain.supervises.length === 0) && (
            <Text style={styles.emptyText}>No teachers assigned to your department yet.</Text>
          )}
        </WidgetCard>
      )}

      {monitoringChain?.supervisedBy && monitoringChain.supervisedBy.length > 0 && (
        <WidgetCard title="📋 Reports To">
          {monitoringChain.supervisedBy.map((item, i) => (
            <View key={i} style={styles.superviseeRow}>
              <View style={[styles.avatarCircle, { backgroundColor: colors.warningLight }]}><Text style={[styles.avatarText, { color: colors.warning }]}>{item.teacher?.user?.firstName?.[0]}{item.teacher?.user?.lastName?.[0]}</Text></View>
              <View style={styles.superviseeInfo}>
                <Text style={styles.superviseeName}>{item.teacher?.user?.firstName} {item.teacher?.user?.lastName}</Text>
                <Text style={styles.superviseeRole}>{item.positionType} — {item.department?.name}</Text>
              </View>
            </View>
          ))}
        </WidgetCard>
      )}

      {isHod && (
        <TouchableOpacity style={styles.actionCard} onPress={() => {
          const myDept = monitoringChain?.supervises?.[0]?.department;
          if (myDept) { stackNavigation?.navigate('DepartmentTeachers', { departmentId: myDept.id, departmentName: myDept.name }); }
          else { const allDepts = hierarchy?.departments || []; }
        }}>
          <Text style={styles.actionCardText}>📋 View My Department Teachers</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );

  const renderDepartmentsTab = () => (
    <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}>
      {departments.map((dept, i) => (
        <TouchableOpacity key={i} style={styles.deptCard} onPress={() => stackNavigation?.navigate('DepartmentTeachers', { departmentId: dept.id, departmentName: dept.name })}>
          <View style={styles.deptCardHeader}>
            <Text style={styles.deptCardName}>{dept.name}</Text>
            {!dept.isActive && <View style={styles.inactiveBadge}><Text style={styles.inactiveBadgeText}>Inactive</Text></View>}
          </View>
          {dept.code && <Text style={styles.deptCardCode}>{dept.code}</Text>}
          <View style={styles.deptCardStats}>
            <Text style={styles.deptCardStat}>{dept._count?.teachers || 0} teachers</Text>
            <Text style={styles.deptCardStat}>{dept._count?.positions || 0} positions</Text>
          </View>
          {dept.description && <Text style={styles.deptCardDesc}>{dept.description}</Text>}
        </TouchableOpacity>
      ))}
      {departments.length === 0 && <Text style={styles.emptyText}>No departments found.</Text>}
    </ScrollView>
  );

  const renderChainTab = () => (
    <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}>
      <WidgetCard title="My Positions">
        {monitoringChain?.positions?.map((p, i) => (
          <View key={i} style={styles.positionRow}>
            <Text style={styles.positionBadge}>{p.positionType.replace(/_/g, ' ')}</Text>
            {p.isPrimary && <Text style={styles.primaryBadge}>Primary</Text>}
          </View>
        ))}
        {(!monitoringChain?.positions || monitoringChain.positions.length === 0) && <Text style={styles.emptyText}>No positions assigned.</Text>}
      </WidgetCard>
      <WidgetCard title="My Supervision Chain">
        <View style={styles.chainContainer}>
          <Text style={styles.chainLabel}>Supervises ({supervisedTeacherCount})</Text>
          {monitoringChain?.supervises?.map((item, i) => (
            <View key={i} style={styles.chainItem}>
              <Text style={styles.chainName}>{item.teacher?.user?.firstName} {item.teacher?.user?.lastName}</Text>
              <Text style={styles.chainRole}>{item.positionType}</Text>
            </View>
          ))}
        </View>
        <View style={styles.chainDivider} />
        <View style={styles.chainContainer}>
          <Text style={styles.chainLabel}>Reports To ({monitoringChain?.supervisedBy?.length || 0})</Text>
          {monitoringChain?.supervisedBy?.map((item, i) => (
            <View key={i} style={styles.chainItem}>
              <Text style={styles.chainName}>{item.teacher?.user?.firstName} {item.teacher?.user?.lastName}</Text>
              <Text style={styles.chainRole}>{item.positionType}</Text>
            </View>
          ))}
        </View>
      </WidgetCard>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Staff Monitoring"
        subtitle={isDirector ? 'Director' : isDeputyDirector ? 'Deputy Director' : isHod ? 'HOD' : 'Staff'}
        leftIcon={onToggleDrawer ? { name: '☰', onPress: onToggleDrawer } : { name: '←', onPress: () => stackNavigation?.goBack?.() }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <View style={styles.tabBar}>
        {[{ key: 'overview', label: 'Overview' }, { key: 'assessments', label: 'Assessments' }, { key: 'departments', label: 'Departments' }, { key: 'chain', label: 'Chain' }].map((tab) => (
          <TouchableOpacity key={tab.key} style={[styles.tab, activeTab === tab.key && styles.activeTab]} onPress={() => setActiveTab(tab.key as any)}>
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'assessments' && renderAssessmentTab()}
      {activeTab === 'departments' && renderDepartmentsTab()}
      {activeTab === 'chain' && renderChainTab()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing.md, color: colors.textLight, fontSize: 14 },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  greeting: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { flex: 1, padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 12, color: colors.textLight, marginTop: spacing.xs },
  orgContainer: { alignItems: 'center', paddingVertical: spacing.sm },
  orgNode: { alignItems: 'center', marginVertical: spacing.xs },
  orgBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
  orgBadgeText: { color: colors.white, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  orgName: { fontSize: 14, color: colors.text, marginTop: spacing.xs, fontWeight: '500' },
  orgConnector: { width: 2, height: 20, backgroundColor: colors.border },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  deptRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  deptInfo: { flex: 1 },
  deptName: { fontSize: 15, fontWeight: '600', color: colors.text },
  deptDetail: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  arrow: { fontSize: 24, color: colors.textMuted },
  supervisionHeader: { fontSize: 14, color: colors.textLight, marginBottom: spacing.sm },
  superviseeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.infoLight, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
  avatarText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  superviseeInfo: { flex: 1 },
  superviseeName: { fontSize: 14, fontWeight: '500', color: colors.text },
  superviseeRole: { fontSize: 12, color: colors.textLight },
  emptyText: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg, fontSize: 14 },
  actionCard: { backgroundColor: colors.primaryLight, padding: spacing.lg, borderRadius: borderRadius.md, marginTop: spacing.lg, alignItems: 'center' },
  actionCardText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  deptCard: { backgroundColor: colors.white, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm, ...shadows.sm },
  deptCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deptCardName: { fontSize: 16, fontWeight: '600', color: colors.text },
  inactiveBadge: { backgroundColor: colors.errorLight, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  inactiveBadgeText: { fontSize: 10, color: colors.error, fontWeight: '600' },
  deptCardCode: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  deptCardStats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  deptCardStat: { fontSize: 13, color: colors.textLight },
  deptCardDesc: { fontSize: 13, color: colors.textLight, marginTop: spacing.sm },
  tabBar: { flexDirection: 'row', backgroundColor: colors.white, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: borderRadius.sm },
  activeTab: { backgroundColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '500', color: colors.textLight },
  activeTabText: { color: colors.white, fontWeight: '600' },
  positionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
  positionBadge: { backgroundColor: colors.infoLight, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, fontSize: 12, fontWeight: '600', color: colors.primary, marginRight: spacing.sm },
  primaryBadge: { backgroundColor: colors.successLight, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm, fontSize: 10, fontWeight: '600', color: colors.success },
  chainContainer: { paddingVertical: spacing.xs },
  chainLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  chainItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  chainName: { fontSize: 14, color: colors.text },
  chainRole: { fontSize: 12, color: colors.textLight },
  chainDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },

  // Assessment-specific styles
  statusRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  statusHeader: { flexDirection: 'row', alignItems: 'center' },
  statusInfo: { flex: 1, marginLeft: spacing.sm },
  statusName: { fontSize: 14, fontWeight: '600', color: colors.text },
  statusRole: { fontSize: 11, color: colors.textLight, marginTop: 1 },
  statusMeta: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  completionBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, minWidth: 48, alignItems: 'center' },
  completionText: { fontSize: 13, fontWeight: '700' },
  progressBarBg: { height: 4, backgroundColor: colors.borderLight, borderRadius: 2, marginTop: spacing.sm, overflow: 'hidden' },
  progressBarFill: { height: 4, borderRadius: 2 },
});
