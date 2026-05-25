import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { HeaderBar } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAuthStore } from '../../store';
import { apiService } from '../../services/api';

interface ApprovalStep {
  id: string;
  role: string;
  userId?: string;
  userName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  completedAt?: string;
  note?: string;
}

interface ApprovalWorkflow {
  id: string;
  documentId: string;
  documentName: string;
  documentType: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  createdAt: string;
  createdBy: string;
  createdByName: string;
  steps: ApprovalStep[];
  currentStep: number;
}

export const ApprovalWorkflowScreen: React.FC = () => {
  const { user } = useAuthStore();
  const isDirector = user?.roles?.includes('Director') || user?.roles?.includes('Head Teacher');
  const isAdmin = user?.roles?.includes('Admin') || user?.roles?.includes('Deputy');

  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<ApprovalWorkflow | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [note, setNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const loadWorkflows = useCallback(async () => {
    try {
      const response = await apiService.getApprovalWorkflows();
      const data = response?.workflows ?? response ?? [];
      setWorkflows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load workflows:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadWorkflows(); }, [loadWorkflows]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadWorkflows();
  };

  const handleCreateWorkflow = async (documentId: string, documentName: string, documentType: string) => {
    try {
      await apiService.createApprovalWorkflow({ documentId, documentName, documentType });
      Alert.alert('Success', 'Approval workflow created');
      loadWorkflows();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create workflow');
    }
  };

  const handleProcessStep = async (workflowId: string, stepId: string, approve: boolean) => {
    setProcessing(true);
    try {
      await apiService.processApprovalStep(workflowId, stepId, {
        approved: approve,
        note: note.trim() || undefined,
      });
      setNote('');
      Alert.alert('Success', approve ? 'Step approved' : 'Step rejected');
      setShowDetailModal(false);
      loadWorkflows();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to process step');
    } finally {
      setProcessing(false);
    }
  };

  const filteredWorkflows = workflows.filter(w => {
    if (filter === 'pending') return w.status === 'pending' || w.status === 'in_progress';
    if (filter === 'completed') return w.status === 'completed' || w.status === 'rejected';
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return colors.warning;
      case 'in_progress': return colors.primary;
      case 'completed': return colors.success;
      case 'rejected': return colors.error;
      default: return colors.textLight;
    }
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return '✓';
      case 'rejected': return '✕';
      case 'skipped': return '→';
      default: return '○';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading workflows...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar title="Approval Workflows" subtitle={`${filteredWorkflows.length} workflows`} />

      <View style={styles.filterBar}>
        {(['all', 'pending', 'completed'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {filteredWorkflows.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No approval workflows</Text>
            <Text style={styles.emptySubtext}>Create a workflow when submitting a document for approval</Text>
          </View>
        ) : (
          filteredWorkflows.map(workflow => (
            <TouchableOpacity
              key={workflow.id}
              style={styles.workflowCard}
              onPress={() => { setSelectedWorkflow(workflow); setShowDetailModal(true); }}
              activeOpacity={0.7}
            >
              <View style={styles.workflowHeader}>
                <View style={styles.workflowInfo}>
                  <Text style={styles.workflowDocName}>{workflow.documentName}</Text>
                  <Text style={styles.workflowDocType}>{workflow.documentType}</Text>
                </View>
                <View style={[styles.workflowStatus, { backgroundColor: `${getStatusColor(workflow.status)}15` }]}>
                  <Text style={[styles.workflowStatusText, { color: getStatusColor(workflow.status) }]}>
                    {workflow.status.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.workflowProgress}>
                <View style={styles.progressTrack}>
                  {workflow.steps.map((step, i) => (
                    <React.Fragment key={step.id}>
                      <View style={[styles.progressNode, { backgroundColor: step.status === 'approved' ? colors.success : step.status === 'rejected' ? colors.error : step.status === 'pending' && i === workflow.currentStep ? colors.primary : colors.border }]}>
                        <Text style={[styles.progressNodeText, { color: step.status === 'approved' || step.status === 'rejected' ? colors.white : colors.textLight }]}>
                          {getStepStatusIcon(step.status)}
                        </Text>
                      </View>
                      {i < workflow.steps.length - 1 && (
                        <View style={[styles.progressLine, { backgroundColor: step.status === 'approved' ? colors.success : colors.border }]} />
                      )}
                    </React.Fragment>
                  ))}
                </View>
                <Text style={styles.progressLabel}>
                  Step {workflow.currentStep + 1} of {workflow.steps.length}
                </Text>
              </View>

              <View style={styles.workflowMeta}>
                <Text style={styles.workflowMetaText}>Created by: {workflow.createdByName}</Text>
                <Text style={styles.workflowMetaText}>{new Date(workflow.createdAt).toLocaleDateString()}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <Modal visible={showDetailModal} transparent animationType="slide" onRequestClose={() => setShowDetailModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Workflow Details</Text>

            {selectedWorkflow && (
              <>
                <Text style={styles.modalDocName}>{selectedWorkflow.documentName}</Text>
                <Text style={styles.modalDocType}>{selectedWorkflow.documentType}</Text>

                <View style={styles.stepsList}>
                  {selectedWorkflow.steps.map((step, i) => (
                    <View key={step.id} style={[styles.stepItem, i === selectedWorkflow.currentStep && styles.stepItemActive]}>
                      <View style={[styles.stepIcon, { backgroundColor: step.status === 'approved' ? colors.success : step.status === 'rejected' ? colors.error : i === selectedWorkflow.currentStep ? colors.primary : colors.border }]}>
                        <Text style={[styles.stepIconText, { color: step.status === 'approved' || step.status === 'rejected' ? colors.white : colors.textLight }]}>
                          {i + 1}
                        </Text>
                      </View>
                      <View style={styles.stepInfo}>
                        <Text style={styles.stepRole}>{step.role}</Text>
                        <Text style={styles.stepUser}>{step.userName || 'Pending assignment'}</Text>
                        {step.note && <Text style={styles.stepNote}>Note: {step.note}</Text>}
                        {step.completedAt && <Text style={styles.stepTime}>{new Date(step.completedAt).toLocaleString()}</Text>}
                      </View>
                      <View style={[styles.stepStatusBadge, { backgroundColor: `${getStatusColor(step.status)}15` }]}>
                        <Text style={[styles.stepStatusText, { color: getStatusColor(step.status) }]}>
                          {step.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                {selectedWorkflow.status === 'in_progress' && isDirector && (
                  <>
                    <Text style={styles.fieldLabel}>Approval Note:</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={note}
                      onChangeText={setNote}
                      placeholder="Add approval note (optional)..."
                      placeholderTextColor={colors.textLight}
                      multiline
                      numberOfLines={3}
                    />

                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => {
                          const currentStep = selectedWorkflow.steps[selectedWorkflow.currentStep];
                          handleProcessStep(selectedWorkflow.id, currentStep.id, false);
                        }}
                        disabled={processing}
                      >
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.approveBtn}
                        onPress={() => {
                          const currentStep = selectedWorkflow.steps[selectedWorkflow.currentStep];
                          handleProcessStep(selectedWorkflow.id, currentStep.id, true);
                        }}
                        disabled={processing}
                      >
                        {processing ? (
                          <ActivityIndicator color={colors.white} size="small" />
                        ) : (
                          <Text style={styles.approveBtnText}>Approve</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowDetailModal(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing.md, fontSize: 14, color: colors.textLight },
  filterBar: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, backgroundColor: colors.background },
  filterChipActive: { backgroundColor: colors.primary },
  filterText: { fontSize: 13, fontWeight: '500', color: colors.textLight },
  filterTextActive: { color: colors.white, fontWeight: '600' },
  scroll: { padding: spacing.md },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl * 2 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: 16, color: colors.textLight, fontWeight: '500' },
  emptySubtext: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  workflowCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  workflowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  workflowInfo: { flex: 1 },
  workflowDocName: { fontSize: 15, fontWeight: '600', color: colors.text },
  workflowDocType: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  workflowStatus: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
  workflowStatusText: { fontSize: 10, fontWeight: '700' },
  workflowProgress: { marginBottom: spacing.sm },
  progressTrack: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  progressNode: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  progressNodeText: { fontSize: 12, fontWeight: '700' },
  progressLine: { flex: 1, height: 2 },
  progressLabel: { fontSize: 11, color: colors.textLight, textAlign: 'center' },
  workflowMeta: { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: spacing.sm },
  workflowMetaText: { fontSize: 11, color: colors.textLight, marginBottom: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xxl, borderTopRightRadius: borderRadius.xxl, padding: spacing.lg, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
  modalDocName: { fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' },
  modalDocType: { fontSize: 13, color: colors.textLight, textAlign: 'center', marginBottom: spacing.lg },
  stepsList: { marginBottom: spacing.lg },
  stepItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  stepItemActive: { backgroundColor: colors.infoLight, borderRadius: borderRadius.lg, paddingHorizontal: spacing.sm, marginHorizontal: -spacing.sm },
  stepIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  stepIconText: { fontSize: 14, fontWeight: '700' },
  stepInfo: { flex: 1 },
  stepRole: { fontSize: 14, fontWeight: '600', color: colors.text },
  stepUser: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  stepNote: { fontSize: 11, color: colors.primaryLight, marginTop: 2, fontStyle: 'italic' },
  stepTime: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  stepStatusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
  stepStatusText: { fontSize: 9, fontWeight: '700' },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: 15, color: colors.text, marginBottom: spacing.sm },
  textArea: { height: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  rejectBtn: { flex: 1, backgroundColor: colors.errorLight, paddingVertical: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center' },
  rejectBtnText: { fontSize: 15, fontWeight: '700', color: colors.error },
  approveBtn: { flex: 1, backgroundColor: colors.success, paddingVertical: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center' },
  approveBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
  closeBtn: { paddingVertical: spacing.md, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border },
  closeBtnText: { fontSize: 15, color: colors.textLight, fontWeight: '600' },
});
