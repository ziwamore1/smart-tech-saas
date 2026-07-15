import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Dimensions, FlatList } from 'react-native';
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

const TABS = [
  { key: 'sheets', label: 'Result Sheets', icon: '📋' },
  { key: 'rankings', label: 'Rankings', icon: '🏆' },
  { key: 'analysis', label: 'Analysis', icon: '📊' },
] as const;

type TabKey = typeof TABS[number]['key'];

type SheetStatus = 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'PUBLISHED' | 'LOCKED';

const STATUS_CONFIG: Record<SheetStatus, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Draft', color: colors.textLight, bg: colors.borderLight },
  SUBMITTED: { label: 'Submitted', color: colors.warning, bg: colors.warningLight },
  VERIFIED: { label: 'Verified', color: colors.info, bg: colors.infoLight },
  PUBLISHED: { label: 'Published', color: colors.success, bg: colors.successLight },
  LOCKED: { label: 'Locked', color: colors.error, bg: colors.errorLight },
};

const GRADE_COLORS: Record<string, string> = {
  A: colors.success,
  'A+': colors.success,
  'A-': colors.success,
  B: '#2563EB',
  'B+': '#2563EB',
  'B-': '#2563EB',
  C: colors.accent,
  'C+': colors.accent,
  'C-': colors.accent,
  D: colors.orange,
  E: colors.error,
  F: colors.error,
};

const getGradeColor = (grade: string): string => {
  if (!grade) return colors.textLight;
  const upper = grade.toUpperCase().trim();
  return GRADE_COLORS[upper] || colors.textLight;
};

const screenWidth = Dimensions.get('window').width;

