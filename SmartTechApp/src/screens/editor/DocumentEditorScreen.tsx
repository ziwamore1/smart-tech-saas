import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEditorStore } from '../../store/editorStore';
import { Toolbar } from '../../components/editor/Toolbar';
import { LayerPanel } from '../../components/editor/LayerPanel';
import { PropertyPanel } from '../../components/editor/PropertyPanel';
import { ZoomControls } from '../../components/editor/ZoomControls';
import { CanvasArea } from '../../components/editor/CanvasArea';
import { apiService } from '../../services/api';
import { AvailableComponent } from '../../types';
import { colors, spacing, borderRadius } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LAYER_PANEL_WIDTH = 240;
const PROPERTY_PANEL_WIDTH = 280;

export function DocumentEditorScreen({ route, navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const [showPropertyPanel, setShowPropertyPanel] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [availableComponents, setAvailableComponents] = useState<AvailableComponent[]>([]);
  const [availableComponentsLoading, setAvailableComponentsLoading] = useState(false);

  const store = useEditorStore();
  const autosaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialLoadDone = useRef(false);

  const templateId = route?.params?.templateId;

  const loadTemplate = useCallback(async () => {
    try {
      setLoading(true);
      if (templateId) {
        const response = await apiService.getTemplate(templateId);
        const template = response?.data || response;
        store.loadTemplate(template);
        setTemplateName(template.name || 'Untitled Template');
      } else {
        const response = await apiService.createTemplate({
          name: 'Untitled Template',
          templateType: 'REPORT_CARD',
          status: 'DRAFT',
        });
        const template = response?.data || response;
        store.loadTemplate(template);
        setTemplateName(template.name || 'Untitled Template');
        navigation.setParams({ templateId: template.id });
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load template');
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, [templateId]);

  useEffect(() => {
    loadTemplate();
    return () => {
      if (autosaveRef.current) {
        clearInterval(autosaveRef.current);
      }
      store.resetEditor();
    };
  }, []);

  useEffect(() => {
    if (!initialLoadDone.current) return;
    if (autosaveRef.current) {
      clearInterval(autosaveRef.current);
    }
    if (store.isDirty && store.template) {
      autosaveRef.current = setInterval(() => {
        handleSave(true);
      }, 30000);
    }
    return () => {
      if (autosaveRef.current) {
        clearInterval(autosaveRef.current);
      }
    };
  }, [store.isDirty, store.template?.id]);

  useEffect(() => {
    if (store.template?.name && !templateName) {
      setTemplateName(store.template.name);
    }
  }, [store.template?.name]);

  const handleSave = async (isAutosave = false) => {
    if (!store.template) return;
    try {
      if (!isAutosave) setSaving(true);
      const nameChanged = templateName !== store.template.name;
      if (nameChanged) {
        await apiService.updateTemplate(store.template.id, { name: templateName });
      }
      await apiService.saveTemplateLayout(store.template.id, {
        components: store.components.map((c) => ({
          id: c.id,
          type: c.type,
          label: c.label,
          content: c.content,
          styles: c.styles,
          position: c.position,
          size: c.size,
          settings: c.settings,
          isRequired: c.isRequired,
          sortOrder: c.sortOrder,
          parentId: c.parentId,
        })),
        layoutJson: store.template.layoutJson,
      });
      useEditorStore.setState({ isDirty: false });
    } catch (error: any) {
      if (!isAutosave) {
        Alert.alert('Save Error', error?.message || 'Failed to save template');
      }
    } finally {
      if (!isAutosave) setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!store.template) return;
    try {
      setPreviewLoading(true);
      const response = await apiService.renderTemplatePreview(store.template.id);
      const html = response?.data?.html || response?.html || '';
      setPreviewHtml(html || 'Preview ready - HTML content will appear here');
      setShowPreview(true);
    } catch (error: any) {
      setPreviewHtml('Preview ready - rendered template would display here');
      setShowPreview(true);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleBack = () => {
    if (store.isDirty) {
      Alert.alert('Unsaved Changes', 'You have unsaved changes. Do you want to save before leaving?', [
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        { text: 'Save', onPress: async () => { await handleSave(); navigation.goBack(); } },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      navigation.goBack();
    }
  };

  const handleSelectComponent = (id: string) => {
    store.selectComponent(id);
  };

  const handleMoveUp = (index: number) => {
    if (index < store.components.length - 1) {
      store.reorderComponent(index, index + 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index > 0) {
      store.reorderComponent(index, index - 1);
    }
  };

  const handleToggleVisibility = (id: string) => {
    const comp = store.components.find((c) => c.id === id);
    if (comp) {
      store.updateComponent(id, { isHidden: !comp.isHidden } as any);
    }
  };

  const handleToggleLock = (id: string) => {
    const comp = store.components.find((c) => c.id === id);
    if (comp) {
      store.updateComponent(id, { isLocked: !comp.isLocked } as any);
    }
  };

  const handleAddComponent = () => {
    setAvailableComponentsLoading(true);
    setShowAddComponent(true);
    apiService
      .getAvailableComponents()
      .then((response) => {
        const data = response?.data || response || [];
        setAvailableComponents(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setAvailableComponents([]);
      })
      .finally(() => {
        setAvailableComponentsLoading(false);
      });
  };

  const handleAddComponentToCanvas = (comp: AvailableComponent) => {
    store.addComponent({
      type: comp.type,
      label: comp.label,
    });
    setShowAddComponent(false);
  };

  const handleDelete = () => {
    if (store.selectedId) {
      Alert.alert('Delete Component', 'Are you sure you want to delete this component?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => store.deleteComponent(store.selectedId!) },
      ]);
    }
  };

  const groupedComponents = availableComponents.reduce<Record<string, AvailableComponent[]>>(
    (acc, comp) => {
      const cat = comp.category || 'Other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(comp);
      return acc;
    },
    {}
  );

  const selectedComponent = store.components.find((c) => c.id === store.selectedId) || null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading template...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleBack} style={styles.headerButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.headerButtonText}>←</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.titleInput}
            value={templateName}
            onChangeText={setTemplateName}
            placeholder="Template Name"
            placeholderTextColor="#94a3b8"
            selectTextOnFocus
          />
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => setShowLayerPanel((p) => !p)}
            style={[styles.headerButton, showLayerPanel && styles.headerButtonActive]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.headerButtonText, showLayerPanel && styles.headerButtonTextActive]}>☰</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowPropertyPanel((p) => !p)}
            style={[styles.headerButton, showPropertyPanel && styles.headerButtonActive]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.headerButtonText, showPropertyPanel && styles.headerButtonTextActive]}>⚙</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handlePreview} style={styles.headerButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.headerButtonText}>👁</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleSave()}
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <Toolbar
        onUndo={store.undo}
        onRedo={store.redo}
        canUndo={store.canUndo()}
        canRedo={store.canRedo()}
        onZoomIn={store.zoomIn}
        onZoomOut={store.zoomOut}
        onZoomToFit={store.zoomToFit}
        zoom={store.zoom}
        onAlign={store.alignComponents}
        onDistribute={store.distributeComponents}
        onToggleGrid={store.toggleSnapToGrid}
        snapToGrid={store.snapToGrid}
        onCopy={() => store.selectedId && store.copyComponent(store.selectedId)}
        onPaste={store.pasteComponent}
        onDelete={handleDelete}
        hasSelection={!!store.selectedId}
        hasMultipleSelection={store.components.filter((c) => c.isSelected).length > 1}
        hasClipboard={!!store.clipboard}
      />

      <View style={styles.mainArea}>
        {showLayerPanel && (
          <View style={styles.layerPanelWrapper}>
            <LayerPanel
              components={store.components}
              selectedId={store.selectedId}
              onSelect={handleSelectComponent}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onToggleVisibility={handleToggleVisibility}
              onToggleLock={handleToggleLock}
              onAddComponent={handleAddComponent}
            />
          </View>
        )}

        <View style={styles.canvasWrapper}>
          <CanvasArea
            components={store.components}
            selectedId={store.selectedId}
            zoom={store.zoom}
            snapToGrid={store.snapToGrid}
            gridSize={store.gridSize}
            showGuides={store.showGuides}
            onSelect={handleSelectComponent}
            onMove={store.moveComponent}
            onResize={store.resizeComponent}
          />
        </View>

        {showPropertyPanel && (
          <View style={styles.propertyPanelWrapper}>
            <PropertyPanel
              selectedComponent={selectedComponent}
              onUpdate={(data: any) => {
                if (selectedComponent) {
                  store.updateComponent(selectedComponent.id, data);
                }
              }}
              onDelete={handleDelete}
            />
          </View>
        )}
      </View>

      <ZoomControls
        zoom={store.zoom}
        onZoomIn={store.zoomIn}
        onZoomOut={store.zoomOut}
        onZoomToFit={store.zoomToFit}
      />

      <Modal
        visible={showAddComponent}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddComponent(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Component</Text>
              <TouchableOpacity
                onPress={() => setShowAddComponent(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {availableComponentsLoading ? (
              <View style={styles.modalLoadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.modalLoadingText}>Loading components...</Text>
              </View>
            ) : Object.keys(groupedComponents).length === 0 ? (
              <View style={styles.modalEmptyContainer}>
                <Text style={styles.modalEmptyText}>No components available</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {Object.entries(groupedComponents).map(([category, comps]) => (
                  <View key={category} style={styles.categorySection}>
                    <Text style={styles.categoryTitle}>{category}</Text>
                    <View style={styles.componentGrid}>
                      {comps.map((comp) => (
                        <TouchableOpacity
                          key={comp.type}
                          style={styles.componentItem}
                          onPress={() => handleAddComponentToCanvas(comp)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.componentIcon}>{comp.icon || '📄'}</Text>
                          <Text style={styles.componentLabel} numberOfLines={2}>
                            {comp.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPreview}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPreview(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.previewModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Preview</Text>
              <TouchableOpacity
                onPress={() => setShowPreview(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.previewBody}>
              {previewLoading ? (
                <View style={styles.modalLoadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.modalLoadingText}>Generating preview...</Text>
                </View>
              ) : (
                <ScrollView style={styles.previewScroll} contentContainerStyle={styles.previewScrollContent}>
                  <Text style={styles.previewText}>{previewHtml}</Text>
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.textLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonActive: {
    backgroundColor: '#334155',
  },
  headerButtonText: {
    fontSize: 18,
    color: '#e2e8f0',
  },
  headerButtonTextActive: {
    color: '#60a5fa',
  },
  titleInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
    marginLeft: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: '#334155',
    minWidth: 160,
    flex: 1,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.sm,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  mainArea: {
    flex: 1,
    flexDirection: 'row',
  },
  layerPanelWrapper: {
    width: LAYER_PANEL_WIDTH,
    backgroundColor: '#f8fafc',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
  },
  canvasWrapper: {
    flex: 1,
    backgroundColor: colors.white,
  },
  propertyPanelWrapper: {
    width: PROPERTY_PANEL_WIDTH,
    backgroundColor: '#f8fafc',
    borderLeftWidth: 1,
    borderLeftColor: '#e2e8f0',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: SCREEN_WIDTH * 0.85,
    maxHeight: '80%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalCloseText: {
    fontSize: 20,
    color: colors.textLight,
    fontWeight: '600',
  },
  modalLoadingContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  modalLoadingText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.textLight,
  },
  modalEmptyContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: 14,
    color: colors.textLight,
  },
  modalScroll: {
    padding: spacing.md,
  },
  categorySection: {
    marginBottom: spacing.lg,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  componentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  componentItem: {
    width: '30%',
    backgroundColor: '#f8fafc',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    minHeight: 80,
  },
  componentIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  componentLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'center',
  },
  previewModalContent: {
    width: SCREEN_WIDTH * 0.9,
    height: '80%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  previewBody: {
    flex: 1,
  },
  previewScroll: {
    flex: 1,
  },
  previewScrollContent: {
    padding: spacing.lg,
  },
  previewText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
});
