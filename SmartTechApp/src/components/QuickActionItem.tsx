import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, shadows } from '../theme';

interface QuickActionItemProps {
  icon: string;
  label: string;
  onPress: () => void;
  gradient?: readonly [string, string, ...string[]];
  style?: ViewStyle;
}

export const QuickActionItem: React.FC<QuickActionItemProps> = ({
  icon,
  label,
  onPress,
  gradient,
  style,
}) => {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.wrapper, style]}>
      <LinearGradient
        colors={gradient || ['#1E3A8A', '#3B82F6'] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconBox}
      >
        <Text style={styles.icon}>{icon}</Text>
      </LinearGradient>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    width: 72,
    marginRight: spacing.md,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  icon: {
    fontSize: 24,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 14,
  },
});
