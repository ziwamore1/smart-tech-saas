import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService, BASE_URL } from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface SuperAdminMonitoringProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${units[i]}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
}

export const SuperAdminMonitoringScreen: React.FC<SuperAdminMonitoringProps> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [mediaStats, setMediaStats] = useState<any>(null);
  const [recentUploads, setRecentUploads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaningUp, setCleaningUp] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, mediaRes] = await Promise.all([
        apiService.getMediaStats(),
        apiService.getMedia({ limit: 5 }),
      ]);
      setMediaStats(statsRes);
      const items = Array.isArray(mediaRes) ? mediaRes : mediaRes?.data || mediaRes?.files || [];
      setRecentUploads(items.slice(0, 5));
    } catch (err) {
      console.error('Failed to load monitoring data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    intervalRef.current = setInterval(loadData, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadData]);

  const totalFiles = mediaStats?.totalFiles ?? mediaStats?.total_count ?? 0;
  const storageUsed = mediaStats?.storageUsed ?? mediaStats?.storage_used ?? 0;
  const storageLimit = mediaStats?.storageLimit ?? mediaStats?.storage_limit ?? 1073741824;
  const usagePercent = storageLimit > 0 ? Math.min((storageUsed / storageLimit) * 100, 100) : 0;
  const redisAlive = mediaStats?.redis ?? mediaStats?.redis_status ?? true;
  const cloudinaryStatus = mediaStats?.cloudinary ?? mediaStats?.cloudinary_status ?? 'connected';
  const dbStatus = mediaStats?.database ?? mediaStats?.db_status ?? 'connected';

  const handleOrphanedCleanup = async () => {
    Alert.alert(
      'Run Orphaned Cleanup',
      'This will remove orphaned media files from Cloudinary. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run Cleanup',
          style: 'destructive',
          onPress: async () => {
            setCleaningUp(true);
            try {
              const response = await fetch(`${BASE_URL}/api/v1/media/orphaned`, { method: 'DELETE' });
              const result = await response.json();
              Alert.alert('Cleanup Complete', result?.message || 'Orphaned files removed successfully');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Cleanup failed');
            } finally {
              setCleaningUp(false);
            }
          },
        },
      ]
    );
  };

  const getUsageColor = () => {
    if (usagePercent > 90) return colors.error;
    if (usagePercent > 70) return colors.warning;
    return colors.success;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="System Monitoring"
        subtitle="Real-time system health"
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <WidgetCard title="Cloudinary Status">
          <View style={styles.healthCardContent}>
            <View style={styles.healthRow}>
              <View style={[styles.statusDot, { backgroundColor: cloudinaryStatus === 'connected' ? colors.success : colors.error }]} />
              <View style={styles.healthInfo}>
                <Text style={styles.healthLabel}>Connection</Text>
                <Text style={styles.healthValue}>{cloudinaryStatus === 'connected' ? 'Connected' : 'Disconnected'}</Text>
              </View>
            </View>
            <View style={styles.healthRow}>
              <View style={styles.healthIcon}>
                <Text style={styles.healthEmoji}>💾</Text>
              </View>
              <View style={styles.healthInfo}>
                <Text style={styles.healthLabel}>Storage Used</Text>
                <Text style={styles.healthValue}>{formatFileSize(storageUsed)}</Text>
              </View>
            </View>
          </View>
        </WidgetCard>

        <WidgetCard title="Redis Status">
          <View style={styles.healthRow}>
            <View style={[styles.statusDot, { backgroundColor: redisAlive ? colors.success : colors.error }]} />
            <View style={styles.healthInfo}>
              <Text style={styles.healthLabel}>Ping</Text>
              <Text style={styles.healthValue}>{redisAlive ? 'Alive' : 'Unreachable'}</Text>
            </View>
          </View>
        </WidgetCard>

        <WidgetCard title="Database Status">
          <View style={styles.healthRow}>
            <View style={[styles.statusDot, { backgroundColor: dbStatus === 'connected' ? colors.success : colors.error }]} />
            <View style={styles.healthInfo}>
              <Text style={styles.healthLabel}>Connection</Text>
              <Text style={styles.healthValue}>{dbStatus === 'connected' ? 'Connected' : 'Disconnected'}</Text>
            </View>
          </View>
        </WidgetCard>

        <WidgetCard title="Storage Usage">
          <View style={styles.storageBarContainer}>
            <View style={styles.storageBar}>
              <View style={[styles.storageBarFill, { width: `${Math.min(usagePercent, 100)}%`, backgroundColor: getUsageColor() }]} />
            </View>
            <Text style={styles.storagePercent}>{usagePercent.toFixed(1)}%</Text>
          </View>
          <View style={styles.storageMeta}>
            <Text style={styles.storageMetaText}>{formatFileSize(storageUsed)} used</Text>
            <Text style={styles.storageMetaText}>of {formatFileSize(storageLimit)}</Text>
          </View>
        </WidgetCard>

        <WidgetCard title="Recent Uploads" action={{ label: 'View All', onPress: () => navigation.navigate('SuperAdminMedia') }}>
          {recentUploads.map((item, index) => (
            <View key={item.id || item.publicId || index} style={styles.uploadRow}>
              <View style={styles.uploadIcon}>
                <Text>{item.mimeType?.includes('image') ? '🖼️' : '📄'}</Text>
              </View>
              <View style={styles.uploadInfo}>
                <Text style={styles.uploadName} numberOfLines={1}>{item.name || item.filename || item.publicId}</Text>
                <Text style={styles.uploadDate}>{formatDate(item.createdAt || item.created_at || item.uploadedAt)}</Text>
              </View>
              <Text style={styles.uploadSize}>{formatFileSize(item.size || item.bytes)}</Text>
            </View>
          ))}
          {recentUploads.length === 0 && !loading && (
            <Text style={styles.noUploads}>No recent uploads</Text>
          )}
        </WidgetCard>

        <TouchableOpacity
          style={[styles.cleanupBtn, cleaningUp && styles.cleanupBtnDisabled]}
          onPress={handleOrphanedCleanup}
          disabled={cleaningUp}
          activeOpacity={0.8}
        >
          <Text style={styles.cleanupBtnText}>{cleaningUp ? 'Cleaning up...' : 'Run Orphaned Cleanup'}</Text>
        </TouchableOpacity>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  healthCardContent: { gap: spacing.sm },
  healthRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginRight: spacing.md },
  healthIcon: { width: 12, height: 12, marginRight: spacing.md, justifyContent: 'center', alignItems: 'center' },
  healthEmoji: { fontSize: 12 },
  healthInfo: { flex: 1 },
  healthLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  healthValue: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  storageBarContainer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  storageBar: { flex: 1, height: 12, backgroundColor: colors.background, borderRadius: 6, overflow: 'hidden' },
  storageBarFill: { height: '100%', borderRadius: 6 },
  storagePercent: { fontSize: 14, fontWeight: '700', color: colors.text, minWidth: 48, textAlign: 'right' },
  storageMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  storageMetaText: { fontSize: 12, color: colors.textLight },
  uploadRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  uploadIcon: { marginRight: spacing.sm },
  uploadInfo: { flex: 1 },
  uploadName: { fontSize: 13, fontWeight: '500', color: colors.text },
  uploadDate: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  uploadSize: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  noUploads: { textAlign: 'center', color: colors.textLight, fontSize: 13, paddingVertical: spacing.md },
  cleanupBtn: { backgroundColor: colors.error, borderRadius: borderRadius.lg, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.md, ...shadows.card },
  cleanupBtnDisabled: { opacity: 0.6 },
  cleanupBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
