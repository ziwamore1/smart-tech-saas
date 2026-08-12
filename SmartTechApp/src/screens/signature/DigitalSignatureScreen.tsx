import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
  PanResponder,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Image } from 'expo-image';
import { captureRef } from 'react-native-view-shot';
import Svg, { Path, G } from 'react-native-svg';
import { apiService } from '../../services/api';
import { DigitalSignature } from '../../types';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PAD_WIDTH = SCREEN_WIDTH - spacing.md * 4;
const PAD_HEIGHT = 200;

function truncateHash(hash?: string): string {
  if (!hash) return '';
  return hash.length > 20 ? hash.substring(0, 10) + '...' + hash.substring(hash.length - 6) : hash;
}

function SignaturePad({ onCapture }: { onCapture: (data: string) => void }) {
  const [paths, setPaths] = useState<{ x: number; y: number }[][]>([]);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const isDrawingRef = useRef(false);
  const padRef = useRef<View>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        isDrawingRef.current = true;
        setCurrentPath([{ x: locationX, y: locationY }]);
      },
      onPanResponderMove: (evt) => {
        if (!isDrawingRef.current) return;
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath((prev) => [...prev, { x: locationX, y: locationY }]);
      },
       onPanResponderRelease: (evt) => {
        isDrawingRef.current = false;
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath((path) => {
          const completedPath = path.length > 0
            ? [...path, { x: locationX, y: locationY }]
            : path;
          if (completedPath.length > 0) {
            setPaths((prev) => [...prev, completedPath]);
          }
          return [];
        });
      },
    })
  ).current;

  const handleClear = () => {
    setPaths([]);
    setCurrentPath([]);
  };

  const handleSave = async () => {
    if (paths.length === 0 && currentPath.length === 0) {
      Alert.alert('Empty', 'Please draw a signature first');
      return;
    }
    try {
      const data = await captureRef(padRef, { format: 'png', quality: 1, result: 'base64' });
      onCapture(`data:image/png;base64,${data}`);
      handleClear();
    } catch {
      Alert.alert('Capture failed', 'Unable to create a signature image. Please try again.');
    }
  };

  const pathToSvgPath = (points: { x: number; y: number }[]): string => {
    if (points.length < 2) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  };

  return (
    <View style={styles.padContainer}>
      <View ref={padRef} collapsable={false} style={styles.pad} {...panResponder.panHandlers}>
        <Svg width={PAD_WIDTH} height={PAD_HEIGHT}>
          <G stroke="#000" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
            {paths.map((path, i) => (
              <Path key={i} d={pathToSvgPath(path)} />
            ))}
            {currentPath.length > 0 && <Path d={pathToSvgPath(currentPath)} />}
          </G>
        </Svg>
        {paths.length === 0 && currentPath.length === 0 && (
          <View style={styles.padPlaceholderOverlay}>
            <Text style={styles.padPlaceholder}>Draw your signature here</Text>
          </View>
        )}
      </View>
      <View style={styles.padActions}>
        <TouchableOpacity style={styles.clearPadBtn} onPress={handleClear}>
          <Text style={styles.clearPadBtnText}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.savePadBtn} onPress={handleSave}>
          <Text style={styles.savePadBtnText}>Capture</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function DigitalSignatureScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [signatures, setSignatures] = useState<DigitalSignature[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [signatureMethod, setSignatureMethod] = useState<'draw' | 'upload'>('draw');
  const [signatureImageUrl, setSignatureImageUrl] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [saving, setSaving] = useState(false);

  const [signDocModalVisible, setSignDocModalVisible] = useState(false);
  const [signDocSignatureId, setSignDocSignatureId] = useState('');
  const [documentHash, setDocumentHash] = useState('');
  const [signingDoc, setSigningDoc] = useState(false);

  const fetchSignatures = useCallback(async () => {
    try {
      const data = await apiService.getSignatures();
      setSignatures(data?.signatures ?? data ?? []);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to load signatures');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchSignatures();
  }, [fetchSignatures]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSignatures();
  }, [fetchSignatures]);

  const resetForm = () => {
    setName('');
    setTitle('');
    setEmail('');
    setSignatureMethod('draw');
    setSignatureImageUrl('');
    setSignatureData('');
  };

  const handleUploadImage = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const file = result.assets[0];
       const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
       const mimeType = file.mimeType || 'image/png';
       setSignatureImageUrl(`data:${mimeType};base64,${base64}`);
      setSignatureMethod('upload');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to pick image');
    }
  };

  const handleCaptureSignature = (data: string) => {
    setSignatureData(data);
    setSignatureMethod('draw');
    Alert.alert('Success', 'Signature captured');
  };

  const handleCreateSignature = async () => {
    if (!name.trim()) {
      Alert.alert('Input Required', 'Please enter a name');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        title: title.trim() || undefined,
        email: email.trim() || undefined,
      };
      if (signatureMethod === 'upload' && signatureImageUrl) {
        payload.imageUrl = signatureImageUrl;
      } else if (signatureMethod === 'draw' && signatureData) {
        payload.signatureData = signatureData;
      }
      const result = await apiService.createSignature(payload);
      setSignatures((prev) => [...prev, result?.signature ?? result]);
      setModalVisible(false);
      resetForm();
      Alert.alert('Success', 'Signature created');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create signature');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSignature = (id: string) => {
    Alert.alert('Delete Signature', 'Are you sure you want to delete this signature?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.deleteSignature(id);
            setSignatures((prev) => prev.filter((s) => s.id !== id));
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to delete signature');
          }
        },
      },
    ]);
  };

  const handleSignDocumentPress = (signatureId: string) => {
    setSignDocSignatureId(signatureId);
    setDocumentHash('');
    setSignDocModalVisible(true);
  };

  const handleExportSignature = async (sig: DigitalSignature) => {
    try {
      const dir = FileSystem.documentDirectory + 'signatures/';
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }

      const safeName = sig.name.replace(/[^a-z0-9_-]+/gi, '_');
      const imageData = sig.imageUrl || sig.signatureData || '';
      if (imageData.startsWith('data:image/')) {
        const base64 = imageData.substring(imageData.indexOf(',') + 1);
        const fileUri = dir + `${safeName}.png`;
        await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(fileUri, { mimeType: 'image/png', dialogTitle: `Share ${sig.name} Signature` });
        return;
      }

      const fileUri = dir + `${safeName}.json`;
      const content = JSON.stringify({
        name: sig.name,
        title: sig.title,
        email: sig.email,
        certificate: sig.certificate,
        createdAt: new Date().toISOString(),
      }, null, 2);

      await FileSystem.writeAsStringAsync(fileUri, content);
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: `Share ${sig.name} Signature`,
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to export signature');
    }
  };

  const handleSignDocument = async () => {
    if (!documentHash.trim()) {
      Alert.alert('Input Required', 'Please enter a document hash');
      return;
    }
    setSigningDoc(true);
    try {
      await apiService.signDocument(signDocSignatureId, documentHash.trim());
      setSignDocModalVisible(false);
      Alert.alert('Success', 'Document signed successfully');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to sign document');
    } finally {
      setSigningDoc(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Digital Signatures</Text>
        <TouchableOpacity style={styles.createHeaderBtn} onPress={() => { resetForm(); setModalVisible(true); }}>
          <Text style={styles.createHeaderBtnText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {signatures.length === 0 ? (
          <Text style={styles.emptyText}>No signatures yet. Create one to get started!</Text>
        ) : (
          signatures.map((sig) => (
            <View key={sig.id} style={styles.signatureCard}>
              <View style={styles.sigHeader}>
                <Text style={styles.sigName}>{sig.name}</Text>
                {sig.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>Default</Text>
                  </View>
                )}
              </View>

              <View style={styles.sigBody}>
                <View style={styles.sigPreview}>
                  {sig.imageUrl ? (
                    <Image source={{ uri: sig.imageUrl }} style={styles.signatureImage} contentFit="contain" />
                  ) : sig.signatureData ? (
                    <Image source={{ uri: sig.signatureData }} style={styles.signatureImage} contentFit="contain" />
                  ) : (
                    <View style={styles.sigNoImage}>
                      <Text style={styles.sigNoImageText}>No signature</Text>
                    </View>
                  )}
                </View>
                <View style={styles.sigInfo}>
                  {sig.title && <Text style={styles.sigDetail}>{sig.title}</Text>}
                  {sig.email && <Text style={styles.sigDetail}>{sig.email}</Text>}
                  {sig.certificate && (
                    <Text style={styles.sigHash}>Hash: {truncateHash(sig.certificate)}</Text>
                  )}
                </View>
              </View>

              <View style={styles.sigActions}>
                <TouchableOpacity style={styles.signDocBtn} onPress={() => handleSignDocumentPress(sig.id)}>
                  <Text style={styles.signDocBtnText}>Sign Document</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.exportSigBtn} onPress={() => handleExportSignature(sig)}>
                  <Text style={styles.exportSigBtnText}>📤</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteSigBtn} onPress={() => handleDeleteSignature(sig.id)}>
                  <Text style={styles.deleteSigBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <ScrollView style={styles.modalOverlay} contentContainerStyle={styles.modalContentContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Signature</Text>

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.textLight} />

            <Text style={styles.fieldLabel}>Title (optional)</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Principal" placeholderTextColor={colors.textLight} />

            <Text style={styles.fieldLabel}>Email (optional)</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="email@school.com" placeholderTextColor={colors.textLight} autoCapitalize="none" keyboardType="email-address" />

            <Text style={styles.fieldLabel}>Signature Input Method</Text>
            <View style={styles.methodRow}>
              <TouchableOpacity
                style={[styles.methodBtn, signatureMethod === 'draw' && styles.methodBtnActive]}
                onPress={() => setSignatureMethod('draw')}
              >
                <Text style={[styles.methodBtnText, signatureMethod === 'draw' && styles.methodBtnTextActive]}>Draw</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.methodBtn, signatureMethod === 'upload' && styles.methodBtnActive]}
                onPress={() => setSignatureMethod('upload')}
              >
                <Text style={[styles.methodBtnText, signatureMethod === 'upload' && styles.methodBtnTextActive]}>Upload Image</Text>
              </TouchableOpacity>
            </View>

            {signatureMethod === 'draw' ? (
              <SignaturePad onCapture={handleCaptureSignature} />
            ) : (
              <View>
                <TouchableOpacity style={styles.uploadImageBtn} onPress={handleUploadImage}>
                  <Text style={styles.uploadImageBtnText}>
                    {signatureImageUrl ? 'Change Image' : 'Pick Signature Image'}
                  </Text>
                </TouchableOpacity>
                {signatureImageUrl ? (
                  <Text style={styles.uploadedFileName} numberOfLines={1}>Image selected</Text>
                ) : null}
              </View>
            )}

            <View style={[styles.modalActions, { paddingBottom: Math.max(spacing.md, insets.bottom) }]}>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveModalBtn} onPress={handleCreateSignature} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.saveModalBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </Modal>

      <Modal visible={signDocModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.simpleModal}>
            <Text style={styles.modalTitle}>Sign Document</Text>
            <Text style={styles.fieldLabel}>Document Hash</Text>
            <TextInput
              style={styles.input}
              value={documentHash}
              onChangeText={setDocumentHash}
              placeholder="Enter document hash"
              placeholderTextColor={colors.textLight}
              autoCapitalize="none"
            />
            <View style={[styles.modalActions, { paddingBottom: Math.max(spacing.md, insets.bottom) }]}>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setSignDocModalVisible(false)}>
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveModalBtn} onPress={handleSignDocument} disabled={signingDoc}>
                {signingDoc ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.saveModalBtnText}>Sign</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.h1 },
  createHeaderBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
  createHeaderBtnText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  emptyText: { ...typography.bodySmall, textAlign: 'center', padding: spacing.xxl },
  signatureCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  sigHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sigName: { ...typography.h3 },
  defaultBadge: { backgroundColor: colors.success, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  defaultBadgeText: { color: colors.white, fontSize: 11, fontWeight: '600' },
  sigBody: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  sigPreview: { width: 70, height: 50, borderRadius: borderRadius.md, overflow: 'hidden' },
  signatureImage: { width: '100%', height: '100%', backgroundColor: '#f8fafc' },
  sigImagePlaceholder: { flex: 1, backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center' },
  sigImageIcon: { fontSize: 24 },
  sigDrawnPreview: { flex: 1, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center' },
  sigDrawnIcon: { fontSize: 24 },
  sigNoImage: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  sigNoImageText: { ...typography.caption, fontSize: 10 },
  sigInfo: { flex: 1, justifyContent: 'center' },
  sigDetail: { ...typography.bodySmall, marginBottom: 2 },
  sigHash: { ...typography.caption, fontFamily: 'monospace', marginTop: 2 },
  sigActions: { flexDirection: 'row', gap: spacing.sm },
  signDocBtn: { flex: 2, backgroundColor: colors.primary, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center' },
  signDocBtnText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  exportSigBtn: { backgroundColor: colors.secondary, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  exportSigBtnText: { fontSize: 16 },
  deleteSigBtn: { flex: 1, backgroundColor: colors.error, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center' },
  deleteSigBtnText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContentContainer: { justifyContent: 'center', padding: spacing.md },
  modalContent: { backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg },
  simpleModal: { backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg, margin: spacing.md },
  modalTitle: { ...typography.h2, marginBottom: spacing.md },
  fieldLabel: { ...typography.bodySmall, fontWeight: '600', marginBottom: spacing.xs, marginTop: spacing.sm },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.sm, fontSize: 15, color: colors.text, marginBottom: spacing.sm },
  methodRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  methodBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  methodBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  methodBtnText: { ...typography.bodySmall, fontWeight: '600', color: colors.text },
  methodBtnTextActive: { color: colors.white },
  padContainer: { marginBottom: spacing.md },
  pad: {
    width: PAD_WIDTH,
    height: PAD_HEIGHT,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  padPlaceholderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  padPlaceholder: { ...typography.bodySmall, color: colors.textLight, textAlign: 'center' },
  padActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  clearPadBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  clearPadBtnText: { ...typography.bodySmall, fontWeight: '600' },
  savePadBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center', backgroundColor: colors.primary },
  savePadBtnText: { color: colors.white, fontWeight: '600' },
  uploadImageBtn: { backgroundColor: colors.secondary, paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', marginBottom: spacing.sm },
  uploadImageBtnText: { color: colors.white, fontWeight: '600', fontSize: 15 },
  uploadedFileName: { ...typography.bodySmall, textAlign: 'center', color: colors.success },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  cancelModalBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', backgroundColor: colors.background },
  cancelModalBtnText: { ...typography.body, fontWeight: '600', color: colors.text },
  saveModalBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', backgroundColor: colors.primary },
  saveModalBtnText: { ...typography.body, fontWeight: '600', color: colors.white },
});
