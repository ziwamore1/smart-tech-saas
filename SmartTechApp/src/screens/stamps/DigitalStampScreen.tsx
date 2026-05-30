import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';
import { HeaderBar } from '../../components';
import { DigitalStamp, StampConfig, StampPreview } from '../../components/DigitalStamp';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAuthStore } from '../../store';
import { apiService } from '../../services/api';

interface DocumentStamp {
  id: string;
  documentId: string;
  documentType: string;
  stampId: string;
  stampName: string;
  stampType: string;
  appliedBy: string;
  appliedByName: string;
  appliedAt: string;
  verificationHash: string;
  status: 'pending' | 'approved' | 'rejected';
  qrData?: string;
}

interface ApprovalRequest {
  id: string;
  documentId: string;
  documentName: string;
  documentType: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  approverId?: string;
  approverName?: string;
  approvedAt?: string;
}

export const DigitalStampScreen: React.FC = () => {
  const { user } = useAuthStore();
  const isDirector = user?.roles?.includes('Director') || user?.roles?.includes('Head Teacher');
  const isClassTeacher = user?.roles?.includes('Class Teacher');
  const isAdmin = user?.roles?.includes('Admin') || user?.roles?.includes('Deputy');

  const [activeTab, setActiveTab] = useState<'stamps' | 'documents' | 'approvals'>('stamps');
  const [stamps, setStamps] = useState<any[]>([]);
  const [stampedDocs, setStampedDocs] = useState<DocumentStamp[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentStamp | null>(null);
  const [verificationInput, setVerificationInput] = useState('');
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [selectedStampId, setSelectedStampId] = useState<string>('');
  const [approvalNote, setApprovalNote] = useState('');
  const [applying, setApplying] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [stampsRes, docsRes, approvalsRes] = await Promise.allSettled([
        apiService.getStamps(),
        apiService.getStampedDocuments(),
        isDirector || isAdmin ? apiService.getApprovalRequests() : Promise.resolve([]),
      ]);

      if (stampsRes.status === 'fulfilled') {
        const data = stampsRes.value?.stamps ?? stampsRes.value ?? [];
        setStamps(Array.isArray(data) ? data : []);
      }
      if (docsRes.status === 'fulfilled') {
        const data = docsRes.value?.documents ?? docsRes.value ?? [];
        setStampedDocs(Array.isArray(data) ? data : []);
      }
      if (approvalsRes.status === 'fulfilled') {
        const data = approvalsRes.value?.requests ?? approvalsRes.value ?? [];
        setApprovalRequests(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load stamp data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isDirector, isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleApplyStamp = async () => {
    if (!selectedDoc || !selectedStampId) {
      Alert.alert('Error', 'Select a document and stamp');
      return;
    }

    setApplying(true);
    try {
      await apiService.applyStamp({
        documentId: selectedDoc.documentId,
        stampId: selectedStampId,
        note: approvalNote,
      });
      setShowApplyModal(false);
      setSelectedDoc(null);
      setSelectedStampId('');
      setApprovalNote('');
      Alert.alert('Success', 'Stamp applied successfully');
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to apply stamp');
    } finally {
      setApplying(false);
    }
  };

  const handleApproveRequest = async (requestId: string, approve: boolean) => {
    try {
      await apiService.approveDocument(requestId, {
        approved: approve,
        note: approvalNote,
      });
      setApprovalNote('');
      Alert.alert('Success', approve ? 'Document approved' : 'Document rejected');
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to process request');
    }
  };

  const handleRequestApproval = async (documentId: string) => {
    try {
      await apiService.requestApproval({ documentId, note: approvalNote });
      setApprovalNote('');
      Alert.alert('Success', 'Approval request sent to Director');
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to request approval');
    }
  };

  const handleVerifyDocument = async () => {
    if (!verificationInput.trim()) {
      Alert.alert('Error', 'Enter a verification hash or scan QR code');
      return;
    }
    try {
      const result = await apiService.verifyDocument(verificationInput.trim());
      setVerificationResult(result);
    } catch (err: any) {
      setVerificationResult({ valid: false, message: err?.response?.data?.message || 'Invalid hash' });
    }
  };

  const handleExportStampedDoc = async (doc: DocumentStamp) => {
    try {
      const dir = FileSystem.documentDirectory + 'stamped_docs/';
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }

      const content = JSON.stringify({
        documentId: doc.documentId,
        documentType: doc.documentType,
        stamp: { name: doc.stampName, type: doc.stampType },
        appliedBy: doc.appliedByName,
        appliedAt: doc.appliedAt,
        verificationHash: doc.verificationHash,
        status: doc.status,
        exportedAt: new Date().toISOString(),
      }, null, 2);

      const fileUri = dir + `${doc.documentType}_${doc.id}.json`;
      await FileSystem.writeAsStringAsync(fileUri, content);
      await Sharing.shareAsync(fileUri, { mimeType: 'application/json' });
    } catch (e) {
      Alert.alert('Error', 'Failed to export document');
    }
  };

  const tabs = [
    { key: 'stamps' as const, label: 'Stamps', icon: '🔏' },
    { key: 'documents' as const, label: 'Stamped Docs', icon: '📄' },
    ...(isDirector || isAdmin ? [{ key: 'approvals' as const, label: 'Approvals', icon: '✅' }] : []),
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading stamps...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar title="Digital Stamps" subtitle="Manage & verify documents" />

      <View style={styles.tabBar}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {activeTab === 'stamps' && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available Stamps</Text>
              <Text style={styles.sectionCount}>{stamps.length} stamps</Text>
            </View>

            {stamps.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🔏</Text>
                <Text style={styles.emptyText}>No stamps available</Text>
                {isDirector && <Text style={styles.emptySubtext}>Upload institutional stamps from admin panel</Text>}
              </View>
            ) : (
              stamps.map(stamp => (
                <StampPreview key={stamp.id} config={{
                  id: stamp.id,
                  name: stamp.name,
                  title: stamp.title,
                  schoolName: stamp.schoolName,
                  type: stamp.type,
                  color: stamp.color,
                  imageUrl: stamp.imageUrl,
                  svgContent: stamp.svgContent,
                }} />
              ))
            )}

            {isClassTeacher && (
              <View style={styles.permissionNotice}>
                <Text style={styles.permissionIcon}>ℹ️</Text>
                <Text style={styles.permissionText}>
                  Class Teachers can preview stamped reports and request approvals.
                  Only Directors can apply official institutional stamps.
                </Text>
              </View>
            )}
          </>
        )}

        {activeTab === 'documents' && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Stamped Documents</Text>
              <TouchableOpacity style={styles.verifyBtn} onPress={() => setShowVerifyModal(true)}>
                <Text style={styles.verifyBtnText}>🔍 Verify</Text>
              </TouchableOpacity>
            </View>

            {stampedDocs.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📄</Text>
                <Text style={styles.emptyText}>No stamped documents</Text>
              </View>
            ) : (
              stampedDocs.map(doc => (
                <View key={doc.id} style={styles.docCard}>
                  <View style={styles.docHeader}>
                    <View style={styles.docTypeBadge}>
                      <Text style={styles.docTypeText}>{doc.documentType}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: doc.status === 'approved' ? '#d1fae5' : doc.status === 'pending' ? '#fef3c7' : '#fee2e2' }]}>
                      <Text style={[styles.statusText, { color: doc.status === 'approved' ? '#065f46' : doc.status === 'pending' ? '#92400e' : '#991b1b' }]}>
                        {doc.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.docBody}>
                    <View style={styles.docStampPreview}>
                      <DigitalStamp
                        config={{
                          id: doc.stampId,
                          name: doc.stampName,
                          type: doc.stampType as any,
                        }}
                        width={80}
                        height={80}
                        position={{ x: 0, y: 0 }}
                      />
                    </View>
                    <View style={styles.docInfo}>
                      <Text style={styles.docStampName}>{doc.stampName}</Text>
                      <Text style={styles.docAppliedBy}>Applied by: {doc.appliedByName}</Text>
                      <Text style={styles.docAppliedAt}>{new Date(doc.appliedAt).toLocaleDateString()}</Text>
                      <Text style={styles.docHash} numberOfLines={1}>Hash: {doc.verificationHash.substring(0, 16)}...</Text>
                    </View>
                  </View>

                  <View style={styles.docActions}>
                    <TouchableOpacity style={styles.docActionBtn} onPress={() => handleExportStampedDoc(doc)}>
                      <Text style={styles.docActionText}>📤 Export</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.docActionBtn} onPress={() => { setSelectedDoc(doc); setShowApplyModal(true); }}>
                      <Text style={styles.docActionText}>🔍 Details</Text>
                    </TouchableOpacity>
                    {isClassTeacher && doc.status === 'pending' && (
                      <TouchableOpacity
                        style={[styles.docActionBtn, styles.requestApprovalBtn]}
                        onPress={() => handleRequestApproval(doc.documentId)}
                      >
                        <Text style={styles.requestApprovalText}>📩 Request Approval</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {activeTab === 'approvals' && (isDirector || isAdmin) && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Approval Requests</Text>
              <Text style={styles.sectionCount}>{approvalRequests.filter(r => r.status === 'pending').length} pending</Text>
            </View>

            {approvalRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>✅</Text>
                <Text style={styles.emptyText}>No approval requests</Text>
              </View>
            ) : (
              approvalRequests.map(req => (
                <View key={req.id} style={styles.approvalCard}>
                  <View style={styles.approvalHeader}>
                    <View>
                      <Text style={styles.approvalDocName}>{req.documentName}</Text>
                      <Text style={styles.approvalDocType}>{req.documentType}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: req.status === 'pending' ? '#fef3c7' : req.status === 'approved' ? '#d1fae5' : '#fee2e2' }]}>
                      <Text style={[styles.statusText, { color: req.status === 'pending' ? '#92400e' : req.status === 'approved' ? '#065f46' : '#991b1b' }]}>
                        {req.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.approvalMeta}>
                    <Text style={styles.approvalMetaText}>Requested by: {req.requestedByName}</Text>
                    <Text style={styles.approvalMetaText}>{new Date(req.requestedAt).toLocaleString()}</Text>
                    {req.approverName && (
                      <Text style={styles.approvalMetaText}>Approved by: {req.approverName}</Text>
                    )}
                  </View>

                  {req.status === 'pending' && (
                    <View style={styles.approvalActions}>
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => handleApproveRequest(req.id, false)}
                      >
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.approveBtn}
                        onPress={() => handleApproveRequest(req.id, true)}
                      >
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* Verification Modal */}
      <Modal visible={showVerifyModal} transparent animationType="slide" onRequestClose={() => { setShowVerifyModal(false); setVerificationResult(null); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Verify Document</Text>
            <Text style={styles.modalSubtext}>Enter the verification hash from the stamped document</Text>

            <TextInput
              style={styles.input}
              value={verificationInput}
              onChangeText={setVerificationInput}
              placeholder="Enter verification hash..."
              placeholderTextColor={colors.textLight}
              autoCapitalize="none"
              multiline
            />

            {verificationResult && (
              <View style={[styles.verificationResult, { backgroundColor: verificationResult.valid ? '#d1fae5' : '#fee2e2' }]}>
                <Text style={[styles.verificationIcon, { color: verificationResult.valid ? '#065f46' : '#991b1b' }]}>
                  {verificationResult.valid ? '✓' : '✕'}
                </Text>
                <View style={styles.verificationInfo}>
                  <Text style={[styles.verificationStatus, { color: verificationResult.valid ? '#065f46' : '#991b1b' }]}>
                    {verificationResult.valid ? 'Document Verified' : 'Verification Failed'}
                  </Text>
                  {verificationResult.document && (
                    <>
                      <Text style={styles.verificationDetail}>Type: {verificationResult.document.documentType}</Text>
                      <Text style={styles.verificationDetail}>Stamped by: {verificationResult.document.appliedByName}</Text>
                      <Text style={styles.verificationDetail}>Date: {new Date(verificationResult.document.appliedAt).toLocaleDateString()}</Text>
                    </>
                  )}
                  {verificationResult.message && (
                    <Text style={styles.verificationDetail}>{verificationResult.message}</Text>
                  )}
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowVerifyModal(false); setVerificationResult(null); }}>
                <Text style={styles.modalCancelText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalVerifyBtn} onPress={handleVerifyDocument}>
                <Text style={styles.modalVerifyText}>Verify</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Apply Stamp Modal */}
      <Modal visible={showApplyModal} transparent animationType="slide" onRequestClose={() => setShowApplyModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Apply Stamp</Text>
            {selectedDoc && (
              <>
                <Text style={styles.modalSubtext}>Document: {selectedDoc.documentType}</Text>
                <Text style={styles.modalSubtext}>Current Status: {selectedDoc.status}</Text>
              </>
            )}

            <Text style={styles.fieldLabel}>Select Stamp:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stampSelector}>
              {stamps.map(stamp => (
                <TouchableOpacity
                  key={stamp.id}
                  style={[styles.stampOption, selectedStampId === stamp.id && styles.stampOptionSelected]}
                  onPress={() => setSelectedStampId(stamp.id)}
                >
                  <Text style={styles.stampOptionIcon}>🔏</Text>
                  <Text style={styles.stampOptionName}>{stamp.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Note (optional):</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={approvalNote}
              onChangeText={setApprovalNote}
              placeholder="Add approval note..."
              placeholderTextColor={colors.textLight}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowApplyModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalVerifyBtn, (!selectedStampId || applying) && styles.modalVerifyBtnDisabled]}
                onPress={handleApplyStamp}
                disabled={!selectedStampId || applying}
              >
                {applying ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.modalVerifyText}>Apply Stamp</Text>
                )}
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
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing.md, fontSize: 14, color: colors.textLight },
  tabBar: { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, gap: spacing.xs },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabIcon: { fontSize: 16 },
  tabLabel: { fontSize: 13, fontWeight: '500', color: colors.textLight },
  tabLabelActive: { color: colors.primary, fontWeight: '700' },
  scroll: { padding: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  sectionCount: { fontSize: 13, color: colors.textLight, fontWeight: '500' },
  verifyBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.md },
  verifyBtnText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl * 2 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: 16, color: colors.textLight, fontWeight: '500' },
  emptySubtext: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  permissionNotice: { flexDirection: 'row', backgroundColor: colors.infoLight, borderRadius: borderRadius.lg, padding: spacing.md, marginTop: spacing.lg, gap: spacing.sm },
  permissionIcon: { fontSize: 20 },
  permissionText: { flex: 1, fontSize: 13, color: colors.primaryLight, lineHeight: 18 },
  docCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  docHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  docTypeBadge: { backgroundColor: colors.infoLight, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
  docTypeText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
  statusText: { fontSize: 10, fontWeight: '700' },
  docBody: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  docStampPreview: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center' },
  docInfo: { flex: 1, justifyContent: 'center' },
  docStampName: { fontSize: 14, fontWeight: '600', color: colors.text },
  docAppliedBy: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  docAppliedAt: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  docHash: { fontSize: 10, color: colors.textMuted, marginTop: 4, fontFamily: 'monospace' },
  docActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  docActionBtn: { flex: 1, backgroundColor: colors.background, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  docActionText: { fontSize: 13, fontWeight: '600', color: colors.text },
  requestApprovalBtn: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  requestApprovalText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  approvalCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  approvalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  approvalDocName: { fontSize: 15, fontWeight: '600', color: colors.text },
  approvalDocType: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  approvalMeta: { marginBottom: spacing.sm },
  approvalMetaText: { fontSize: 12, color: colors.textLight, marginBottom: 2 },
  approvalActions: { flexDirection: 'row', gap: spacing.sm },
  rejectBtn: { flex: 1, backgroundColor: colors.errorLight, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center' },
  rejectBtnText: { fontSize: 14, fontWeight: '600', color: colors.error },
  approveBtn: { flex: 1, backgroundColor: colors.success, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center' },
  approveBtnText: { fontSize: 14, fontWeight: '600', color: colors.white },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xxl, borderTopRightRadius: borderRadius.xxl, padding: spacing.lg, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
  modalSubtext: { fontSize: 13, color: colors.textLight, marginBottom: spacing.xs, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: 15, color: colors.text, marginBottom: spacing.sm },
  textArea: { height: 80, textAlignVertical: 'top' },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.sm },
  stampSelector: { marginBottom: spacing.sm },
  stampOption: { width: 100, padding: spacing.sm, borderRadius: borderRadius.lg, borderWidth: 2, borderColor: colors.border, alignItems: 'center', marginRight: spacing.sm, backgroundColor: colors.white },
  stampOptionSelected: { borderColor: colors.primary, backgroundColor: colors.infoLight },
  stampOptionIcon: { fontSize: 24, marginBottom: spacing.xs },
  stampOptionName: { fontSize: 11, fontWeight: '600', color: colors.text, textAlign: 'center' },
  verificationResult: { flexDirection: 'row', borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, gap: spacing.md },
  verificationIcon: { fontSize: 28, fontWeight: '700' },
  verificationInfo: { flex: 1 },
  verificationStatus: { fontSize: 15, fontWeight: '700', marginBottom: spacing.xs },
  verificationDetail: { fontSize: 12, color: colors.textLight, marginBottom: 2 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.md },
  modalCancelBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  modalCancelText: { fontSize: 15, color: colors.textLight, fontWeight: '600' },
  modalVerifyBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: borderRadius.lg },
  modalVerifyBtnDisabled: { opacity: 0.5 },
  modalVerifyText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
