import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { VerificationResult } from '../../services/verification';

type RouteParams = {
  result?: VerificationResult;
  token: string;
  error?: string;
};

export function VerificationResultScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { result, token, error } = route.params as RouteParams;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return {
          color: '#10B981',
          bg: '#ECFDF5',
          icon: 'checkmark-circle' as const,
          label: 'FULLY VERIFIED',
        };
      case 'PARTIALLY_VERIFIED':
        return {
          color: '#F59E0B',
          bg: '#FFFBEB',
          icon: 'warning' as const,
          label: 'PARTIALLY VERIFIED',
        };
      case 'INVALID':
        return {
          color: '#EF4444',
          bg: '#FEF2F2',
          icon: 'close-circle' as const,
          label: 'INVALID',
        };
      default:
        return {
          color: '#6B7280',
          bg: '#F3F4F6',
          icon: 'help-circle' as const,
          label: 'UNVERIFIED',
        };
    }
  };

  const statusConfig = result ? getStatusConfig(result.overallStatus) : null;

  const VerificationBadge = ({ label, valid }: { label: string; valid: boolean }) => (
    <View
      style={[
        styles.badge,
        { backgroundColor: valid ? '#ECFDF5' : '#FEF2F2' },
      ]}
    >
      <Text style={styles.badgeLabel}>{label}</Text>
      <View style={styles.badgeRight}>
        <Ionicons
          name={valid ? 'checkmark-circle' : 'close-circle'}
          size={20}
          color={valid ? '#10B981' : '#EF4444'}
        />
        <Text
          style={[
            styles.badgeStatus,
            { color: valid ? '#065F46' : '#991B1B' },
          ]}
        >
          {valid ? 'VERIFIED' : 'NOT VERIFIED'}
        </Text>
      </View>
    </View>
  );

  const InfoField = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.infoField}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value || '-'}
      </Text>
    </View>
  );

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#EF4444" />
        <View style={styles.errorHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.errorHeaderTitle}>Verification Failed</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.errorContent}>
          <Ionicons name="alert-circle" size={80} color="#EF4444" />
          <Text style={styles.errorTitle}>Could Not Verify</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => navigation.navigate('QRScanner')}
          >
            <Ionicons name="scan" size={20} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.retryButtonText}>Scan Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={statusConfig?.color || '#6B7280'}
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: statusConfig?.color || '#6B7280' },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification Result</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View
              style={[
                styles.statusIcon,
                { backgroundColor: statusConfig?.color || '#6B7280' },
              ]}
            >
              <Ionicons
                name={statusConfig?.icon || 'help-circle'}
                size={40}
                color="white"
              />
            </View>
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusTitle}>Verification Result</Text>
              <Text
                style={[
                  styles.statusLabel,
                  { color: statusConfig?.color || '#6B7280' },
                ]}
              >
                {statusConfig?.label || 'UNKNOWN'}
              </Text>
            </View>
          </View>
        </View>

        {/* Document Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Document Information</Text>
          <View style={styles.card}>
            <InfoField label="Document ID" value={result?.documentId || '-'} />
            <View style={styles.divider} />
            <InfoField label="Document Type" value={result?.documentType || '-'} />
            <View style={styles.divider} />
            <InfoField label="Institution" value={result?.schoolName || '-'} />
            <View style={styles.divider} />
            <InfoField label="Verified At" value={result?.verifiedAt ? new Date(result.verifiedAt).toLocaleString() : '-'} />
          </View>
        </View>

        {/* Verification Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verification Checks</Text>
          <View style={styles.card}>
            <VerificationBadge
              label="Cryptographic Signature"
              valid={result?.signatureValid || false}
            />
            <View style={styles.badgeDivider} />
            <VerificationBadge
              label="Blockchain Verification"
              valid={result?.blockchainVerified || false}
            />
            <View style={styles.badgeDivider} />
            <VerificationBadge
              label="Ministry Verification"
              valid={result?.ministryVerified || false}
            />
            <View style={styles.badgeDivider} />
            <VerificationBadge
              label="Approval Chain"
              valid={result?.approvalChainComplete || false}
            />
          </View>
        </View>

        {/* Blockchain Details */}
        {result?.verificationDetails?.blockchain && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Blockchain Details</Text>
            <View style={styles.card}>
              <InfoField
                label="Network"
                value={result.verificationDetails.blockchain.network || '-'}
              />
              <View style={styles.divider} />
              <InfoField
                label="Transaction Hash"
                value={result.verificationDetails.blockchain.transactionHash || '-'}
              />
            </View>
          </View>
        )}

        {/* Approval Steps */}
        {result?.verificationDetails?.approvals && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Approval Chain</Text>
            <View style={styles.card}>
              <InfoField
                label="Status"
                value={result.verificationDetails.approvals.status || '-'}
              />
              <View style={styles.divider} />
              <InfoField
                label="Progress"
                value={`${result.verificationDetails.approvals.currentStep} / ${result.verificationDetails.approvals.totalSteps}`}
              />
            </View>
          </View>
        )}

        {/* Token */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verification Token</Text>
          <View style={styles.tokenCard}>
            <Text style={styles.tokenText}>{token}</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Bottom Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.scanAgainButton}
          onPress={() => navigation.navigate('QRScanner')}
        >
          <Ionicons name="scan" size={20} color="white" style={{ marginRight: 8 }} />
          <Text style={styles.scanAgainButtonText}>Scan Another</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#EF4444',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  errorHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  scrollView: {
    flex: 1,
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#6366F1',
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  statusCard: {
    margin: 16,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  infoField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  badge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  badgeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  badgeRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeStatus: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  badgeDivider: {
    height: 12,
  },
  tokenCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  tokenText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#6366F1',
    textAlign: 'center',
  },
  bottomBar: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  scanAgainButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#6366F1',
    borderRadius: 12,
  },
  scanAgainButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
