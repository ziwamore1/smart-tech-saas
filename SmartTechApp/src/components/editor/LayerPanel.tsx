import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { EditorComponent } from '../../types';

interface LayerPanelProps {
  components: EditorComponent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onAddComponent: () => void;
}

const getTypeIcon = (type: string): string => {
  if (type.includes('TEXT') || type.includes('HEADING') || type.includes('PARAGRAPH')) return 'T';
  if (type.includes('IMAGE') || type.includes('LOGO') || type.includes('PHOTO')) return '🖼';
  if (type.includes('DIVIDER')) return '—';
  if (type.includes('TABLE')) return '⊞';
  if (type.includes('CHART')) return '📊';
  if (type.includes('SIGNATURE')) return '✍';
  if (type.includes('STAMP')) return '🔏';
  if (type.includes('SEAL')) return '🫱';
  if (type.includes('QR')) return '▣';
  return '?';
};

export const LayerPanel: React.FC<LayerPanelProps> = ({
  components,
  selectedId,
  onSelect,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
  onToggleLock,
  onAddComponent,
}) => {
  const sorted = [...components].reverse();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Layers</Text>
        <TouchableOpacity style={styles.addButton} onPress={onAddComponent} activeOpacity={0.7}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {sorted.length === 0 && (
          <Text style={styles.emptyText}>No components</Text>
        )}

        {sorted.map((comp, displayIndex) => {
          const realIndex = components.length - 1 - displayIndex;
          const isSelected = comp.id === selectedId;

          return (
            <TouchableOpacity
              key={comp.id}
              style={[styles.item, isSelected && styles.itemSelected]}
              onPress={() => onSelect(comp.id)}
              activeOpacity={0.7}
            >
              <View style={styles.dragHandle}>
                <Text style={styles.dragHandleText}>⋮⋮</Text>
              </View>

              <View style={[styles.typeIcon, isSelected && styles.typeIconSelected]}>
                <Text style={styles.typeIconText}>{getTypeIcon(comp.type)}</Text>
              </View>

              <View style={styles.itemInfo}>
                <Text style={[styles.itemLabel, isSelected && styles.itemLabelSelected]} numberOfLines={1}>
                  {comp.label}
                </Text>
                <Text style={styles.itemType} numberOfLines={1}>
                  {comp.type}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.toggle}
                onPress={() => onToggleVisibility(comp.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.toggleIcon, comp.isHidden && styles.toggleIconOff]}>
                  {comp.isHidden ? '◡' : '◠'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggle}
                onPress={() => onToggleLock(comp.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.toggleIcon, comp.isLocked && styles.toggleIconLocked]}>
                  {comp.isLocked ? '🔒' : '🔓'}
                </Text>
              </TouchableOpacity>

              <View style={styles.moveButtons}>
                <TouchableOpacity
                  onPress={() => onMoveUp(realIndex)}
                  disabled={realIndex >= components.length - 1}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Text style={[styles.moveArrow, realIndex >= components.length - 1 && styles.moveArrowDisabled]}>
                    ▲
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onMoveDown(realIndex)}
                  disabled={realIndex <= 0}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Text style={[styles.moveArrow, realIndex <= 0 && styles.moveArrowDisabled]}>
                    ▼
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    width: '100%',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
  },
  list: {
    flex: 1,
  },
  emptyText: {
    padding: spacing.lg,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 13,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    minHeight: 48,
  },
  itemSelected: {
    backgroundColor: '#e0f2fe',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  dragHandle: {
    paddingRight: spacing.xs,
    paddingLeft: 2,
  },
  dragHandleText: {
    fontSize: 12,
    color: '#94a3b8',
    letterSpacing: -2,
  },
  typeIcon: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  typeIconSelected: {
    backgroundColor: '#dbeafe',
  },
  typeIconText: {
    fontSize: 12,
    color: '#475569',
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.xs,
  },
  itemLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  itemLabelSelected: {
    color: '#1e40af',
  },
  itemType: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  toggle: {
    padding: spacing.xs,
    marginLeft: 2,
  },
  toggleIcon: {
    fontSize: 14,
  },
  toggleIconOff: {
    opacity: 0.3,
  },
  toggleIconLocked: {
    fontSize: 13,
  },
  moveButtons: {
    marginLeft: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveArrow: {
    fontSize: 10,
    color: '#64748b',
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  moveArrowDisabled: {
    color: '#cbd5e1',
  },
});
