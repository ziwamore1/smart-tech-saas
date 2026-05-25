import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import QRCode from 'react-native-qrcode-svg';
import { HeaderBar } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';

interface VerificationResult {
  valid: boolean;
  documentId?: string;
  documentType?: string;
  documentName?: string;
  stampName?: string;
  stampType?: string;
  appliedBy?: string;
  appliedAt?: string;
  schoolName?: string;
  message?: string;
  auditTrail?: { action: string; user: string; timestamp: string }[];
}

export const QRVerificationScreen: React.FC = () => {
  const [inputHash, setInputHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [history, setHistory] = useState<VerificationResult[]>([]);

  const handleVerify = async () => {
    if (!inputHash.trim()) {
      Alert.alert('Error', 'Enter a verification hash or QR code data');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.verifyDocument(inputHash.trim());
      const verificationResult: VerificationResult = {
        valid: response?.valid ?? response?.isVerified ?? false,
        documentId: response?.documentId,
        documentType: response?.documentType,
        documentName: response?.documentName,
        stampName: response?.stampName,
        stampType: response?.stampType,
        appliedBy: response?.appliedBy,
        appliedAt: response?.appliedAt,
        schoolName: response?.schoolName,
        message: response?.message,
        auditTrail: response?.auditTrail,
      };
      setResult(verificationResult);
      setHistory(prev => [verificationResult, ...prev].slice(0, 10));
    } catch (err: any) {
      setResult({
        valid: false,
        message: err?.response?.data?.message || 'Document could not be verified',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setInputHash('');
    setResult(null);
  };

  const isVerified = result?.valid;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar title="Verify Document" subtitle="Scan QR or enter hash" />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.inputCard}>
          <Text style={styles.inputTitle}>Verification Hash</Text>
          <Text style={styles.inputSubtext}>
            Enter the hash from a stamped document or scan the QR code
          </Text>

          <TextInput
            style={styles.input}
            value={inputHash}
            onChangeText={setInputHash}
            placeholder="Paste verification hash here..."
            placeholderTextColor={colors.textLight}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            numberOfLines={3}
          />

          <View style={styles.inputActions}>
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.verifyBtn, loading && styles.verifyBtnDisabled]}
              onPress={handleVerify}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.verifyBtnText}>Verify Document</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {result && (
          <View style={[styles.resultCard, isVerified ? styles.resultValid : styles.resultInvalid]}>
            <View style={styles.resultHeader}>
              <View style={[styles.resultIcon, { backgroundColor: isVerified ? '#d1fae5' : '#fee2e2' }]}>
                <Text style={[styles.resultIconText, { color: isVerified ? '#065f46' : '#991b1b' }]}>
                  {isVerified ? '✓' : '✕'}
                </Text>
              </View>
              <View style={styles.resultTitleArea}>
                <Text style={[styles.resultTitle, { color: isVerified ? '#065f46' : '#991b1b' }]}>
                  {isVerified ? 'Document Verified' : 'Verification Failed'}
                </Text>
                <Text style={styles.resultSubtext}>
                  {result.message || (isVerified ? 'This document is authentic' : 'Document could not be verified')}
                </Text>
              </View>
            </View>

            {isVerified && result.documentId && (
              <View style={styles.resultDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Document Type</Text>
                  <Text style={styles.detailValue}>{result.documentType || 'N/A'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Document Name</Text>
                  <Text style={styles.detailValue}>{result.documentName || 'N/A'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>School</Text>
                  <Text style={styles.detailValue}>{result.schoolName || 'N/A'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Stamp</Text>
                  <Text style={styles.detailValue}>{result.stampName || 'N/A'} ({result.stampType})</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Applied By</Text>
                  <Text style={styles.detailValue}>{result.appliedBy || 'N/A'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Applied At</Text>
                  <Text style={styles.detailValue}>
                    {result.appliedAt ? new Date(result.appliedAt).toLocaleString() : 'N/A'}
                  </Text>
                </View>

                {result.auditTrail && result.auditTrail.length > 0 && (
                  <View style={styles.auditSection}>
                    <Text style={styles.auditTitle}>Approval Trail</Text>
                    {result.auditTrail.map((entry, i) => (
                      <View key={i} style={styles.auditEntry}>
                        <View style={styles.auditDot} />
                        <View style={styles.auditContent}>
                          <Text style={styles.auditAction}>{entry.action}</Text>
                          <Text style={styles.auditMeta}>{entry.user} • {new Date(entry.timestamp).toLocaleString()}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.qrSection}>
                  <Text style={styles.qrTitle}>Verification QR</Text>
                  <View style={styles.qrWrapper}>
                    <QRCode
                      value={inputHash}
                      size={150}
                      color={colors.primary}
                      backgroundColor="white"
                    />
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {history.length > 1 && (
          <View style={styles.historyCard}>
            <Text style={styles.historyTitle}>Recent Verifications</Text>
            {history.slice(1).map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.historyItem}
                onPress={() => {
                  setInputHash(item.documentId || '');
                  setResult(item);
                }}
              >
                <View style={[styles.historyDot, { backgroundColor: item.valid ? colors.success : colors.error }]} />
                <View style={styles.historyContent}>
                  <Text style={styles.historyDocType}>{item.documentType || 'Unknown'}</Text>
                  <Text style={styles.historyTime}>
                    {item.documentId?.substring(0, 12)}...
                  </Text>
                </View>
                <Text style={[styles.historyStatus, { color: item.valid ? colors.success : colors.error }]}>
                  {item.valid ? 'Verified' : 'Failed'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  inputCard: { backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg, ...shadows.sm, marginBottom: spacing.md },
  inputTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  inputSubtext: { fontSize: 13, color: colors.textLight, marginBottom: spacing.md },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: 14, color: colors.text, fontFamily: 'monospace', minHeight: 80, textAlignVertical: 'top' },
  inputActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  clearBtn: { flex: 1, backgroundColor: colors.background, paddingVertical: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  clearBtnText: { fontSize: 15, fontWeight: '600', color: colors.text },
  verifyBtn: { flex: 2, backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center' },
  verifyBtnDisabled: { opacity: 0.6 },
  verifyBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  resultCard: { borderRadius: borderRadius.xl, padding: spacing.lg, ...shadows.sm, marginBottom: spacing.md },
  resultValid: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' },
  resultInvalid: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  resultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  resultIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  resultIconText: { fontSize: 24, fontWeight: '700' },
  resultTitleArea: { flex: 1 },
  resultTitle: { fontSize: 18, fontWeight: '700' },
  resultSubtext: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  resultDetails: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: borderRadius.lg, padding: spacing.md },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  detailLabel: { fontSize: 12, color: colors.textLight, fontWeight: '500' },
  detailValue: { fontSize: 12, color: colors.text, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  auditSection: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)' },
  auditTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  auditEntry: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  auditDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 4, marginRight: spacing.sm },
  auditContent: { flex: 1 },
  auditAction: { fontSize: 13, fontWeight: '500', color: colors.text },
  auditMeta: { fontSize: 11, color: colors.textLight, marginTop: 1 },
  qrSection: { marginTop: spacing.md, alignItems: 'center', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)' },
  qrTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  qrWrapper: { padding: spacing.md, backgroundColor: colors.white, borderRadius: borderRadius.lg },
  historyCard: { backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg, ...shadows.sm },
  historyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  historyDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  historyContent: { flex: 1 },
  historyDocType: { fontSize: 14, fontWeight: '500', color: colors.text },
  historyTime: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  historyStatus: { fontSize: 12, fontWeight: '600' },
});
