import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Pdf from 'react-native-pdf';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { HeaderBar } from './HeaderBar';
import { colors, spacing, borderRadius, shadows } from '../theme';

interface ReportCardPdfViewerProps {
  visible: boolean;
  html: string;
  studentName?: string;
  termName?: string;
  onClose: () => void;
}

export const ReportCardPdfViewer: React.FC<ReportCardPdfViewerProps> = ({
  visible,
  html,
  studentName,
  termName,
  onClose,
}) => {
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    if (visible && html) {
      generatePdf();
    } else {
      setPdfUri(null);
      setError(null);
      setCurrentPage(1);
      setTotalPages(0);
    }
  }, [visible, html]);

  const generatePdf = async () => {
    try {
      setConverting(true);
      setError(null);
      const result = await Print.printToFileAsync({ html });
      setPdfUri(result.uri || null);
      if (!result.uri) setError('Could not generate a preview of this report card.');
    } catch (e: any) {
      setError(e?.message || 'Failed to generate report card preview.');
    } finally {
      setConverting(false);
    }
  };

  const handlePrint = async () => {
    try {
      await Print.printAsync({ html });
    } catch (e: any) {
      if (e?.message !== 'User did not share') Alert.alert('Error', 'Failed to print report card');
    }
  };

  const handleShare = async () => {
    if (!pdfUri) return;
    try {
      await Sharing.shareAsync(pdfUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share Report Card',
        UTI: 'com.adobe.pdf',
      });
    } catch (e: any) {
      if (e?.message !== 'User did not share') Alert.alert('Error', 'Failed to share PDF');
    }
  };

  const normalizedUri = pdfUri
    ? pdfUri.startsWith('file://') || pdfUri.startsWith('content://')
      ? pdfUri
      : `file://${pdfUri}`
    : '';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <HeaderBar
          title="Report Card"
          subtitle={studentName && termName ? `${studentName} • ${termName}` : studentName || termName || 'Full Report Card'}
          leftIcon={{ name: '✕', onPress: onClose }}
          rightIcon={pdfUri ? { name: '📤', onPress: handleShare } : undefined}
        />

        <View style={styles.toolbar}>
          <TouchableOpacity
            style={[styles.toolBtn, { backgroundColor: colors.secondary }]}
            onPress={handlePrint}
          >
            <Text style={styles.toolBtnText}>🖨 Print</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolBtn, { backgroundColor: colors.primary }]}
            onPress={handleShare}
          >
            <Text style={styles.toolBtnText}>⬇ Save / Share PDF</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.pdfContainer}>
          {converting && (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.hintText}>Preparing report card preview...</Text>
            </View>
          )}
          {!converting && error && (
            <View style={styles.centerContent}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={generatePdf}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
          {!converting && !error && pdfUri && (
            <>
              <Pdf
                source={{ uri: normalizedUri, cache: true }}
                style={styles.pdf}
                onLoadComplete={(numberOfPages) => setTotalPages(numberOfPages)}
                onPageChanged={(page) => setCurrentPage(page)}
                onError={(e: any) => setError(e?.message || 'Failed to load report card preview.')}
                enablePaging
                enableRTL={false}
                fitPolicy={0}
              />
              <View style={styles.footer}>
                <Text style={styles.pageText}>
                  Page {currentPage} of {totalPages || '?'}
                </Text>
                <Text style={styles.footerHint}>School Template Report Card</Text>
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toolBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  toolBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  pdfContainer: { flex: 1, backgroundColor: '#525659' },
  pdf: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height - 170,
  },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, backgroundColor: colors.white },
  hintText: { marginTop: spacing.md, fontSize: 14, color: colors.textLight },
  errorIcon: { fontSize: 48, marginBottom: spacing.md },
  errorText: { fontSize: 15, color: colors.textLight, textAlign: 'center', marginBottom: spacing.lg },
  retryBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: borderRadius.lg },
  retryText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pageText: { fontSize: 13, fontWeight: '600', color: colors.text },
  footerHint: { fontSize: 12, color: colors.textLight },
});
