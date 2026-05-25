import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../theme';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
  bgColor?: string;
  style?: ViewStyle;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  color,
  bgColor,
  style,
}) => {
  return (
    <View style={[styles.card, { backgroundColor: bgColor || colors.white }, style]}>
      <View style={[styles.iconCircle, { backgroundColor: (color || colors.primary) + '15' }]}>
        <Text style={[styles.icon, { color: color || colors.primary }]}>{icon}</Text>
      </View>
      <Text style={[styles.value, { color: color || colors.text }]}>{value}</Text>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    minWidth: 80,
    ...shadows.card,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  icon: {
    fontSize: 16,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textLight,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
