import { create } from 'zustand';
import { EditorComponent, EditorSnapshot, ReportTemplate } from '../types';

interface EditorStoreState {
  template: ReportTemplate | null;
  components: EditorComponent[];
  selectedId: string | null;
  zoom: number;
  history: EditorSnapshot[];
  historyIndex: number;
  showGuides: boolean;
  snapToGrid: boolean;
  gridSize: number;
  clipboard: EditorComponent | null;
  isDirty: boolean;

  loadTemplate: (template: ReportTemplate) => void;
  setComponents: (components: EditorComponent[]) => void;
  selectComponent: (id: string | null) => void;
  updateComponent: (id: string, data: Partial<EditorComponent>) => void;
  addComponent: (component: Partial<TemplateComponent>) => void;
  deleteComponent: (id: string) => void;
  duplicateComponent: (id: string) => void;
  reorderComponent: (fromIndex: number, toIndex: number) => void;
  moveComponent: (id: string, x: number, y: number) => void;
  resizeComponent: (id: string, width: number, height: number) => void;

  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  toggleGuides: () => void;
  toggleSnapToGrid: () => void;
  setGridSize: (size: number) => void;

  copyComponent: (id: string) => void;
  pasteComponent: () => void;

  alignComponents: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  distributeComponents: (direction: 'horizontal' | 'vertical') => void;

  resetEditor: () => void;
}

const MAX_HISTORY = 50;

