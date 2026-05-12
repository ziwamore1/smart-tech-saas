import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  PanResponder,
  Animated,
  StyleSheet,
  Dimensions,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme';
import { EditorComponent } from '../../types';

interface CanvasAreaProps {
  components: EditorComponent[];
  selectedId: string | null;
  zoom: number;
  snapToGrid: boolean;
  gridSize: number;
  showGuides: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, width: number, height: number) => void;
  pageWidth?: number;
  pageHeight?: number;
}

const DEFAULT_PAGE_W = 595;
const DEFAULT_PAGE_H = 842;
const HANDLE_SIZE = 8;
const ALIGN_THRESHOLD = 5;
const GRID_DOT_SIZE = 2;

interface GuideLine {
  axis: 'x' | 'y';
  value: number;
  start: number;
  end: number;
}

const snapToGridVal = (val: number, grid: number): number => {
  return Math.round(val / grid) * grid;
};

const ResizeHandle: React.FC<{
  position: { x: number; y: number; cx: number; cy: number };
  onResizeStart: () => void;
  onResizeMove: (dx: number, dy: number) => void;
  onResizeEnd: (dx: number, dy: number) => void;
}> = ({ position, onResizeStart, onResizeMove, onResizeEnd }) => {
  const handlePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        onResizeStart();
      },
      onPanResponderMove: (_, gesture) => {
        onResizeMove(gesture.dx, gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        onResizeEnd(gesture.dx, gesture.dy);
      },
    })
  ).current;

  return (
    <View
      style={[
        styles.resizeHandle,
        {
          left: position.x - HANDLE_SIZE / 2,
          top: position.y - HANDLE_SIZE / 2,
        },
      ]}
      {...handlePan.panHandlers}
    />
  );
};

