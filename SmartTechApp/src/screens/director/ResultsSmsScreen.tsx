import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, FlatList } from 'react-native';
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

type TabKey = 'preview' | 'history' | 'failed';

const TABS = [
  { key: 'preview' as TabKey, label: 'Preview & Send', icon: '📱' },
  { key: 'history' as TabKey, label: 'History', icon: '📋' },
  { key: 'failed' as TabKey, label: 'Failed Logs', icon: '❌' },
];

const STATUS_DOT: Record<string, string> = {
  SENT: colors.success,
  FAILED: colors.error,
  SKIPPED: colors.textLight,
};

export const ResultsSmsScreen: React.FC<Props> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const [activeTab, setActiveTab] = useState<TabKey>('preview');
  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');

  const [preview, setPreview] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [failedLogs, setFailedLogs] = useState<any[]>([]);
  const [loadingFailed, setLoadingFailed] = useState(false);

  const [sending, setSending] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [batchLogs, setBatchLogs] = useState<any[]>([]);
  const [loadingBatch, setLoadingBatch] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedClassId && selectedTermId && activeTab === 'preview') {
      loadPreview();
    }
  }, [selectedClassId, selectedTermId, activeTab]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, selectedClassId, selectedTermId]);

  useEffect(() => {
    if (activeTab === 'failed') {
      loadFailedLogs();
    }
  }, [activeTab]);

  const loadInitialData = async () => {
    try {
      const [classesRes, termsRes] = await Promise.all([
        apiService.getClasses(),
        apiService.getTerms(),
      ]);
      setClasses(classesRes?.classes || classesRes || []);
      setTerms(termsRes?.terms || termsRes || []);
    } catch (err) {
      console.log('Failed to load initial data', err);
    }
  };

  const loadPreview = async () => {
    if (!selectedClassId || !selectedTermId) return;
    try {
      setLoadingPreview(true);
      const data = await apiService.getResultsSmsPreview(selectedClassId, selectedTermId);
      setPreview(data);
    } catch (err) {
      console.log('Failed to load preview', err);
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const params: any = {};
      if (selectedClassId) params.classId = selectedClassId;
      if (selectedTermId) params.termId = selectedTermId;
      const data = await apiService.getResultsSmsHistory(params);
      setHistory(data?.batches || data || []);
    } catch (err) {
      console.log('Failed to load history', err);
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadBatchLogs = async (batchId: string) => {
    if (expandedBatch === batchId) {
      setExpandedBatch(null);
      setBatchLogs([]);
      return;
    }
    try {
      setLoadingBatch(true);
      const data = await apiService.getResultsSmsBatchLogs(batchId);
      setBatchLogs(data?.logs || data || []);
      setExpandedBatch(batchId);
    } catch (err) {
      console.log('Failed to load batch logs', err);
      setBatchLogs([]);
    } finally {
      setLoadingBatch(false);
    }
  };

  const loadFailedLogs = async () => {
    try {
      setLoadingFailed(true);
      const data = await apiService.getResultsSmsFailedLogs();
      setFailedLogs(data?.logs || data || []);
    } catch (err) {
      console.log('Failed to load failed logs', err);
      setFailedLogs([]);
    } finally {
      setLoadingFailed(false);
    }
  };

  const handleSendAll = () => {
    if (!selectedClassId || !selectedTermId) {
      Alert.alert('Error', 'Please select a class and term first');
      return;
    }
    const count = preview?.recipients?.length || 0;
    if (count === 0) {
      Alert.alert('No Recipients', 'No parents found for this class');
      return;
    }
    Alert.alert(
      'Send Results SMS',
      `Send SMS to ${count} parent(s) for this class?\n\nEach parent will receive their child\'s results.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send All', onPress: () => sendSms() },
      ],
    );
  };

  const sendSms = async () => {
    try {
      setSending(true);
      const data = await apiService.sendResultsSms({
        classId: selectedClassId,
        termId: selectedTermId,
      });
      const sentCount = data?.sent || data?.result?.sent || 0;
      const failedCount = data?.failed || data?.result?.failed || 0;
      Alert.alert(
        'SMS Sent',
        `Successfully sent: ${sentCount}\nFailed: ${failedCount}`,
      );
      loadPreview();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderPicker = (label: string, value: string, options: any[], onSelect: (id: string) => void) => (
    <View style={styles.pickerContainer}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerOptions}>
        <TouchableOpacity
          style={[styles.pickerOption, !value && styles.pickerOptionActive]}
          onPress={() => onSelect('')}
        >
          <Text style={[styles.pickerOptionText, !value && styles.pickerOptionTextActive]}>All</Text>
        </TouchableOpacity>
        {options.map((opt) => {
          const id = opt.id || opt._id;
          const name = opt.name || opt.className || opt.termName || '';
          return (
            <TouchableOpacity
              key={id}
              style={[styles.pickerOption, value === id && styles.pickerOptionActive]}
              onPress={() => onSelect(id)}
            >
              <Text style={[styles.pickerOptionText, value === id && styles.pickerOptionTextActive]}>{name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderPreviewTab = () => (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      {renderPicker('Class', selectedClassId, classes, setSelectedClassId)}
      {renderPicker('Term', selectedTermId, terms, setSelectedTermId)}

      {loadingPreview ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : preview ? (
        <>
          <WidgetCard title="Summary">
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{preview.totalRecipients || preview.recipients?.length || 0}</Text>
                <Text style={styles.summaryLabel}>Recipients</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{preview.validPhones || 0}</Text>
                <Text style={styles.summaryLabel}>Valid Phones</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: colors.error }]}>{preview.invalidPhones || 0}</Text>
                <Text style={styles.summaryLabel}>Missing Phone</Text>
              </View>
            </View>
          </WidgetCard>

          {preview.smsPreview && (
            <WidgetCard title="SMS Preview">
              <Text style={styles.smsPreviewText}>{preview.smsPreview}</Text>
            </WidgetCard>
          )}

          {preview.recipients && preview.recipients.length > 0 && (
            <WidgetCard title={`Recipients (${preview.recipients.length})`}>
              {preview.recipients.map((r: any, idx: number) => (
                <View key={r.parentId || idx} style={styles.recipientRow}>
                  <Text style={styles.recipientIcon}>
                    {r.phone ? (STATUS_DOT.SENT === colors.success ? '📱' : '📱') : '❌'}
                  </Text>
                  <View style={styles.recipientInfo}>
                    <Text style={styles.recipientName}>{r.parentName || r.parentFirstName || 'Unknown'}</Text>
                    <Text style={styles.recipientDetail}>
                      {r.studentName || ''} {r.phone ? `· ${r.phone}` : '· No phone'}
                    </Text>
                  </View>
                  <View style={[styles.phoneDot, { backgroundColor: r.phone ? colors.success : colors.error }]} />
                </View>
              ))}
            </WidgetCard>
          )}

          <TouchableOpacity
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={handleSendAll}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Text style={styles.sendButtonIcon}>📨</Text>
                <Text style={styles.sendButtonText}>Send Results SMS to All Parents</Text>
              </>
            )}
          </TouchableOpacity>
        </>
      ) : selectedClassId && selectedTermId ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No data available</Text>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👆</Text>
          <Text style={styles.emptyText}>Select a class and term to preview</Text>
        </View>
      )}
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );

  const renderHistoryTab = () => (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      {renderPicker('Class', selectedClassId, classes, setSelectedClassId)}
      {renderPicker('Term', selectedTermId, terms, setSelectedTermId)}

      {loadingHistory ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : history.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No SMS history found</Text>
        </View>
      ) : (
        history.map((batch: any) => (
          <TouchableOpacity
            key={batch.id || batch.batchId}
            style={styles.batchCard}
            onPress={() => loadBatchLogs(batch.id || batch.batchId)}
          >
            <View style={styles.batchHeader}>
              <Text style={styles.batchTitle}>{batch.className || batch.class?.name || 'Class'}</Text>
              <Text style={[styles.batchStatus, { color: batch.status === 'SENT' ? colors.success : colors.warning }]}>
                {batch.status || 'SENT'}
              </Text>
            </View>
            <View style={styles.batchMeta}>
              <Text style={styles.batchMetaText}>{batch.termName || batch.term?.name || ''}</Text>
              <Text style={styles.batchMetaText}>{formatDate(batch.createdAt || batch.sentAt)}</Text>
            </View>
            <View style={styles.batchStats}>
              <Text style={styles.batchStat}>Sent: <Text style={{ fontWeight: '700' }}>{batch.sentCount || 0}</Text></Text>
              <Text style={styles.batchStat}>Failed: <Text style={{ fontWeight: '700', color: colors.error }}>{batch.failedCount || 0}</Text></Text>
              <Text style={styles.batchStat}>Total: <Text style={{ fontWeight: '700' }}>{batch.totalCount || 0}</Text></Text>
            </View>

            {expandedBatch === (batch.id || batch.batchId) && (
              <View style={styles.batchLogsContainer}>
                {loadingBatch ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : batchLogs.length === 0 ? (
                  <Text style={styles.noLogsText}>No logs found</Text>
                ) : (
                  batchLogs.map((log: any, idx: number) => (
                    <View key={log.id || idx} style={styles.logRow}>
                      <View style={[styles.statusDot, { backgroundColor: STATUS_DOT[log.status] || colors.textLight }]} />
                      <View style={styles.logInfo}>
                        <Text style={styles.logName}>{log.parentName || 'Unknown'}</Text>
                        <Text style={styles.logDetail}>{log.phone || 'No phone'} · {log.studentName || ''}</Text>
                        {log.errorMessage && <Text style={styles.logError}>{log.errorMessage}</Text>}
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </TouchableOpacity>
        ))
      )}
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );

  const renderFailedTab = () => (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      {loadingFailed ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : failedLogs.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyText}>No failed logs</Text>
        </View>
      ) : (
        failedLogs.map((log: any, idx: number) => (
          <View key={log.id || idx} style={styles.failedCard}>
            <View style={styles.failedHeader}>
              <Text style={styles.failedName}>{log.parentName || 'Unknown'}</Text>
              <Text style={[styles.failedStatus, { color: log.status === 'FAILED' ? colors.error : colors.textLight }]}>
                {log.status || 'FAILED'}
              </Text>
            </View>
            <Text style={styles.failedPhone}>{log.phone || 'No phone'}</Text>
            {log.studentName && <Text style={styles.failedStudent}>Student: {log.studentName}</Text>}
            {log.errorMessage && (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxLabel}>Error:</Text>
                <Text style={styles.errorBoxText}>{log.errorMessage}</Text>
              </View>
            )}
            {log.suggestedFix && (
              <Text style={styles.suggestedFix}>Suggested: {log.suggestedFix}</Text>
            )}
            <Text style={styles.failedDate}>{formatDate(log.createdAt)}</Text>
          </View>
        ))
      )}
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Results SMS"
        subtitle="Send result notifications to parents"
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔄', onPress: () => {
          if (activeTab === 'preview') loadPreview();
          else if (activeTab === 'history') loadHistory();
          else loadFailedLogs();
        }}}
      />

      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabIcon]}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'preview' && renderPreviewTab()}
      {activeTab === 'history' && renderHistoryTab()}
      {activeTab === 'failed' && renderFailedTab()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabBar: { flexDirection: 'row', backgroundColor: colors.white, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: borderRadius.md },
  tabItemActive: { backgroundColor: colors.primaryLight + '15' },
  tabIcon: { fontSize: 20, marginBottom: 2 },
  tabLabel: { fontSize: 12, fontWeight: '500', color: colors.textLight },
  tabLabelActive: { color: colors.primary, fontWeight: '700' },
  tabContent: { padding: spacing.md },

  pickerContainer: { marginBottom: spacing.md },
  pickerLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  pickerOptions: { flexDirection: 'row' },
  pickerOption: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.lg, backgroundColor: colors.white, marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border },
  pickerOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pickerOptionText: { fontSize: 13, color: colors.text, fontWeight: '500' },
  pickerOptionTextActive: { color: colors.white },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.sm },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 28, fontWeight: '700', color: colors.primary },
  summaryLabel: { fontSize: 12, color: colors.textLight, marginTop: 2 },

  smsPreviewText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, backgroundColor: colors.background, padding: spacing.md, borderRadius: borderRadius.md },

  recipientRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  recipientIcon: { fontSize: 18, marginRight: spacing.sm },
  recipientInfo: { flex: 1 },
  recipientName: { fontSize: 14, fontWeight: '600', color: colors.text },
  recipientDetail: { fontSize: 12, color: colors.textLight, marginTop: 1 },
  phoneDot: { width: 10, height: 10, borderRadius: 5 },

  sendButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: borderRadius.lg, padding: spacing.md, marginTop: spacing.md },
  sendButtonDisabled: { opacity: 0.6 },
  sendButtonIcon: { fontSize: 20, marginRight: spacing.sm },
  sendButtonText: { fontSize: 16, fontWeight: '700', color: colors.white },

  batchCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  batchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  batchTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  batchStatus: { fontSize: 12, fontWeight: '700' },
  batchMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  batchMetaText: { fontSize: 12, color: colors.textLight },
  batchStats: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  batchStat: { fontSize: 13, color: colors.textSecondary },
  batchLogsContainer: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: spacing.sm },
  noLogsText: { fontSize: 13, color: colors.textLight, textAlign: 'center', paddingVertical: spacing.sm },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  logInfo: { flex: 1 },
  logName: { fontSize: 13, fontWeight: '600', color: colors.text },
  logDetail: { fontSize: 11, color: colors.textLight },
  logError: { fontSize: 11, color: colors.error, marginTop: 1 },

  failedCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.error, ...shadows.sm },
  failedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  failedName: { fontSize: 15, fontWeight: '700', color: colors.text },
  failedStatus: { fontSize: 11, fontWeight: '700' },
  failedPhone: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  failedStudent: { fontSize: 13, color: colors.textSecondary, marginTop: 1 },
  errorBox: { backgroundColor: colors.errorLight, borderRadius: borderRadius.sm, padding: spacing.sm, marginTop: spacing.sm },
  errorBoxLabel: { fontSize: 11, fontWeight: '700', color: colors.error },
  errorBoxText: { fontSize: 12, color: colors.text, marginTop: 1 },
  suggestedFix: { fontSize: 12, color: colors.info, marginTop: spacing.xs, fontStyle: 'italic' },
  failedDate: { fontSize: 11, color: colors.textMuted, marginTop: spacing.sm },

  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: 16, color: colors.textLight, textAlign: 'center' },
});
