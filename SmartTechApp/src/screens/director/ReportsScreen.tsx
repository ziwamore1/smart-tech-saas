import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiService } from '../../services/api';

interface Props {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

const REPORT_TYPES: Record<string, { label: string; icon: string; color: string }> = {
  REPORT_CARD: { label: 'Report Card', icon: '📄', color: '#3B82F6' },
  CLASS_REPORT: { label: 'Class Report', icon: '📋', color: '#0D9488' },
  TRANSCRIPT: { label: 'Transcript', icon: '📜', color: '#8B5CF6' },
  CERTIFICATE: { label: 'Certificate', icon: '🏆', color: '#F59E0B' },
  ATTENDANCE_REPORT: { label: 'Attendance', icon: '📅', color: '#10B981' },
  ANALYTICS_SUMMARY: { label: 'Analytics', icon: '📊', color: '#4F46E5' },
  MARK_SCHEDULE: { label: 'Mark Schedule', icon: '📝', color: '#EA580C' },
  PERFORMANCE_REPORT: { label: 'Performance', icon: '📈', color: '#EC4899' },
};

const TYPE_FILTER_OPTIONS = [
  { key: 'ALL', label: 'All' },
  { key: 'REPORT_CARD', label: 'Report Cards' },
  { key: 'TRANSCRIPT', label: 'Transcripts' },
  { key: 'CERTIFICATE', label: 'Certificates' },
  { key: 'ANALYTICS_SUMMARY', label: 'Analytics' },
  { key: 'MARK_SCHEDULE', label: 'Mark Schedules' },
];

const DATE_FILTER_OPTIONS = [
  { key: 'ALL', label: 'All Time' },
  { key: 'TODAY', label: 'Today' },
  { key: 'WEEK', label: 'This Week' },
  { key: 'MONTH', label: 'This Month' },
];

export const DirectorReportsScreen: React.FC<Props> = ({ onToggleDrawer, onNavigate }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState<string>('ALL');
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await apiService.getGeneratedReports();
      const payload = response?.data || response;
      const list = payload?.reports || (Array.isArray(payload) ? payload : []);
      setReports(list);
    } catch (err) {
      console.error('Failed to load reports:', err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  }, []);

  const getFilteredReports = (): any[] => {
    let filtered = [...reports];

    if (filterType !== 'ALL') {
      filtered = filtered.filter((r) => r.type === filterType);
    }

    if (filterDate !== 'ALL') {
      const now = new Date();
      filtered = filtered.filter((r) => {
        const reportDate = new Date(r.createdAt || r.date);
        if (isNaN(reportDate.getTime())) return true;
        switch (filterDate) {
          case 'TODAY': {
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            return reportDate >= today;
          }
          case 'WEEK': {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return reportDate >= weekAgo;
          }
          case 'MONTH': {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return reportDate >= monthAgo;
          }
          default:
            return true;
        }
      });
    }

    return filtered.sort((a, b) => {
      const da = new Date(a.createdAt || a.date).getTime();
      const db = new Date(b.createdAt || b.date).getTime();
      return db - da;
    });
  };

  const getTypeBreakdown = () => {
    const breakdown: Record<string, number> = {};
    reports.forEach((r) => {
      const t = r.type || 'UNKNOWN';
      breakdown[t] = (breakdown[t] || 0) + 1;
    });
    return breakdown;
  };