function createSnapshot(components: EditorComponent[]): EditorSnapshot {
  return { components: JSON.parse(JSON.stringify(components)) };
}

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  template: null,
  components: [],
  selectedId: null,
  zoom: 1,
  history: [],
  historyIndex: -1,
  showGuides: true,
  snapToGrid: true,
  gridSize: 10,
  clipboard: null,
  isDirty: false,

  loadTemplate: (template: ReportTemplate) => {
    const components = (template.components || []).map((c, i) => ({
      ...c,
      isSelected: false,
      isLocked: false,
      isHidden: false,
    }));
    const snapshot = createSnapshot(components);
    set({
      template,
      components,
      selectedId: null,
      zoom: 1,
      history: [snapshot],
      historyIndex: 0,
      showGuides: true,
      snapToGrid: true,
      gridSize: 10,
      clipboard: null,
      isDirty: false,
    });
  },

  setComponents: (components: EditorComponent[]) => {
    set({ components, isDirty: true });
  },

  selectComponent: (id: string | null) => {
    const { components } = get();
    set({
      selectedId: id,
      components: components.map((c) => ({ ...c, isSelected: c.id === id })),
    });
  },

  updateComponent: (id: string, data: Partial<EditorComponent>) => {
    const { components } = get();
    const newComponents = components.map((c) => (c.id === id ? { ...c, ...data } : c));
    const snapshot = createSnapshot(newComponents);
    const history = get().history.slice(0, get().historyIndex + 1);
    history.push(snapshot);
    if (history.length > MAX_HISTORY) history.shift();
    set({ components: newComponents, history, historyIndex: history.length - 1, isDirty: true });
  },

  addComponent: (component: Partial<TemplateComponent>) => {
    const { components, template } = get();
    const newComponent: EditorComponent = {
      id: `comp-${Date.now()}`,
      templateId: template?.id || '',
      type: component.type || 'TEXT_BLOCK',
      label: component.label || 'New Component',
      content: component.content || {},
      styles: component.styles || {},
      position: component.position || { x: 50, y: 50 },
      size: component.size || { width: 200, height: 40 },
      settings: component.settings || {},
      isRequired: component.isRequired || false,
      sortOrder: components.length,
      isSelected: true,
      isLocked: false,
      isHidden: false,
    };
    const newComponents = [
      ...components.map((c) => ({ ...c, isSelected: false })),
      newComponent,
    ];
    const snapshot = createSnapshot(newComponents);
    const history = get().history.slice(0, get().historyIndex + 1);
    history.push(snapshot);
    if (history.length > MAX_HISTORY) history.shift();
    set({
      components: newComponents,
      selectedId: newComponent.id,
      history,
      historyIndex: history.length - 1,
      isDirty: true,
    });
  },

  deleteComponent: (id: string) => {
    const { components, selectedId } = get();
    const newComponents = components.filter((c) => c.id !== id);
    const newSelectedId = selectedId === id ? null : selectedId;
    const snapshot = createSnapshot(newComponents);
    const history = get().history.slice(0, get().historyIndex + 1);
    history.push(snapshot);
    if (history.length > MAX_HISTORY) history.shift();
    set({
      components: newComponents,
      selectedId: newSelectedId,
      history,
      historyIndex: history.length - 1,
      isDirty: true,
    });
  },

  duplicateComponent: (id: string) => {
    const { components } = get();
    const source = components.find((c) => c.id === id);
    if (!source) return;
    const dup: EditorComponent = {
      ...JSON.parse(JSON.stringify(source)),
      id: `comp-${Date.now()}`,
      label: `${source.label} (Copy)`,
      position: { x: source.position.x + 20, y: source.position.y + 20 },
      isSelected: true,
      sortOrder: components.length,
    };
    const newComponents = [
      ...components.map((c) => ({ ...c, isSelected: false })),
      dup,
    ];
    const snapshot = createSnapshot(newComponents);
    const history = get().history.slice(0, get().historyIndex + 1);
    history.push(snapshot);
    if (history.length > MAX_HISTORY) history.shift();
    set({
      components: newComponents,
      selectedId: dup.id,
      history,
      historyIndex: history.length - 1,
      isDirty: true,
    });
  },

  reorderComponent: (fromIndex: number, toIndex: number) => {
    const { components } = get();
    const newComponents = [...components];
    const [moved] = newComponents.splice(fromIndex, 1);
    newComponents.splice(toIndex, 0, moved);
    const snapshot = createSnapshot(newComponents);
    const history = get().history.slice(0, get().historyIndex + 1);
    history.push(snapshot);
    if (history.length > MAX_HISTORY) history.shift();
    set({ components: newComponents, history, historyIndex: history.length - 1, isDirty: true });
  },

  moveComponent: (id: string, x: number, y: number) => {
    const { components, snapToGrid, gridSize } = get();
    const snappedX = snapToGrid ? Math.round(x / gridSize) * gridSize : x;
    const snappedY = snapToGrid ? Math.round(y / gridSize) * gridSize : y;
    set({
      components: components.map((c) =>
        c.id === id ? { ...c, position: { x: snappedX, y: snappedY } } : c
      ),
      isDirty: true,
    });
  },

  resizeComponent: (id: string, width: number, height: number) => {
    const { components, snapToGrid, gridSize } = get();
    const snappedW = snapToGrid ? Math.round(width / gridSize) * gridSize : width;
    const snappedH = snapToGrid ? Math.round(height / gridSize) * gridSize : height;
    set({
      components: components.map((c) =>
        c.id === id
          ? { ...c, size: { width: Math.max(20, snappedW), height: Math.max(10, snappedH) } }
          : c
      ),
      isDirty: true,
    });
  },

  setZoom: (zoom: number) => {
    set({ zoom: Math.max(0.25, Math.min(3, zoom)) });
  },

  zoomIn: () => {
    const { zoom } = get();
    set({ zoom: Math.min(3, +(zoom + 0.1).toFixed(2)) });
  },

  zoomOut: () => {
    const { zoom } = get();
    set({ zoom: Math.max(0.25, +(zoom - 0.1).toFixed(2)) });
  },

  zoomToFit: () => {
    set({ zoom: 1 });
  },

  undo: () => {
    const { historyIndex, history } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      set({
        components: JSON.parse(JSON.stringify(history[newIndex].components)),
        historyIndex: newIndex,
        selectedId: null,
        isDirty: true,
      });
    }
  },

  redo: () => {
    const { historyIndex, history } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      set({
        components: JSON.parse(JSON.stringify(history[newIndex].components)),
        historyIndex: newIndex,
        selectedId: null,
        isDirty: true,
      });
    }
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  toggleGuides: () => set({ showGuides: !get().showGuides }),
  toggleSnapToGrid: () => set({ snapToGrid: !get().snapToGrid }),
  setGridSize: (size: number) => set({ gridSize: size }),

  copyComponent: (id: string) => {
    const { components } = get();
    const comp = components.find((c) => c.id === id);
    if (comp) set({ clipboard: JSON.parse(JSON.stringify(comp)) });
  },

  pasteComponent: () => {
    const { clipboard, components } = get();
    if (!clipboard) return;
    const dup: EditorComponent = {
      ...JSON.parse(JSON.stringify(clipboard)),
      id: `comp-${Date.now()}`,
      label: `${clipboard.label} (Pasted)`,
      position: { x: clipboard.position.x + 30, y: clipboard.position.y + 30 },
      isSelected: true,
      sortOrder: components.length,
    };
    const newComponents = [
      ...components.map((c) => ({ ...c, isSelected: false })),
      dup,
    ];
    const snapshot = createSnapshot(newComponents);
    const history = get().history.slice(0, get().historyIndex + 1);
    history.push(snapshot);
    if (history.length > MAX_HISTORY) history.shift();
    set({
      components: newComponents,
      selectedId: dup.id,
      history,
      historyIndex: history.length - 1,
      isDirty: true,
    });
  },

  alignComponents: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    const { components } = get();
    const selected = components.filter((c) => c.isSelected);
    if (selected.length < 2) return;

    const bounds = selected.reduce(
      (acc, c) => ({
        minX: Math.min(acc.minX, c.position.x),
        maxX: Math.max(acc.maxX, c.position.x + c.size.width),
        minY: Math.min(acc.minY, c.position.y),
        maxY: Math.max(acc.maxY, c.position.y + c.size.height),
      }),
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    );

    const centerX = bounds.minX + (bounds.maxX - bounds.minX) / 2;
    const centerY = bounds.minY + (bounds.maxY - bounds.minY) / 2;

    const updates: Record<string, { x: number; y: number }> = {};
    for (const c of selected) {
      switch (alignment) {
        case 'left':
          updates[c.id] = { x: bounds.minX, y: c.position.y };
          break;
        case 'center':
          updates[c.id] = { x: centerX - c.size.width / 2, y: c.position.y };
          break;
        case 'right':
          updates[c.id] = { x: bounds.maxX - c.size.width, y: c.position.y };
          break;
        case 'top':
          updates[c.id] = { x: c.position.x, y: bounds.minY };
          break;
        case 'middle':
          updates[c.id] = { x: c.position.x, y: centerY - c.size.height / 2 };
          break;
        case 'bottom':
          updates[c.id] = { x: c.position.x, y: bounds.maxY - c.size.height };
          break;
      }
    }

    const newComponents = components.map((c) =>
      updates[c.id] ? { ...c, position: updates[c.id] } : c
    );
    const snapshot = createSnapshot(newComponents);
    const history = get().history.slice(0, get().historyIndex + 1);
    history.push(snapshot);
    if (history.length > MAX_HISTORY) history.shift();
    set({ components: newComponents, history, historyIndex: history.length - 1, isDirty: true });
  },

  distributeComponents: (direction: 'horizontal' | 'vertical') => {
    const { components } = get();
    const selected = components.filter((c) => c.isSelected);
    if (selected.length < 3) return;

    const sorted = [...selected].sort((a, b) =>
      direction === 'horizontal' ? a.position.x - b.position.x : a.position.y - b.position.y
    );

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalSpace =
      direction === 'horizontal'
        ? last.position.x - first.position.x
        : last.position.y - first.position.y;
    const gap = totalSpace / (sorted.length - 1);

    const updates: Record<string, { x: number; y: number }> = {};
    sorted.forEach((c, i) => {
      if (i === 0 || i === sorted.length - 1) return;
      const pos =
        direction === 'horizontal'
          ? first.position.x + gap * i
          : first.position.y + gap * i;
      updates[c.id] =
        direction === 'horizontal'
          ? { x: pos, y: c.position.y }
          : { x: c.position.x, y: pos };
    });

    const newComponents = components.map((c) =>
      updates[c.id] ? { ...c, position: updates[c.id] } : c
    );
    const snapshot = createSnapshot(newComponents);
    const history = get().history.slice(0, get().historyIndex + 1);
    history.push(snapshot);
    if (history.length > MAX_HISTORY) history.shift();
    set({ components: newComponents, history, historyIndex: history.length - 1, isDirty: true });
  },

  resetEditor: () => {
    set({
      template: null,
      components: [],
      selectedId: null,
      zoom: 1,
      history: [],
      historyIndex: -1,
      showGuides: true,
      snapToGrid: true,
      gridSize: 10,
      clipboard: null,
      isDirty: false,
    });
  },
}));
