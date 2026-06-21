import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface SuperAdminMediaProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = spacing.sm;
const GRID_COLS = 2;
const ITEM_WIDTH = (SCREEN_WIDTH - spacing.md * 2 - GRID_GAP) / GRID_COLS;

type MediaTab = 'All' | 'Images' | 'Documents';

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—';
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
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
}

function getFileTypeIcon(mimeType?: string, format?: string): string {
  if (!mimeType && !format) return '📄';
  const mt = (mimeType || format || '').toLowerCase();
  if (mt.includes('image') || mt.includes('png') || mt.includes('jpg') || mt.includes('jpeg') || mt.includes('gif') || mt.includes('webp')) return '🖼️';
  if (mt.includes('pdf')) return '📕';
  if (mt.includes('video') || mt.includes('mp4') || mt.includes('mov')) return '🎬';
  if (mt.includes('audio') || mt.includes('mp3') || mt.includes('wav')) return '🎵';
  if (mt.includes('zip') || mt.includes('rar') || mt.includes('tar')) return '🗜️';
  if (mt.includes('doc') || mt.includes('word')) return '📝';
  if (mt.includes('xls') || mt.includes('sheet')) return '📊';
  return '📄';
}

export const SuperAdminMediaScreen: React.FC<SuperAdminMediaProps> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [media, setMedia] = useState<any[]>([]);
  const [mediaStats, setMediaStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<MediaTab>('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [mediaRes, statsRes] = await Promise.all([
        apiService.getMedia(),
        apiService.getMediaStats(),
      ]);
      const items = Array.isArray(mediaRes) ? mediaRes : mediaRes?.items || mediaRes?.data?.items || mediaRes?.files || [];
      setMedia(items);
      setMediaStats(statsRes?.data || statsRes);
    } catch (err) {
      console.error('Failed to load media:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filteredMedia = media.filter((item) => {
    if (activeTab === 'All') return true;
    const mime = item.mimeType || item.format || item.type || '';
    if (activeTab === 'Images') return mime.toLowerCase().includes('image');
    if (activeTab === 'Documents') return !mime.toLowerCase().includes('image');
    return true;
  });

  const handleDelete = (item: any) => {
    const publicId = item.publicId || item.public_id || item.id;
    Alert.alert(
      'Delete Media',
      `Are you sure you want to delete "${item.name || item.filename || 'this file'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteMedia(publicId);
              loadData();
              Alert.alert('Success', 'Media deleted');
            } catch (err) {
              Alert.alert('Error', 'Failed to delete media');
            }
          },
        },
      ]
    );
  };

  const handleUpload = async () => {
    try {
      const DocumentPicker = require('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        type: file.mimeType || 'application/octet-stream',
        name: file.name || 'upload',
      } as any);
      await apiService.uploadMedia(formData);
      Alert.alert('Success', 'File uploaded');
      loadData();
    } catch (err: any) {
      if (err?.message !== 'User cancelled') {
        Alert.alert('Error', err?.message || 'Failed to upload file');
      }
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const thumbnailUrl = item.thumbnailUrl || item.thumbnail_url || item.url || item.secure_url;
    const isImage = (item.mimeType || item.format || '').toLowerCase().includes('image');
    const fileSize = item.size || item.bytes || item.fileSize;
    const fileName = item.name || item.filename || item.publicId || 'Untitled';
    const fileFormat = item.format || item.mimeType?.split('/')[1] || '';

    return (
      <TouchableOpacity
        style={styles.gridItem}
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.7}
      >
        <View style={styles.thumbnailContainer}>
          {isImage && thumbnailUrl ? (
            <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} resizeMode="cover" />
          ) : (
            <View style={styles.fileTypePlaceholder}>
              <Text style={styles.fileTypeIcon}>{getFileTypeIcon(item.mimeType, item.format)}</Text>
            </View>
          )}
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>{fileName}</Text>
          <View style={styles.itemMetaRow}>
            {fileFormat ? (
              <View style={styles.formatBadge}>
                <Text style={styles.formatBadgeText}>{fileFormat.toUpperCase()}</Text>
              </View>
            ) : null}
            <Text style={styles.itemSize}>{formatFileSize(fileSize)}</Text>
          </View>
          <Text style={styles.itemDate}>{formatDate(item.createdAt || item.created_at || item.uploadedAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const totalFiles = mediaStats?.totalFiles ?? mediaStats?.total_count ?? media.length;
  const storageUsed = mediaStats?.storageUsed ?? mediaStats?.storage_used ?? '—';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Media Library"
        subtitle={`${totalFiles} files · ${typeof storageUsed === 'string' ? storageUsed : formatFileSize(storageUsed)}`}
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔍', onPress: () => {} }}
      />

      <View style={styles.tabRow}>
        {(['All', 'Images', 'Documents'] as MediaTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredMedia}
        renderItem={renderItem}
        keyExtractor={(item, index) => item.id || item.publicId || item._id || String(index)}
        numColumns={GRID_COLS}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>☁️</Text>
              <Text style={styles.emptyText}>No media files found</Text>
              <Text style={styles.emptySubtext}>Tap + to upload files</Text>
            </View>
          ) : null
        }
      />

      <TouchableOpacity style={styles.fab} onPress={handleUpload} activeOpacity={0.8}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md, backgroundColor: colors.background, alignItems: 'center' },
  tabActive: { backgroundColor: colors.purple },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textLight },
  tabTextActive: { color: colors.white },
  listContent: { padding: spacing.md, paddingBottom: 80 },
  columnWrapper: { gap: GRID_GAP },
  gridItem: { width: ITEM_WIDTH, backgroundColor: colors.white, borderRadius: borderRadius.lg, overflow: 'hidden', marginBottom: spacing.sm, ...shadows.card },
  thumbnailContainer: { width: '100%', height: ITEM_WIDTH * 0.75, backgroundColor: colors.background },
  thumbnail: { width: '100%', height: '100%' },
  fileTypePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fileTypeIcon: { fontSize: 36 },
  itemInfo: { padding: spacing.sm },
  itemName: { fontSize: 12, fontWeight: '600', color: colors.text, marginBottom: 4 },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  formatBadge: { backgroundColor: colors.purpleLight, paddingHorizontal: 6, paddingVertical: 1, borderRadius: borderRadius.sm },
  formatBadgeText: { fontSize: 9, fontWeight: '700', color: colors.purple },
  itemSize: { fontSize: 11, color: colors.textLight },
  itemDate: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md, opacity: 0.5 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.textLight },
  emptySubtext: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.purple, justifyContent: 'center', alignItems: 'center', ...shadows.lg },
  fabText: { fontSize: 28, color: colors.white, lineHeight: 30, fontWeight: '300' },
});
