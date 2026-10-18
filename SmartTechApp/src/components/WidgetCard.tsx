import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../theme';

interface WidgetCardProps {
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
  children: React.ReactNode;
}

export const WidgetCard: React.FC<WidgetCardProps> = ({
  title,
  subtitle,
  action,
  style,
  children,
}) => {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={styles.titleBlock}><Text style={styles.title}>{title}</Text>{subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}</View>
        {action && (
          <TouchableOpacity onPress={action.onPress}>
            <Text style={styles.action}>{action.label}</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h4,
  },
  titleBlock: { flex: 1 },
  subtitle: { fontSize: 11, color: colors.textLight, marginTop: 3 },
  action: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryLight,
  },
});
