import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Pdf from 'react-native-pdf';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import { HeaderBar } from '../../components';
import { DigitalStamp, StampConfig } from '../../components/DigitalStamp';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';

interface PDFPreviewScreenProps {
  route?: {
    params: {
      documentId?: string;
      documentType?: string;
      documentName?: string;
      pdfUrl?: string;
      stampConfig?: StampConfig;
      showStamp?: boolean;
      verificationHash?: string;
    };
  };
  navigation: any;
}

export const PDFPreviewScreen: React.FC<PDFPreviewScreenProps> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const params = route?.params || {};
  const pdfRef = useRef<any>(null);
  const qrRef = useRef<any>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUri, setPdfUri] = useState<string | null>(params.pdfUrl || null);
  const [showQR, setShowQR] = useState(false);

  const documentId = params.documentId;
  const documentType = params.documentType || 'Document';
  const documentName = params.documentName || 'Untitled';
  const stampConfig = params.stampConfig;
  const showStamp = params.showStamp ?? false;
  const verificationHash = params.verificationHash;

  React.useEffect(() => {
    loadPDF();
  }, []);

  const loadPDF = async () => {
    if (pdfUri) {
      setLoading(false);
      return;
    }

    if (!documentId) {
      setError('No document ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await apiService.getDocumentPDF(documentId);
      
      if (response?.url) {
        const dir = FileSystem.cacheDirectory + 'pdfs/';
        const dirInfo = await FileSystem.getInfoAsync(dir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        }

        const fileUri = dir + `${documentId}.pdf`;
        const downloadResult = await FileSystem.downloadAsync(response.url, fileUri);

        if (downloadResult.status === 200) {
          setPdfUri(fileUri);
        } else {
          setError('Failed to download PDF');
        }
      } else {
        setError('No PDF URL returned');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleSharePDF = async () => {
    if (!pdfUri) {
      Alert.alert('Error', 'PDF not loaded yet');
      return;
    }
    try {
      await Sharing.shareAsync(pdfUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share ${documentName}`,
        UTI: 'com.adobe.pdf',
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to share PDF');
    }
  };

  const handleCaptureWithStamp = async () => {
    if (!qrRef.current) return;
    try {
      const uri = await captureRef(qrRef.current, {
        format: 'png',
        quality: 1,
      });
      await Sharing.shareAsync(uri);
    } catch (e) {
      Alert.alert('Error', 'Failed to capture');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <HeaderBar title="Document Preview" subtitle="Loading..." />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading document...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <HeaderBar
          title="Document Preview"
          subtitle={documentName}
          leftIcon={{ name: '←', onPress: () => navigation.goBack() }}
        />
        <View style={styles.centerContent}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadPDF}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const source = pdfUri
    ? { uri: Platform.OS === 'ios' ? pdfUri : `file://${pdfUri}`, cache: true }
    : { uri: '', cache: true };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Document Preview"
        subtitle={`${documentType} • ${documentName}`}
        leftIcon={{ name: '←', onPress: () => navigation.goBack() }}
        rightIcon={{ name: '📤', onPress: handleSharePDF }}
      />

      <View style={styles.pdfContainer}>
        {pdfUri ? (
          <>
            <Pdf
              ref={pdfRef}
              source={source}
              style={styles.pdf}
              onLoadComplete={(numberOfPages, filePath) => {
                setTotalPages(numberOfPages);
                console.log(`PDF loaded: ${numberOfPages} pages`);
              }}
              onPageChanged={(page, numberOfPages) => {
                setCurrentPage(page);
              }}
              onError={(error) => {
                setError(error.message);
              }}
              onPressLink={(uri) => {
                console.log(`Link pressed: ${uri}`);
              }}
              enablePaging
              enableRTL={false}
              fitPolicy={0}
            />

            {showStamp && stampConfig && (
              <View style={styles.stampOverlay} pointerEvents="none">
                <DigitalStamp
                  config={stampConfig}
                  width={120}
                  height={120}
                  position={{ x: Dimensions.get('window').width / 2 - 60, y: 50 }}
                  opacity={0.7}
                />
              </View>
            )}
          </>
        ) : (
          <View style={styles.centerContent}>
            <Text style={styles.errorIcon}>📄</Text>
            <Text style={styles.errorText}>Unable to load PDF</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.pageInfo}>
          <Text style={styles.pageText}>
            Page {currentPage} of {totalPages || '?'}
          </Text>
        </View>

        {verificationHash && (
          <TouchableOpacity style={styles.qrBtn} onPress={() => setShowQR(!showQR)}>
            <Text style={styles.qrBtnText}>📱 QR Code</Text>
          </TouchableOpacity>
        )}
      </View>

      {showQR && verificationHash && (
        <View style={[styles.qrModal, { paddingBottom: Math.max(spacing.lg, insets.bottom) }]} ref={qrRef} collapsable={false}>
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Document Verification</Text>
            <View style={styles.qrWrapper}>
              <QRCode
                value={verificationHash}
                size={180}
                color={colors.primary}
                backgroundColor="white"
              />
            </View>
            <Text style={styles.qrHash} numberOfLines={2}>{verificationHash}</Text>
            <Text style={styles.qrSubtext}>Scan to verify document authenticity</Text>
            <TouchableOpacity style={styles.qrShareBtn} onPress={handleCaptureWithStamp}>
              <Text style={styles.qrShareText}>Share QR Code</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  loadingText: { marginTop: spacing.md, fontSize: 14, color: colors.textLight },
  errorIcon: { fontSize: 48, marginBottom: spacing.md },
  errorText: { fontSize: 16, color: colors.textLight, textAlign: 'center', marginBottom: spacing.lg },
  retryBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: borderRadius.lg },
  retryText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  pdfContainer: { flex: 1, backgroundColor: '#525659' },
  pdf: { flex: 1, width: Dimensions.get('window').width, height: Dimensions.get('window').height - 160 },
  stampOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border },
  pageInfo: { flex: 1 },
  pageText: { fontSize: 14, fontWeight: '500', color: colors.text },
  qrBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.md },
  qrBtnText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  qrModal: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', padding: spacing.lg, justifyContent: 'flex-end' },
  qrCard: { backgroundColor: colors.white, borderRadius: borderRadius.xxl, padding: spacing.xl, alignItems: 'center' },
  qrTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  qrWrapper: { padding: spacing.md, backgroundColor: colors.white, borderRadius: borderRadius.lg, marginBottom: spacing.md },
  qrHash: { fontSize: 10, color: colors.textMuted, fontFamily: 'monospace', textAlign: 'center', maxWidth: '80%', marginBottom: spacing.xs },
  qrSubtext: { fontSize: 12, color: colors.textLight, marginBottom: spacing.lg },
  qrShareBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: borderRadius.lg },
  qrShareText: { color: colors.white, fontSize: 14, fontWeight: '600' },
});
