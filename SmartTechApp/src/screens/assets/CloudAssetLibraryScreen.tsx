import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { apiService } from '../../services/api';
import { TemplateAsset, AssetCategory } from '../../types';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';

const ASSET_TYPE_ICONS: Record<string, string> = {
  logo: '🖼️',
  background: '🌄',
  border: '⊞',
  stamp: '🔏',
  image: '📷',
  font: '🔤',
  other: '📁',
};

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function CloudAssetLibraryScreen({ navigation }: any) {
  const [assets, setAssets] = useState<TemplateAsset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await apiService.getAssetCategories();
      setCategories(data?.categories ?? data ?? []);
    } catch {
      // non-critical
    }
  }, []);

  const fetchAssets = useCallback(async (type?: string, search?: string) => {
    try {
      const data = await apiService.getAssets(type || undefined, search || undefined);
      setAssets(data?.assets ?? data ?? []);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to load assets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    setLoading(true);
    fetchAssets(selectedCategory, searchQuery);
  }, [selectedCategory, fetchAssets]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAssets(selectedCategory, searchQuery);
  }, [selectedCategory, searchQuery, fetchAssets]);

  const handleSearch = useCallback(() => {
    setLoading(true);
    fetchAssets(selectedCategory, searchQuery);
  }, [selectedCategory, searchQuery, fetchAssets]);

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const file = result.assets[0];
      const formData = new FormData();

      const uri = file.uri;
      const fileName = file.name || 'asset';
      const mimeType = file.mimeType || 'application/octet-stream';

      formData.append('file', {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        name: fileName,
        type: mimeType,
      } as any);

      if (selectedCategory) {
        formData.append('type', selectedCategory);
      }

      setUploading(true);
      const response = await apiService.uploadAsset(formData);
      const newAsset = response?.asset ?? response;
      if (newAsset && newAsset.id) {
        setAssets((prev) => [newAsset, ...prev]);
      } else {
        await fetchAssets(selectedCategory, searchQuery);
      }
      Alert.alert('Success', 'Asset uploaded successfully');
    } catch (err: any) {
      Alert.alert('Upload Error', err?.message || 'Failed to upload asset');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (asset: TemplateAsset) => {
    Alert.alert('Delete Asset', `Are you sure you want to delete "${asset.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.deleteAsset(asset.id);
            setAssets((prev) => prev.filter((a) => a.id !== asset.id));
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to delete asset');
          }
        },
      },
    ]);
  };

  const renderAsset = ({ item }: { item: TemplateAsset }) => {
    const icon = ASSET_TYPE_ICONS[item.type] || ASSET_TYPE_ICONS.other;
    const ext = item.metadata?.originalName?.split('.').pop()?.toUpperCase() || item.type.toUpperCase();

    return (
      <TouchableOpacity
        style={styles.assetCard}
        onLongPress={() => handleDelete(item)}
        onPress={() => {}}
      >
        <View style={styles.thumbnail}>
          <Text style={styles.thumbnailIcon}>{icon}</Text>
        </View>
        <Text style={styles.assetName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.assetMeta}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{ext}</Text>
          </View>
          <Text style={styles.assetSize}>{formatFileSize(item.size)}</Text>
        </View>
        <TouchableOpacity style={styles.deleteIcon} onPress={() => handleDelete(item)}>
          <Text style={styles.deleteIconText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading && assets.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Asset Library</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search assets..."
          placeholderTextColor={colors.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.categoriesRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.chip, !selectedCategory && styles.chipActive]}
            onPress={() => setSelectedCategory('')}
          >
            <Text style={[styles.chipText, !selectedCategory && styles.chipTextActive]}>All</Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, selectedCategory === cat.id && styles.chipActive]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text style={styles.chipIcon}>{cat.icon}</Text>
              <Text style={[styles.chipText, selectedCategory === cat.id && styles.chipTextActive]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={assets}
        renderItem={renderAsset}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.columnWrapper}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No assets found</Text>}
      />

      <TouchableOpacity style={styles.fab} onPress={handleUpload} disabled={uploading}>
        {uploading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.fabText}>+</Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { ...typography.h1 },
  searchContainer: { flexDirection: 'row', padding: spacing.sm, gap: spacing.sm, backgroundColor: colors.white },
  searchInput: { flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.sm, fontSize: 15, color: colors.text },
  searchBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, justifyContent: 'center' },
  searchBtnText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  categoriesRow: { paddingVertical: spacing.sm, paddingLeft: spacing.sm, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, backgroundColor: colors.background, marginRight: spacing.sm },
  chipActive: { backgroundColor: colors.primary },
  chipIcon: { fontSize: 14, marginRight: 4 },
  chipText: { fontSize: 13, color: colors.text },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  gridContent: { padding: spacing.sm, paddingBottom: 80 },
  columnWrapper: { gap: spacing.sm },
  assetCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  thumbnail: {
    width: '100%',
    height: 100,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  thumbnailIcon: { fontSize: 36 },
  assetName: { ...typography.bodySmall, fontWeight: '500', marginBottom: 2 },
  assetMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  typeBadge: { backgroundColor: '#e0e7ff', paddingHorizontal: 6, paddingVertical: 1, borderRadius: borderRadius.sm },
  typeBadgeText: { fontSize: 10, color: colors.primary, fontWeight: '600' },
  assetSize: { ...typography.caption, fontSize: 11 },
  deleteIcon: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.error, justifyContent: 'center', alignItems: 'center' },
  deleteIconText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  emptyText: { ...typography.bodySmall, textAlign: 'center', padding: spacing.xxl },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  fabText: { color: colors.white, fontSize: 28, fontWeight: '300', lineHeight: 30 },
});
