import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';

interface ToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomToFit: () => void;
  zoom: number;
  onAlign: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onDistribute: (direction: 'horizontal' | 'vertical') => void;
  onToggleGrid: () => void;
  snapToGrid: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  hasSelection: boolean;
  hasMultipleSelection: boolean;
  hasClipboard: boolean;
}

type IconButtonProps = {
  icon: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  label?: string;
};

const IconButton: React.FC<IconButtonProps> = ({ icon, onPress, disabled, active, label }) => (
  <TouchableOpacity
    style={[
      styles.iconButton,
      active && styles.iconButtonActive,
      disabled && styles.iconButtonDisabled,
    ]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.6}
  >
    <Text style={[styles.iconText, active && styles.iconTextActive, disabled && styles.iconTextDisabled]}>
      {icon}
    </Text>
    {label && <Text style={[styles.iconLabel, disabled && styles.iconLabelDisabled]}>{label}</Text>}
  </TouchableOpacity>
);

const Divider: React.FC = () => <View style={styles.divider} />;

export const Toolbar: React.FC<ToolbarProps> = ({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onZoomIn,
  onZoomOut,
  onZoomToFit,
  zoom,
  onAlign,
  onDistribute,
  onToggleGrid,
  snapToGrid,
  onCopy,
  onPaste,
  onDelete,
  hasSelection,
  hasMultipleSelection,
  hasClipboard,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <IconButton icon="↩" onPress={onUndo} disabled={!canUndo} label="Undo" />
        <IconButton icon="↪" onPress={onRedo} disabled={!canRedo} label="Redo" />

        <Divider />

        <IconButton icon="🔍-" onPress={onZoomOut} label="-" />
        <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
        <IconButton icon="🔍+" onPress={onZoomIn} label="+" />
        <IconButton icon="⊞" onPress={onZoomToFit} label="Fit" />

        <Divider />

        <IconButton icon="⬅" onPress={() => onAlign('left')} disabled={!hasSelection} label="L" />
        <IconButton icon="⇔" onPress={() => onAlign('center')} disabled={!hasSelection} label="C" />
        <IconButton icon="➡" onPress={() => onAlign('right')} disabled={!hasSelection} label="R" />
        <IconButton icon="⬆" onPress={() => onAlign('top')} disabled={!hasSelection} label="T" />
        <IconButton icon="⇕" onPress={() => onAlign('middle')} disabled={!hasSelection} label="M" />
        <IconButton icon="⬇" onPress={() => onAlign('bottom')} disabled={!hasSelection} label="B" />

        <Divider />

        <IconButton icon="↔" onPress={() => onDistribute('horizontal')} disabled={!hasMultipleSelection} label="H" />
        <IconButton icon="↕" onPress={() => onDistribute('vertical')} disabled={!hasMultipleSelection} label="V" />

        <Divider />

        <IconButton icon="◫" onPress={onToggleGrid} active={snapToGrid} label="Grid" />

        <Divider />

        <IconButton icon="⧉" onPress={onCopy} disabled={!hasSelection} label="Copy" />
        <IconButton icon="📌" onPress={onPaste} disabled={!hasClipboard} label="Paste" />

        <Divider />

        <IconButton icon="✕" onPress={onDelete} disabled={!hasSelection} label="Del" />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  iconButtonActive: {
    backgroundColor: '#334155',
  },
  iconButtonDisabled: {
    opacity: 0.35,
  },
  iconText: {
    fontSize: 16,
    color: '#e2e8f0',
  },
  iconTextActive: {
    color: '#60a5fa',
  },
  iconTextDisabled: {
    color: '#64748b',
  },
  iconLabel: {
    fontSize: 8,
    color: '#94a3b8',
    marginTop: 1,
  },
  iconLabelDisabled: {
    color: '#475569',
  },
  zoomText: {
    fontSize: 12,
    color: '#e2e8f0',
    fontWeight: '600',
    marginHorizontal: 4,
    minWidth: 40,
    textAlign: 'center',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: '#475569',
    marginHorizontal: 6,
  },
});