  const getMostRecentDate = (): string => {
    if (reports.length === 0) return '—';
    let latest = 0;
    reports.forEach((r) => {
      const d = new Date(r.createdAt || r.date).getTime();
      if (d > latest) latest = d;
    });
    if (latest === 0) return '—';
    const date = new Date(latest);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return 'Unknown date';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = async (report: any) => {
    if (!report.fileUri && !report.downloadUrl && !report.blobUrl) {
      Alert.alert('Unavailable', 'This report file is not available for download.');
      return;
    }
    setDownloading(report.id || report._id);
    try {
      let fileUri = report.fileUri;
      if (!fileUri && (report.downloadUrl || report.blobUrl)) {
        const url = report.downloadUrl || report.blobUrl;
        const filename = report.fileName || `report-${report.id || Date.now()}.pdf`;
        const downloadResult = await FileSystem.downloadAsync(url, FileSystem.documentDirectory + filename);
        fileUri = downloadResult.uri;
      }
      if (fileUri) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/pdf',
            dialogTitle: `Share ${report.title || 'Report'}`,
          });
        } else {
          Alert.alert('Downloaded', `Report saved to: ${fileUri}`);
        }
      }
    } catch (err: any) {
      if (err?.message !== 'User did not share') {
        Alert.alert('Error', 'Failed to download the report. Please try again.');
      }
    } finally {
      setDownloading(null);
    }
  };

  const handleShare = async (report: any) => {
    if (!report.fileUri && !report.downloadUrl && !report.blobUrl) {
      Alert.alert('Unavailable', 'This report file is not available for sharing.');
      return;
    }
    try {
      let fileUri = report.fileUri;
      if (!fileUri && (report.downloadUrl || report.blobUrl)) {
        const url = report.downloadUrl || report.blobUrl;
        const filename = report.fileName || `report-${report.id || Date.now()}.pdf`;
        const downloadResult = await FileSystem.downloadAsync(url, FileSystem.documentDirectory + filename);
        fileUri = downloadResult.uri;
      }
      if (fileUri) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/pdf',
            dialogTitle: `Share ${report.title || 'Report'}`,
          });
        } else {
          Alert.alert('Not Supported', 'Sharing is not available on this device.');
        }
      }
    } catch (err: any) {
      if (err?.message !== 'User did not share') {
        Alert.alert('Error', 'Failed to share the report. Please try again.');
      }
    }
  };

  const handlePreview = (report: any) => {
    Alert.alert(
      'Report Preview',
      `Title: ${report.title || 'Untitled Report'}\nType: ${REPORT_TYPES[report.type]?.label || report.type || 'Unknown'}\nDate: ${formatDate(report.createdAt || report.date)}\n${report.fileSize ? `Size: ${formatFileSize(report.fileSize)}` : ''}`,
      [
        { text: 'Download', onPress: () => handleDownload(report) },
        { text: 'Close', style: 'cancel' },
      ]
    );
  };

  const filteredReports = getFilteredReports();
  const breakdown = getTypeBreakdown();

  const renderStatsBar = () => (
    <View style={styles.statsBar}>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{reports.length}</Text>
        <Text style={styles.statLabel}>Total Reports</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{getMostRecentDate()}</Text>
        <Text style={styles.statLabel}>Most Recent</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{Object.keys(breakdown).length}</Text>
        <Text style={styles.statLabel}>Report Types</Text>
      </View>
    </View>
  );

  const renderFilterSection = () => (
    <View style={styles.filterSection}>
      <Text style={styles.filterLabel}>TYPE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {TYPE_FILTER_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.filterChip, filterType === opt.key && styles.filterChipActive]}
            onPress={() => setFilterType(opt.key)}
          >
            <Text style={[styles.filterChipText, filterType === opt.key && styles.filterChipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={[styles.filterLabel, { marginTop: spacing.md }]}>DATE RANGE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {DATE_FILTER_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.filterChip, filterDate === opt.key && styles.filterChipActive]}
            onPress={() => setFilterDate(opt.key)}
          >
            <Text style={[styles.filterChipText, filterDate === opt.key && styles.filterChipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderReportCard = (report: any, index: number) => {
    const typeInfo = REPORT_TYPES[report.type] || { label: report.type || 'Report', icon: '📄', color: colors.textLight };
    const isDownloading = downloading === (report.id || report._id);

    return (
      <View key={report.id || report._id || index} style={styles.reportCard}>
        <View style={styles.reportCardHeader}>
          <View style={[styles.reportTypeIcon, { backgroundColor: typeInfo.color + '15' }]}>
            <Text style={styles.reportTypeEmoji}>{typeInfo.icon}</Text>
          </View>
          <View style={styles.reportCardInfo}>
            <Text style={styles.reportCardTitle} numberOfLines={2}>
              {report.title || `${typeInfo.label} Report`}
            </Text>
            <View style={styles.reportCardMeta}>
              <View style={[styles.typeBadge, { backgroundColor: typeInfo.color + '15' }]}>
                <Text style={[styles.typeBadgeText, { color: typeInfo.color }]}>{typeInfo.label}</Text>
              </View>
              <Text style={styles.reportDate}>{formatDate(report.createdAt || report.date)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.reportCardDetails}>
          {report.fileSize && (
            <Text style={styles.fileSizeText}>{formatFileSize(report.fileSize)}</Text>
          )}
          {report.status && (
            <View style={[styles.statusBadge, report.status === 'completed' ? styles.statusCompleted : report.status === 'pending' ? styles.statusPending : styles.statusDefault]}>
              <Text style={[styles.statusText, report.status === 'completed' ? styles.statusTextCompleted : report.status === 'pending' ? styles.statusTextPending : styles.statusTextDefault]}>
                {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.reportCardActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.downloadButton]}
            onPress={() => handleDownload(report)}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.actionIcon}>⬇️</Text>
            )}
            <Text style={[styles.actionText, { color: colors.primary }]}>Download</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.shareButton]}
            onPress={() => handleShare(report)}
          >
            <Text style={styles.actionIcon}>🔗</Text>
            <Text style={[styles.actionText, { color: colors.secondary }]}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.previewButton]}
            onPress={() => handlePreview(report)}
          >
            <Text style={styles.actionIcon}>👁️</Text>
            <Text style={[styles.actionText, { color: colors.purple }]}>Preview</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>📭</Text>
      <Text style={styles.emptyTitle}>No Reports Yet</Text>
      <Text style={styles.emptySubtitle}>
        Generate your first report from the Report Generation Hub
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => onNavigate?.('ReportCards')}
      >
        <Text style={styles.emptyButtonText}>Go to Report Hub</Text>
      </TouchableOpacity>
    </View>
  );

  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      <TouchableOpacity
        style={[styles.quickActionPrimary]}
        onPress={() => onNavigate?.('ReportCards')}
      >
        <Text style={styles.quickActionPrimaryIcon}>✨</Text>
        <Text style={styles.quickActionPrimaryText}>Generate New Report</Text>
        <Text style={styles.quickActionPrimaryArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.quickActionSecondary]}
        onPress={() => onNavigate?.('DirectorStudents')}
      >
        <Text style={styles.quickActionSecondaryIcon}>👨‍🎓</Text>
        <Text style={styles.quickActionSecondaryText}>View All Students</Text>
        <Text style={styles.quickActionSecondaryArrow}>→</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Reports"
        subtitle="Browse, preview & download"
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {renderStatsBar()}

        {renderFilterSection()}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading reports...</Text>
          </View>
        ) : filteredReports.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.reportsList}>
            <Text style={styles.resultsCount}>
              {filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''} found
            </Text>
            {filteredReports.map((report, index) => renderReportCard(report, index))}
          </View>
        )}

        {renderQuickActions()}

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

  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
    ...shadows.card,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },

  filterSection: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: spacing.sm,
  },
  chipScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
  },
  filterChipTextActive: {
    color: colors.white,
  },

  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: spacing.md,
  },

  reportsList: {
    gap: spacing.sm,
  },
  resultsCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textLight,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  reportCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  reportCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  reportTypeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  reportTypeEmoji: {
    fontSize: 20,
  },
  reportCardInfo: {
    flex: 1,
  },
  reportCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 20,
  },
  reportCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  reportDate: {
    fontSize: 12,
    color: colors.textMuted,
  },

  reportCardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  fileSizeText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statusCompleted: {
    backgroundColor: colors.successLight,
  },
  statusPending: {
    backgroundColor: colors.warningLight,
  },
  statusDefault: {
    backgroundColor: colors.infoLight,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statusTextCompleted: {
    color: colors.success,
  },
  statusTextPending: {
    color: colors.warning,
  },
  statusTextDefault: {
    color: colors.info,
  },

  reportCardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  downloadButton: {
    backgroundColor: colors.infoLight,
  },
  shareButton: {
    backgroundColor: colors.tealLight,
  },
  previewButton: {
    backgroundColor: colors.purpleLight,
  },
  actionIcon: {
    fontSize: 14,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl + spacing.lg,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },

  quickActionsContainer: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  quickActionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.md,
  },
  quickActionPrimaryIcon: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  quickActionPrimaryText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  quickActionPrimaryArrow: {
    fontSize: 18,
    color: colors.white,
  },
  quickActionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionSecondaryIcon: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  quickActionSecondaryText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  quickActionSecondaryArrow: {
    fontSize: 18,
    color: colors.textLight,
  },
});
