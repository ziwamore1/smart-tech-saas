import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, shadows } from '../theme';

interface GradientCardProps {
  title?: string;
  subtitle?: string;
  icon?: string;
  onPress?: () => void;
  gradient?: readonly [string, string, ...string[]];
  style?: ViewStyle;
  children?: React.ReactNode;
}

export const GradientCard: React.FC<GradientCardProps> = ({
  title,
  subtitle,
  icon,
  onPress,
  gradient,
  style,
  children,
}) => {
  const content = (
    <LinearGradient
      colors={gradient || ['#EFF6FF', '#DBEAFE'] as const}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, style]}
    >
      {icon && <Text style={styles.icon}>{icon}</Text>}
      {title && <Text style={styles.title}>{title}</Text>}
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {children}
    </LinearGradient>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{content}</TouchableOpacity>;
  }

  return content;
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    ...shadows.card,
  },
  icon: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textLight,
    marginTop: 4,
    lineHeight: 18,
  },
});
