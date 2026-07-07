import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme';

interface Figure {
  name: string;
  role?: string;
  description?: string;
  image_hint?: string;
}

interface PortraitParams {
  title?: string;
  figures: Figure[];
}

export function MobilePortraitCard({ params }: { params: PortraitParams }) {
  const { title, figures } = params;
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.grid}>
        {figures.map((fig, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.card, expanded === i && styles.cardExpanded]}
            onPress={() => setExpanded(expanded === i ? null : i)}
            activeOpacity={0.7}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{fig.name.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.name}>{fig.name}</Text>
            {fig.role && <Text style={styles.role}>{fig.role}</Text>}
            {expanded === i && fig.description && (
              <View style={styles.descBox}>
                <Text style={styles.descText}>{fig.description}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.hint}>Tap a figure to learn more</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    width: '100%',
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.orange,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  card: {
    width: '47%',
    backgroundColor: '#fafaf9',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    padding: spacing.sm,
    alignItems: 'center',
  },
  cardExpanded: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
    borderWidth: 1.5,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#d97706',
  },
  name: {
    fontSize: 12,
    fontWeight: '700',
    color: '#44403c',
    textAlign: 'center',
  },
  role: {
    fontSize: 10,
    color: '#a8a29e',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 2,
  },
  descBox: {
    borderTopWidth: 1,
    borderTopColor: '#fde68a',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
  },
  descText: {
    fontSize: 11,
    color: '#78716c',
    lineHeight: 16,
    textAlign: 'left',
  },
  hint: {
    fontSize: 9,
    color: '#a8a29e',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