const renderComponentContent = (comp: EditorComponent) => {
  const type = comp.type;
  const hasText = type === 'TEXT_BLOCK' || type === 'HEADING' || type === 'PARAGRAPH' ||
    type === 'CUSTOM_TEXT' || type === 'SCHOOL_NAME' || type === 'SCHOOL_INFO' ||
    type === 'STUDENT_NAME' || type === 'STUDENT_INFO';
  const hasImage = type === 'IMAGE' || type === 'SCHOOL_LOGO' || type === 'STUDENT_PHOTO';
  const isDivider = type === 'DIVIDER';
  const isTable = type === 'RESULTS_TABLE' || type === 'SUBJECT_TABLE' || type === 'GRADE_TABLE' ||
    type === 'ATTENDANCE_TABLE' || type === 'RANKING_TABLE';
  const isSignature = type === 'SIGNATURE' || type === 'STAMP' || type === 'SEAL';
  const isChart = type === 'PERFORMANCE_CHART' || type === 'BAR_CHART' || type === 'LINE_CHART' ||
    type === 'RADAR_CHART';
  const isQR = type === 'QR_CODE';

  if (hasText) {
    const textContent = comp.content
      ? typeof comp.content === 'string'
        ? comp.content
        : JSON.stringify(comp.content)
      : comp.placeholder || comp.label;
    return (
      <Text style={styles.componentText} numberOfLines={0}>
        {textContent}
      </Text>
    );
  }

  if (hasImage) {
    return (
      <View style={styles.imagePlaceholder}>
        <Text style={styles.imagePlaceholderIcon}>🖼</Text>
        <Text style={styles.imagePlaceholderLabel}>{comp.label}</Text>
      </View>
    );
  }

  if (isDivider) {
    return <View style={styles.dividerLine} />;
  }

  if (isTable) {
    return (
      <View style={styles.tablePlaceholder}>
        <Text style={styles.tablePlaceholderIcon}>⊞</Text>
        <Text style={styles.tablePlaceholderLabel}>{comp.label}</Text>
      </View>
    );
  }

  if (isSignature) {
    return (
      <View style={styles.signaturePlaceholder}>
        <Text style={styles.signatureIcon}>
          {type === 'SIGNATURE' ? '✍' : type === 'STAMP' ? '🔏' : '🫱'}
        </Text>
        <Text style={styles.signatureLabel}>{comp.label}</Text>
      </View>
    );
  }

  if (isChart) {
    return (
      <View style={styles.chartPlaceholder}>
        <Text style={styles.chartIcon}>📊</Text>
        <Text style={styles.chartLabel}>{comp.label}</Text>
      </View>
    );
  }

  if (isQR) {
    return (
      <View style={styles.qrPlaceholder}>
        <View style={styles.qrGrid}>
          {[0, 1, 2].map(row => (
            <View key={row} style={styles.qrRow}>
              {[0, 1, 2].map(col => (
                <View
                  key={col}
                  style={[
                    styles.qrCell,
                    (row + col) % 2 === 0 && styles.qrCellFilled,
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
        <Text style={styles.qrLabel}>{comp.label}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.defaultComponent, { backgroundColor: getTypeColor(type) }]}>
      <Text style={styles.defaultLabel}>{comp.label}</Text>
    </View>
  );
};

const getTypeColor = (type: string): string => {
  if (type.includes('TEXT') || type.includes('HEADING') || type.includes('PARAGRAPH')) return '#dbeafe';
  if (type.includes('IMAGE') || type.includes('LOGO') || type.includes('PHOTO')) return '#fce7f3';
  if (type.includes('TABLE')) return '#fef3c7';
  if (type.includes('CHART')) return '#d1fae5';
  if (type.includes('SIGNATURE') || type.includes('STAMP') || type.includes('SEAL')) return '#ede9fe';
  if (type.includes('DIVIDER')) return '#f1f5f9';
  if (type.includes('QR')) return '#e0e7ff';
  return '#f8fafc';
};

export const CanvasArea: React.FC<CanvasAreaProps> = ({
  components,
  selectedId,
  zoom,
  snapToGrid,
  gridSize,
  showGuides,
  onSelect,
  onMove,
  onResize,
  pageWidth = DEFAULT_PAGE_W,
  pageHeight = DEFAULT_PAGE_H,
}) => {
  const [guides, setGuides] = useState<GuideLine[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);

  const dragAnims = useRef<Map<string, Animated.ValueXY>>(new Map());
  const posRefs = useRef<Map<string, { x: number; y: number }>>(new Map());
  const resizeStartRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const screen = Dimensions.get('window');

  useEffect(() => {
    components.forEach((comp) => {
      if (!dragAnims.current.has(comp.id)) {
        dragAnims.current.set(comp.id, new Animated.ValueXY({ x: comp.position.x, y: comp.position.y }));
      }
      if (!posRefs.current.has(comp.id)) {
        posRefs.current.set(comp.id, { x: comp.position.x, y: comp.position.y });
      }
      const ref = posRefs.current.get(comp.id)!;
      ref.x = comp.position.x;
      ref.y = comp.position.y;
    });
  }, [components]);

  const getDragAnim = useCallback((id: string): Animated.ValueXY => {
    let anim = dragAnims.current.get(id);
    if (!anim) {
      anim = new Animated.ValueXY({ x: 0, y: 0 });
      dragAnims.current.set(id, anim);
    }
    return anim;
  }, []);

  const selectedComponent = useMemo(
    () => components.find((c) => c.id === selectedId) || null,
    [components, selectedId]
  );

  const checkGuides = useCallback(
    (compId: string, newX: number, newY: number, newW: number, newH: number) => {
      if (!showGuides) {
        setGuides([]);
        return;
      }

      const result: GuideLine[] = [];
      const comp = components.find((c) => c.id === compId);
      if (!comp) return;

      const otherComps = components.filter((c) => c.id !== compId && !c.isHidden);

      const compLeft = newX;
      const compRight = newX + newW;
      const compCenterX = newX + newW / 2;
      const compTop = newY;
      const compBottom = newY + newH;
      const compCenterY = newY + newH / 2;

      const pageW = pageWidth;
      const pageH = pageHeight;

      const checkAlign = (a: number, b: number): boolean => Math.abs(a - b) <= ALIGN_THRESHOLD;

      if (checkAlign(compLeft, 0)) {
        result.push({ axis: 'y', value: 0, start: 0, end: pageH });
      }
      if (checkAlign(compRight, pageW)) {
        result.push({ axis: 'y', value: pageW, start: 0, end: pageH });
      }
      if (checkAlign(compTop, 0)) {
        result.push({ axis: 'x', value: 0, start: 0, end: pageW });
      }
      if (checkAlign(compBottom, pageH)) {
        result.push({ axis: 'x', value: pageH, start: 0, end: pageW });
      }
      if (checkAlign(compCenterX, pageW / 2)) {
        result.push({ axis: 'y', value: pageW / 2, start: 0, end: pageH });
      }
      if (checkAlign(compCenterY, pageH / 2)) {
        result.push({ axis: 'x', value: pageH / 2, start: 0, end: pageW });
      }

      otherComps.forEach((other) => {
        const oLeft = other.position.x;
        const oRight = other.position.x + other.size.width;
        const oCenterX = other.position.x + other.size.width / 2;
        const oTop = other.position.y;
        const oBottom = other.position.y + other.size.height;
        const oCenterY = other.position.y + other.size.height / 2;

        const edges: Array<{ axis: 'x' | 'y'; value: number; a: number }> = [
          { axis: 'y', value: oLeft, a: compLeft },
          { axis: 'y', value: oLeft, a: compCenterX },
          { axis: 'y', value: oLeft, a: compRight },
          { axis: 'y', value: oRight, a: compLeft },
          { axis: 'y', value: oRight, a: compCenterX },
          { axis: 'y', value: oRight, a: compRight },
          { axis: 'y', value: oCenterX, a: compLeft },
          { axis: 'y', value: oCenterX, a: compCenterX },
          { axis: 'y', value: oCenterX, a: compRight },
          { axis: 'x', value: oTop, a: compTop },
          { axis: 'x', value: oTop, a: compCenterY },
          { axis: 'x', value: oTop, a: compBottom },
          { axis: 'x', value: oBottom, a: compTop },
          { axis: 'x', value: oBottom, a: compCenterY },
          { axis: 'x', value: oBottom, a: compBottom },
          { axis: 'x', value: oCenterY, a: compTop },
          { axis: 'x', value: oCenterY, a: compCenterY },
          { axis: 'x', value: oCenterY, a: compBottom },
        ];

        edges.forEach(({ axis, value, a }) => {
          if (checkAlign(a, value)) {
            const exists = result.some(
              (g) => g.axis === axis && Math.abs(g.value - value) < 1
            );
            if (!exists) {
              if (axis === 'y') {
                const top = Math.min(compTop, oTop);
                const bottom = Math.max(compBottom, oBottom);
                result.push({ axis: 'y', value, start: top, end: bottom });
              } else {
                const left = Math.min(compLeft, oLeft);
                const right = Math.max(compRight, oRight);
                result.push({ axis: 'x', value, start: left, end: right });
              }
            }
          }
        });
      });

      setGuides(result);
    },
    [components, showGuides, pageWidth, pageHeight]
  );

  const createComponentPanResponder = useCallback(
    (comp: EditorComponent) => {
      const anim = getDragAnim(comp.id);

      return PanResponder.create({
        onStartShouldSetPanResponder: () => !comp.isLocked,
        onMoveShouldSetPanResponder: () => !comp.isLocked,
        onPanResponderGrant: () => {
          onSelect(comp.id);
          setDraggingId(comp.id);
          const pos = posRefs.current.get(comp.id);
          if (pos) {
            anim.setOffset({ x: pos.x, y: pos.y });
            anim.setValue({ x: 0, y: 0 });
          }
        },
        onPanResponderMove: (_, gesture) => {
          let dx = gesture.dx;
          let dy = gesture.dy;

          if (snapToGrid) {
            const pos = posRefs.current.get(comp.id);
            if (pos) {
              const rawX = pos.x + gesture.dx;
              const rawY = pos.y + gesture.dy;
              const snappedX = snapToGridVal(rawX, gridSize);
              const snappedY = snapToGridVal(rawY, gridSize);
              dx = snappedX - pos.x;
              dy = snappedY - pos.y;
            }
          }

          anim.setValue({ x: dx, y: dy });

          const pos = posRefs.current.get(comp.id);
          if (pos) {
            checkGuides(
              comp.id,
              pos.x + gesture.dx,
              pos.y + gesture.dy,
              comp.size.width,
              comp.size.height
            );
          }
        },
        onPanResponderRelease: (_, gesture) => {
          anim.flattenOffset();

          let finalX = (posRefs.current.get(comp.id)?.x ?? comp.position.x) + gesture.dx;
          let finalY = (posRefs.current.get(comp.id)?.y ?? comp.position.y) + gesture.dy;

          if (snapToGrid) {
            finalX = snapToGridVal(finalX, gridSize);
            finalY = snapToGridVal(finalY, gridSize);
          }

          finalX = Math.max(0, Math.min(finalX, pageWidth - comp.size.width));
          finalY = Math.max(0, Math.min(finalY, pageHeight - comp.size.height));

          posRefs.current.set(comp.id, { x: finalX, y: finalY });
          anim.setValue({ x: finalX, y: finalY });
          anim.setOffset({ x: 0, y: 0 });

          setDraggingId(null);
          setGuides([]);
          onMove(comp.id, finalX, finalY);
        },
      });
    },
    [getDragAnim, onSelect, snapToGrid, gridSize, checkGuides, pageWidth, pageHeight, onMove]
  );

  const handleResizeStart = useCallback(() => {
    if (selectedComponent) {
      resizeStartRef.current = {
        x: selectedComponent.position.x,
        y: selectedComponent.position.y,
        w: selectedComponent.size.width,
        h: selectedComponent.size.height,
      };
      setResizingId(selectedComponent.id);
    }
  }, [selectedComponent]);

  const handleResizeEnd = useCallback(
    (dx: number, dy: number) => {
      setResizingId(null);
    },
    []
  );

  const pageScale = zoom;
  const scaledPageW = pageWidth * pageScale;
  const scaledPageH = pageHeight * pageScale;

  const gridDots: Array<{ left: number; top: number }> = [];
  if (snapToGrid && gridSize > 0) {
    for (let x = gridSize; x < pageWidth; x += gridSize) {
      for (let y = gridSize; y < pageHeight; y += gridSize) {
        gridDots.push({ left: x, top: y });
      }
    }
  }

  return (
    <View style={styles.canvasContainer}>
      <View
        style={[
          styles.pageWrapper,
          {
            width: scaledPageW,
            height: scaledPageH,
          },
        ]}
      >
        <View style={[styles.page, { width: pageWidth, height: pageHeight }]}>
          {snapToGrid &&
            gridDots.map((dot, i) => (
              <View
                key={i}
                style={[
                  styles.gridDot,
                  { left: dot.left - GRID_DOT_SIZE / 2, top: dot.top - GRID_DOT_SIZE / 2 },
                ]}
              />
            ))}

          {components
            .filter((c) => !c.isHidden)
            .map((comp) => {
              const isSelected = comp.id === selectedId;
              const anim = dragAnims.current.get(comp.id);
              const panResponder = createComponentPanResponder(comp);

              const resizeHandles: Array<{
                id: string;
                x: number;
                y: number;
                cx: number;
                cy: number;
              }> = [];
              if (isSelected && selectedComponent) {
                const { position, size } = comp;
                resizeHandles.push(
                  { id: 'tl', x: position.x, y: position.y, cx: 0, cy: 0 },
                  { id: 'tc', x: position.x + size.width / 2, y: position.y, cx: 0.5, cy: 0 },
                  { id: 'tr', x: position.x + size.width, y: position.y, cx: 1, cy: 0 },
                  { id: 'ml', x: position.x, y: position.y + size.height / 2, cx: 0, cy: 0.5 },
                  { id: 'mr', x: position.x + size.width, y: position.y + size.height / 2, cx: 1, cy: 0.5 },
                  { id: 'bl', x: position.x, y: position.y + size.height, cx: 0, cy: 1 },
                  { id: 'bc', x: position.x + size.width / 2, y: position.y + size.height, cx: 0.5, cy: 1 },
                  { id: 'br', x: position.x + size.width, y: position.y + size.height, cx: 1, cy: 1 }
                );
              }

              return (
                <View key={comp.id} style={styles.componentLayer}>
                  <Animated.View
                    style={[
                      styles.componentBox,
                      {
                        width: comp.size.width,
                        height: comp.size.height,
                        borderColor: isSelected ? '#3b82f6' : 'transparent',
                        borderWidth: isSelected ? 1.5 : 0,
                      },
                      anim
                        ? {
                            transform: [
                              { translateX: anim.x },
                              { translateY: anim.y },
                            ],
                          }
                        : {
                            left: comp.position.x,
                            top: comp.position.y,
                          },
                    ]}
                    {...panResponder.panHandlers}
                  >
                    {renderComponentContent(comp)}
                  </Animated.View>

                  {resizeHandles.map((handle) => (
                    <ResizeHandle
                      key={handle.id}
                      position={{ x: handle.x, y: handle.y, cx: handle.cx, cy: handle.cy }}
                      onResizeStart={handleResizeStart}
                      onResizeMove={(dx, dy) => {
                        if (!resizeStartRef.current) return;
                        const start = resizeStartRef.current;
                        let newW = start.w;
                        let newH = start.h;
                        let newX = start.x;
                        let newY = start.y;

                        if (handle.cx === 0) {
                          newX = start.x + dx;
                          newW = start.w - dx;
                        } else if (handle.cx === 1) {
                          newW = start.w + dx;
                        }

                        if (handle.cy === 0) {
                          newY = start.y + dy;
                          newH = start.h - dy;
                        } else if (handle.cy === 1) {
                          newH = start.h + dy;
                        }

                        if (newW < 10) newW = 10;
                        if (newH < 10) newH = 10;

                        onResize(comp.id, newW, newH);
                      }}
                      onResizeEnd={handleResizeEnd}
                    />
                  ))}

                  {isSelected && (
                    <View
                      style={[
                        styles.selectionLabel,
                        {
                          top: -22,
                          left: 0,
                        },
                      ]}
                    >
                      <Text style={styles.selectionLabelText}>{comp.label}</Text>
                    </View>
                  )}
                </View>
              );
            })}

          {guides.map((guide, i) => (
            <View
              key={`guide-${i}`}
              style={[
                styles.guideLine,
                guide.axis === 'x'
                  ? {
                      left: 0,
                      right: 0,
                      top: guide.value,
                      height: 1,
                    }
                  : {
                      top: 0,
                      bottom: 0,
                      left: guide.value,
                      width: 1,
                    },
              ]}
              pointerEvents="none"
            />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  canvasContainer: {
    flex: 1,
    backgroundColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pageWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  page: {
    backgroundColor: '#ffffff',
    position: 'relative',
    overflow: 'hidden',
  },
  gridDot: {
    position: 'absolute',
    width: GRID_DOT_SIZE,
    height: GRID_DOT_SIZE,
    borderRadius: GRID_DOT_SIZE / 2,
    backgroundColor: '#cbd5e1',
  },
  componentLayer: {
    position: 'absolute',
  },
  componentBox: {
    borderRadius: 2,
    overflow: 'hidden',
  },
  componentText: {
    fontSize: 12,
    color: '#334155',
    padding: 4,
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: '#fce7f3',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#f9a8d4',
    borderStyle: 'dashed',
  },
  imagePlaceholderIcon: {
    fontSize: 24,
  },
  imagePlaceholderLabel: {
    fontSize: 10,
    color: '#be185d',
    marginTop: 4,
  },
  dividerLine: {
    flex: 1,
    borderTopWidth: 2,
    borderTopColor: '#94a3b8',
    borderStyle: 'dashed',
    marginVertical: 4,
    alignSelf: 'stretch',
  },
  tablePlaceholder: {
    flex: 1,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  tablePlaceholderIcon: {
    fontSize: 22,
    color: '#b45309',
  },
  tablePlaceholderLabel: {
    fontSize: 9,
    color: '#92400e',
    marginTop: 2,
  },
  signaturePlaceholder: {
    flex: 1,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#c4b5fd',
    borderStyle: 'dashed',
  },
  signatureIcon: {
    fontSize: 22,
  },
  signatureLabel: {
    fontSize: 9,
    color: '#6d28d9',
    marginTop: 2,
  },
  chartPlaceholder: {
    flex: 1,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#6ee7b7',
  },
  chartIcon: {
    fontSize: 22,
  },
  chartLabel: {
    fontSize: 9,
    color: '#065f46',
    marginTop: 2,
  },
  qrPlaceholder: {
    flex: 1,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#a5b4fc',
  },
  qrGrid: {
    flexDirection: 'column',
  },
  qrRow: {
    flexDirection: 'row',
  },
  qrCell: {
    width: 8,
    height: 8,
    borderWidth: 0.5,
    borderColor: '#6366f1',
  },
  qrCellFilled: {
    backgroundColor: '#4f46e5',
  },
  qrLabel: {
    fontSize: 8,
    color: '#3730a3',
    marginTop: 2,
  },
  defaultComponent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  defaultLabel: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  resizeHandle: {
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    borderRadius: 2,
    zIndex: 10,
  },
  selectionLabel: {
    position: 'absolute',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  selectionLabelText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '600',
  },
  guideLine: {
    position: 'absolute',
    backgroundColor: '#ef4444',
    zIndex: 100,
  },
});