export const ResultsManagementScreen: React.FC<Props> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const [activeTab, setActiveTab] = useState<TabKey>('sheets');
  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [sheets, setSheets] = useState<any[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedSheet, setSelectedSheet] = useState<any | null>(null);
  const [sheetStudents, setSheetStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [rankings, setRankings] = useState<any[]>([]);
  const [loadingRankings, setLoadingRankings] = useState(false);

  const [analysis, setAnalysis] = useState<any | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  const [creatingSheet, setCreatingSheet] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedClassId && selectedTermId) {
      loadSheets();
    }
  }, [selectedClassId, selectedTermId]);

  useEffect(() => {
    if (selectedSheet && activeTab === 'rankings') {
      loadRankings(selectedSheet.id);
    }
    if (selectedSheet && activeTab === 'analysis') {
      loadAnalysis(selectedSheet.id);
    }
  }, [selectedSheet, activeTab]);

  const loadInitialData = async () => {
    try {
      const classData = await apiService.getClasses();
      const classList = Array.isArray(classData) ? classData : classData?.data || [];
      setClasses(classList);

      const yearData = await apiService.getAcademicYears();
      const years = Array.isArray(yearData) ? yearData : yearData?.data || [];
      const currentYear = years.find((y: any) => y.isCurrent) || years[0];
      if (currentYear) {
        const termData = await apiService.getTerms(currentYear.id);
        const termList = Array.isArray(termData) ? termData : termData?.data || [];
        setTerms(termList);
        const currentTerm = termList.find((t: any) => t.isCurrent) || termList[0];
        if (currentTerm) {
          setSelectedTermId(currentTerm.id);
        }
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  const loadSheets = async () => {
    if (!selectedClassId || !selectedTermId) return;
    setLoadingSheets(true);
    try {
      const data = await apiService.getResultSheets({ classId: selectedClassId, termId: selectedTermId });
      const sheetList = Array.isArray(data) ? data : data?.data || [];
      setSheets(sheetList);
    } catch (err) {
      console.error('Failed to load result sheets:', err);
    } finally {
      setLoadingSheets(false);
      setRefreshing(false);
    }
  };

  const loadSheetStudents = async (sheetId: string) => {
    setLoadingStudents(true);
    try {
      const data = await apiService.getSheetStudents(sheetId);
      const studentList = Array.isArray(data) ? data : data?.data || [];
      setSheetStudents(studentList);
    } catch (err) {
      console.error('Failed to load sheet students:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const loadRankings = async (sheetId: string) => {
    setLoadingRankings(true);
    try {
      const data = await apiService.getSheetRankings(sheetId, 'class');
      const rankingList = Array.isArray(data) ? data : data?.data || [];
      setRankings(rankingList);
    } catch (err) {
      console.error('Failed to load rankings:', err);
    } finally {
      setLoadingRankings(false);
    }
  };

  const loadAnalysis = async (sheetId: string) => {
    setLoadingAnalysis(true);
    try {
      const data = await apiService.getSheetAnalysis(sheetId);
      setAnalysis(data);
    } catch (err) {
      console.error('Failed to load analysis:', err);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    if (selectedClassId && selectedTermId) {
      loadSheets();
    } else {
      setRefreshing(false);
    }
  };

  const handleCreateSheet = async () => {
    if (!selectedClassId || !selectedTermId) {
      Alert.alert('Select Class & Term', 'Please select both a class and a term before creating a result sheet.');
      return;
    }
    setCreatingSheet(true);
    try {
      await apiService.createResultSheet({ classId: selectedClassId, termId: selectedTermId });
      Alert.alert('Success', 'Result sheet created successfully.');
      loadSheets();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create result sheet.');
    } finally {
      setCreatingSheet(false);
    }
  };

  const handleSheetAction = async (sheet: any, action: 'submit' | 'verify' | 'publish' | 'lock') => {
    const actionLabels: Record<string, string> = {
      submit: 'Submit',
      verify: 'Verify',
      publish: 'Publish',
      lock: 'Lock',
    };
    const actionMessages: Record<string, string> = {
      submit: 'Are you sure you want to submit this result sheet? It will be sent for verification.',
      verify: 'Are you sure you want to verify this result sheet? It will be ready for publishing.',
      publish: 'Are you sure you want to publish this result sheet? Students and parents will be able to see the results.',
      lock: 'Are you sure you want to lock this result sheet? No further changes will be possible.',
    };

    Alert.alert(
      `${actionLabels[action]} Sheet`,
      actionMessages[action],
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionLabels[action],
          style: action === 'lock' ? 'destructive' : 'default',
          onPress: async () => {
            setActionLoading(action);
            try {
              const apiMap: Record<string, () => Promise<any>> = {
                submit: () => apiService.submitResultSheet(sheet.id),
                verify: () => apiService.verifyResultSheet(sheet.id),
                publish: () => apiService.publishResultSheet(sheet.id),
                lock: () => apiService.lockResultSheet(sheet.id),
              };
              await apiMap[action]();
              Alert.alert('Success', `Result sheet ${actionLabels[action].toLowerCase()}ed successfully.`);
              loadSheets();
              if (selectedSheet?.id === sheet.id) {
                setSelectedSheet({ ...sheet, status: action.toUpperCase() });
              }
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || `Failed to ${action} sheet.`);
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleSelectSheet = (sheet: any) => {
    setSelectedSheet(sheet);
    loadSheetStudents(sheet.id);
  };

  const getNextAction = (status: SheetStatus): { action: 'submit' | 'verify' | 'publish' | 'lock'; label: string } | null => {
    switch (status) {
      case 'DRAFT': return { action: 'submit', label: 'Submit' };
      case 'SUBMITTED': return { action: 'verify', label: 'Verify' };
      case 'VERIFIED': return { action: 'publish', label: 'Publish' };
      case 'PUBLISHED': return { action: 'lock', label: 'Lock' };
      default: return null;
    }
  };

  const renderTabBar = () => (
    <View style={styles.tabRow}>
      {TABS.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          onPress={() => setActiveTab(tab.key)}
        >
          <Text style={styles.tabIcon}>{tab.icon}</Text>
          <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderSelectors = () => (
    <View style={styles.selectorsRow}>
      <View style={styles.selectorContainer}>
        <Text style={styles.selectorLabel}>Class</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {classes.map((cls) => (
            <TouchableOpacity
              key={cls.id}
              style={[styles.chip, selectedClassId === cls.id && styles.chipActive]}
              onPress={() => {
                setSelectedClassId(cls.id);
                setSelectedSheet(null);
                setSheetStudents([]);
                setRankings([]);
                setAnalysis(null);
              }}
            >
              <Text style={[styles.chipText, selectedClassId === cls.id && styles.chipTextActive]}>
                {cls.name}
              </Text>
            </TouchableOpacity>
          ))}
          {classes.length === 0 && (
            <Text style={styles.noDataText}>No classes available</Text>
          )}
        </ScrollView>
      </View>
      <View style={styles.selectorContainer}>
        <Text style={styles.selectorLabel}>Term</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {terms.map((term) => (
            <TouchableOpacity
              key={term.id}
              style={[styles.chip, selectedTermId === term.id && styles.chipActive]}
              onPress={() => {
                setSelectedTermId(term.id);
                setSelectedSheet(null);
                setSheetStudents([]);
                setRankings([]);
                setAnalysis(null);
              }}
            >
              <Text style={[styles.chipText, selectedTermId === term.id && styles.chipTextActive]}>
                {term.name}
              </Text>
            </TouchableOpacity>
          ))}
          {terms.length === 0 && (
            <Text style={styles.noDataText}>No terms available</Text>
          )}
        </ScrollView>
      </View>
    </View>
  );

  const renderStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status as SheetStatus] || STATUS_CONFIG.DRAFT;
    return (
      <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
        <Text style={[styles.statusBadgeText, { color: config.color }]}>{config.label}</Text>
      </View>
    );
  };

  const renderResultSheetsTab = () => (
    <View>
      {renderSelectors()}

      <View style={styles.sheetHeader}>
        <Text style={styles.sectionTitle}>Result Sheets</Text>
        <TouchableOpacity
          style={[styles.createBtn, creatingSheet && styles.createBtnDisabled]}
          onPress={handleCreateSheet}
          disabled={creatingSheet || !selectedClassId || !selectedTermId}
        >
          <Text style={styles.createBtnText}>{creatingSheet ? 'Creating...' : '+ New Sheet'}</Text>
        </TouchableOpacity>
      </View>

      {loadingSheets ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading result sheets...</Text>
        </View>
      ) : sheets.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No Result Sheets</Text>
          <Text style={styles.emptyDesc}>
            {selectedClassId && selectedTermId
              ? 'Create a new result sheet to get started.'
              : 'Select a class and term to view result sheets.'}
          </Text>
        </View>
      ) : (
        sheets.map((sheet) => {
          const nextAction = getNextAction(sheet.status as SheetStatus);
          const isSelected = selectedSheet?.id === sheet.id;
          return (
            <View key={sheet.id}>
              <TouchableOpacity
                style={[styles.sheetCard, isSelected && styles.sheetCardSelected]}
                onPress={() => handleSelectSheet(sheet)}
              >
                <View style={styles.sheetCardHeader}>
                  <View style={styles.sheetCardInfo}>
                    <Text style={styles.sheetCardName}>{sheet.name || 'Result Sheet'}</Text>
                    <Text style={styles.sheetCardMeta}>
                      {sheet.studentCount || sheetStudents.length || 0} students
                      {sheet.createdAt ? ` • ${new Date(sheet.createdAt).toLocaleDateString()}` : ''}
                    </Text>
                  </View>
                  {renderStatusBadge(sheet.status)}
                </View>

                <View style={styles.sheetCardActions}>
                  <TouchableOpacity style={styles.sheetViewBtn} onPress={() => handleSelectSheet(sheet)}>
                    <Text style={styles.sheetViewBtnText}>{isSelected ? 'Hide Details' : 'View Students'}</Text>
                  </TouchableOpacity>
                  {nextAction && (
                    <TouchableOpacity
                      style={[styles.sheetActionBtn, actionLoading === nextAction.action && styles.sheetActionBtnDisabled]}
                      onPress={() => handleSheetAction(sheet, nextAction.action)}
                      disabled={actionLoading !== null}
                    >
                      <Text style={styles.sheetActionBtnText}>
                        {actionLoading === nextAction.action ? 'Processing...' : nextAction.label}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>

              {isSelected && renderSheetDetails(sheet)}
            </View>
          );
        })
      )}
    </View>
  );

  const renderSheetDetails = (sheet: any) => {
    if (loadingStudents) {
      return (
        <View style={styles.detailContainer}>
          <Text style={styles.loadingText}>Loading students...</Text>
        </View>
      );
    }

    if (sheetStudents.length === 0) {
      return (
        <View style={styles.detailContainer}>
          <Text style={styles.emptyDesc}>No student data available for this sheet.</Text>
        </View>
      );
    }

    return (
      <View style={styles.detailContainer}>
        <WidgetCard title={`Students (${sheetStudents.length})`}>
          <View style={styles.studentTableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 0.4 }]}>#</Text>
            <Text style={[styles.tableHeaderCell, { flex: 2.2 }]}>Student Name</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'center' }]}>%</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.6, textAlign: 'center' }]}>Grade</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Remark</Text>
          </View>

          {sheetStudents.map((student: any, idx: number) => {
            const grade = student.grade || student.computedGrade || '—';
            const percentage = student.percentage ?? student.average ?? student.totalPercentage;
            const remark = student.remark || student.remarks || '—';
            return (
              <View key={student.id || idx} style={[styles.studentRow, idx > 0 && styles.studentRowBorder]}>
                <Text style={[styles.studentCell, { flex: 0.4, color: colors.textLight }]}>{idx + 1}</Text>
                <Text style={[styles.studentCell, { flex: 2.2 }]} numberOfLines={1}>
                  {student.name || student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unknown'}
                </Text>
                <Text style={[styles.studentCell, { flex: 0.8, textAlign: 'center', fontWeight: '600' }]}>
                  {percentage != null ? `${Number(percentage).toFixed(1)}%` : '—'}
                </Text>
                <View style={[styles.gradeCell, { flex: 0.6 }]}>
                  <Text style={[styles.gradeText, { color: getGradeColor(grade) }]}>{grade}</Text>
                </View>
                <Text style={[styles.studentCell, { flex: 1.2, color: colors.textLight }]} numberOfLines={1}>
                  {remark}
                </Text>
              </View>
            );
          })}
        </WidgetCard>
      </View>
    );
  };

  const renderRankingsTab = () => {
    if (!selectedSheet) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🏆</Text>
          <Text style={styles.emptyTitle}>Select a Result Sheet</Text>
          <Text style={styles.emptyDesc}>Go to Result Sheets tab and select a sheet to view rankings.</Text>
        </View>
      );
    }

    if (loadingRankings) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading rankings...</Text>
        </View>
      );
    }

    if (rankings.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🏆</Text>
          <Text style={styles.emptyTitle}>No Rankings Available</Text>
          <Text style={styles.emptyDesc}>Rankings will appear once the result sheet is published.</Text>
        </View>
      );
    }

    const maxPercentage = Math.max(...rankings.map((r: any) => r.percentage ?? r.average ?? r.totalPercentage ?? 0), 1);
    const gradeDistribution: Record<string, number> = {};
    rankings.forEach((r: any) => {
      const g = (r.grade || r.computedGrade || '—').toUpperCase().trim();
      gradeDistribution[g] = (gradeDistribution[g] || 0) + 1;
    });
    const distKeys = Object.keys(gradeDistribution).sort();
    const maxCount = Math.max(...Object.values(gradeDistribution), 1);

    return (
      <View>
        {renderSelectors()}

        <View style={styles.sheetBanner}>
          <Text style={styles.sheetBannerTitle}>{selectedSheet.name || 'Result Sheet'}</Text>
          {renderStatusBadge(selectedSheet.status)}
        </View>

        <WidgetCard title="Class Rankings">
          <View style={styles.rankingTableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Rank</Text>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Student</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.9, textAlign: 'center' }]}>%</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: 'center' }]}>Grade</Text>
          </View>

          {rankings.map((r: any, idx: number) => {
            const rank = r.rank || idx + 1;
            const percentage = r.percentage ?? r.average ?? r.totalPercentage;
            const grade = r.grade || r.computedGrade || '—';
            const name = r.name || r.studentName || `${r.firstName || ''} ${r.lastName || ''}`.trim() || 'Unknown';
            const isTopThree = rank <= 3;
            return (
              <View
                key={r.studentId || r.id || idx}
                style={[styles.rankingRow, idx > 0 && styles.studentRowBorder, isTopThree && styles.rankingRowTop]}
              >
                <View style={[styles.rankBadge, isTopThree && styles.rankBadgeTop]}>
                  <Text style={[styles.rankText, isTopThree && styles.rankTextTop]}>{rank}</Text>
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={[styles.studentNameText, isTopThree && styles.studentNameTop]} numberOfLines={1}>
                    {isTopThree ? '⭐ ' : ''}{name}
                  </Text>
                </View>
                <Text style={[styles.percentageText, { flex: 0.9 }]}>
                  {percentage != null ? `${Number(percentage).toFixed(1)}%` : '—'}
                </Text>
                <View style={[styles.gradeCell, { flex: 0.7 }]}>
                  <Text style={[styles.gradeText, { color: getGradeColor(grade) }]}>{grade}</Text>
                </View>
              </View>
            );
          })}
        </WidgetCard>

        <WidgetCard title="Grade Distribution">
          <View style={styles.chartContainer}>
            {distKeys.map((g) => {
              const count = gradeDistribution[g];
              const barHeight = Math.max((count / maxCount) * 140, 8);
              return (
                <View key={g} style={styles.barColumn}>
                  <Text style={styles.barCount}>{count}</Text>
                  <View style={[styles.bar, { height: barHeight, backgroundColor: getGradeColor(g) }]} />
                  <Text style={styles.barLabel}>{g}</Text>
                </View>
              );
            })}
          </View>
        </WidgetCard>
      </View>
    );
  };

  const renderAnalysisTab = () => {
    if (!selectedSheet) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>Select a Result Sheet</Text>
          <Text style={styles.emptyDesc}>Go to Result Sheets tab and select a sheet to view analysis.</Text>
        </View>
      );
    }

    if (loadingAnalysis) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading analysis...</Text>
        </View>
      );
    }

    if (!analysis) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>No Analysis Available</Text>
          <Text style={styles.emptyDesc}>Analysis data will appear once the result sheet has student data.</Text>
        </View>
      );
    }

    const classAvg = analysis.classAverage ?? analysis.averageScore ?? analysis.average ?? 0;
    const passRate = analysis.passRate ?? analysis.passPercentage ?? 0;
    const distinctionRate = analysis.distinctionRate ?? 0;
    const totalStudents = analysis.totalStudents ?? analysis.studentCount ?? 0;
    const subjectBreakdown = analysis.subjects || analysis.subjectBreakdown || [];
    const atRiskStudents = analysis.atRiskStudents || analysis.atRisk || [];
    const gradeDistribution = analysis.gradeDistribution || analysis.grades || {};
    const distKeys = Object.keys(gradeDistribution).sort();
    const maxCount = distKeys.length > 0 ? Math.max(...Object.values(gradeDistribution).map(Number), 1) : 1;

    return (
      <View>
        {renderSelectors()}

        <View style={styles.sheetBanner}>
          <Text style={styles.sheetBannerTitle}>{selectedSheet.name || 'Result Sheet'}</Text>
          {renderStatusBadge(selectedSheet.status)}
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.analysisStatCard, { backgroundColor: colors.infoLight }]}>
            <Text style={[styles.analysisStatValue, { color: colors.primaryLight }]}>{Number(classAvg).toFixed(1)}%</Text>
            <Text style={styles.analysisStatLabel}>Class Average</Text>
          </View>
          <View style={[styles.analysisStatCard, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.analysisStatValue, { color: colors.success }]}>{Number(passRate).toFixed(1)}%</Text>
            <Text style={styles.analysisStatLabel}>Pass Rate</Text>
          </View>
          <View style={[styles.analysisStatCard, { backgroundColor: colors.purpleLight }]}>
            <Text style={[styles.analysisStatValue, { color: colors.purple }]}>{Number(distinctionRate).toFixed(1)}%</Text>
            <Text style={styles.analysisStatLabel}>Distinction Rate</Text>
          </View>
          <View style={[styles.analysisStatCard, { backgroundColor: colors.warningLight }]}>
            <Text style={[styles.analysisStatValue, { color: colors.accentDark }]}>{totalStudents}</Text>
            <Text style={styles.analysisStatLabel}>Total Students</Text>
          </View>
        </View>

        {distKeys.length > 0 && (
          <WidgetCard title="Grade Distribution">
            <View style={styles.chartContainer}>
              {distKeys.map((g) => {
                const count = Number(gradeDistribution[g]);
                const barHeight = Math.max((count / maxCount) * 140, 8);
                return (
                  <View key={g} style={styles.barColumn}>
                    <Text style={styles.barCount}>{count}</Text>
                    <View style={[styles.bar, { height: barHeight, backgroundColor: getGradeColor(g) }]} />
                    <Text style={styles.barLabel}>{g}</Text>
                  </View>
                );
              })}
            </View>
          </WidgetCard>
        )}

        {subjectBreakdown.length > 0 && (
          <WidgetCard title="Subject Breakdown">
            <View style={styles.subjectTableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Subject</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Average</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Highest</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Lowest</Text>
            </View>
            {subjectBreakdown.map((sub: any, idx: number) => (
              <View key={sub.subjectId || sub.id || idx} style={[styles.subjectRow, idx > 0 && styles.studentRowBorder]}>
                <Text style={[styles.studentCell, { flex: 2 }]} numberOfLines={1}>
                  {sub.subjectName || sub.name || 'Unknown Subject'}
                </Text>
                <Text style={[styles.studentCell, { flex: 1, textAlign: 'center', fontWeight: '600' }]}>
                  {sub.average != null ? `${Number(sub.average).toFixed(1)}%` : '—'}
                </Text>
                <Text style={[styles.studentCell, { flex: 1, textAlign: 'center', color: colors.success }]}>
                  {sub.highest != null ? `${Number(sub.highest).toFixed(1)}%` : '—'}
                </Text>
                <Text style={[styles.studentCell, { flex: 1, textAlign: 'center', color: colors.error }]}>
                  {sub.lowest != null ? `${Number(sub.lowest).toFixed(1)}%` : '—'}
                </Text>
              </View>
            ))}
          </WidgetCard>
        )}

        {atRiskStudents.length > 0 && (
          <WidgetCard title={`At-Risk Students (${atRiskStudents.length})`}>
            {atRiskStudents.map((student: any, idx: number) => {
              const name = student.name || student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unknown';
              const avg = student.average ?? student.percentage ?? student.totalPercentage;
              const grade = student.grade || student.computedGrade || '—';
              return (
                <View key={student.id || idx} style={[styles.atRiskRow, idx > 0 && styles.studentRowBorder]}>
                  <View style={styles.atRiskAvatar}>
                    <Text style={styles.atRiskAvatarText}>⚠️</Text>
                  </View>
                  <View style={styles.atRiskInfo}>
                    <Text style={styles.atRiskName} numberOfLines={1}>{name}</Text>
                    <Text style={styles.atRiskDetail}>
                      Average: {avg != null ? `${Number(avg).toFixed(1)}%` : '—'}
                    </Text>
                  </View>
                  <View style={[styles.gradeCell]}>
                    <Text style={[styles.gradeText, { color: getGradeColor(grade) }]}>{grade}</Text>
                  </View>
                </View>
              );
            })}
          </WidgetCard>
        )}

        {atRiskStudents.length === 0 && subjectBreakdown.length === 0 && distKeys.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No Analysis Data</Text>
            <Text style={styles.emptyDesc}>Detailed analysis is not yet available for this sheet.</Text>
          </View>
        )}
      </View>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'sheets': return renderResultSheetsTab();
      case 'rankings': return renderRankingsTab();
      case 'analysis': return renderAnalysisTab();
      default: return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Results Management"
        subtitle="Manage result sheets, rankings & analytics"
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      {renderTabBar()}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {renderContent()}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.md,
  },

  // Tab bar
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabIcon: {
    fontSize: 14,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  tabTextActive: {
    color: colors.white,
  },

  // Selectors
  selectorsRow: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  selectorContainer: {
    marginBottom: 2,
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textLight,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    letterSpacing: 0.3,
  },
  chipScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  chipTextActive: {
    color: colors.white,
  },
  noDataText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },

  // Sheet header
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  createBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  createBtnDisabled: {
    opacity: 0.5,
  },
  createBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },

  // Loading
  loadingContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: colors.textLight,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.textLight,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },

  // Sheet cards
  sheetCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  sheetCardSelected: {
    borderColor: colors.primaryLight,
    borderWidth: 2,
  },
  sheetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  sheetCardInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  sheetCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  sheetCardMeta: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 2,
  },
  sheetCardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  sheetViewBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
  },
  sheetViewBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  sheetActionBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  sheetActionBtnDisabled: {
    opacity: 0.6,
  },
  sheetActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },

  // Status badge
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  // Sheet details
  detailContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  // Tables
  studentTableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textLight,
    textTransform: 'uppercase',
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  studentRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  studentCell: {
    fontSize: 13,
    color: colors.text,
  },
  gradeCell: {
    alignItems: 'center',
  },
  gradeText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Rankings
  sheetBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  sheetBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  rankingTableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
  },
  rankingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  rankingRowTop: {
    backgroundColor: colors.warningLight,
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  rankBadgeTop: {
    backgroundColor: colors.accent,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textLight,
  },
  rankTextTop: {
    color: colors.white,
  },
  studentNameText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  studentNameTop: {
    fontWeight: '700',
  },
  percentageText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },

  // Chart
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 200,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: 32,
    borderRadius: borderRadius.sm,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    minHeight: 8,
  },
  barCount: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textLight,
    marginTop: 6,
  },

  // Analysis stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  analysisStatCard: {
    width: (screenWidth - spacing.md * 2 - spacing.sm) / 2,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  analysisStatValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  analysisStatLabel: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },

  // Subject breakdown
  subjectTableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },

  // At-risk students
  atRiskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  atRiskAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  atRiskAvatarText: {
    fontSize: 14,
  },
  atRiskInfo: {
    flex: 1,
  },
  atRiskName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  atRiskDetail: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 1,
  },
});
