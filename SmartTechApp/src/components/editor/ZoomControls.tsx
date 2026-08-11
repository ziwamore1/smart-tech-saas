import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomToFit: () => void;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomToFit,
}) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { bottom: 24 + insets.bottom }]}>
      <TouchableOpacity style={styles.button} onPress={onZoomOut} activeOpacity={0.6}>
        <Text style={styles.buttonText}>−</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.centerButton} onPress={onZoomToFit} activeOpacity={0.6}>
        <Text style={styles.percentText}>{Math.round(zoom * 100)}%</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={onZoomIn} activeOpacity={0.6}>
        <Text style={styles.buttonText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    ...shadows.lg,
    overflow: 'hidden',
  },
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 22,
  },
  centerButton: {
    minWidth: 60,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.white,
  },
  percentText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
});
