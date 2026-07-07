import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme';

interface TimelineEvent {
  year: string;
  title: string;
  description?: string;
}

interface TimelineParams {
  title?: string;
  events: TimelineEvent[];
}

export function MobileTimeline({ params }: { params: TimelineParams }) {
  const { title, events } = params;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.timeline}>
        <View style={styles.line} />
        {events.map((event, i) => (
          <TouchableOpacity
            key={i}
            style={styles.eventRow}
            onPress={() => setSelectedIndex(selectedIndex === i ? null : i)}
            activeOpacity={0.7}
          >
            <View style={[styles.dot, selectedIndex === i && styles.dotActive]} />
            <View style={[styles.eventCard, selectedIndex === i && styles.eventCardActive]}>
              <View style={styles.eventHeader}>
                <Text style={styles.year}>{event.year}</Text>
                <Text style={styles.eventTitle}>{event.title}</Text>
              </View>
              {selectedIndex === i && event.description && (
                <Text style={styles.eventDesc}>{event.description}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.hint}>Tap events to learn more</Text>
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
  timeline: {
    position: 'relative',
    paddingLeft: 24,
  },
  line: {
    position: 'absolute',
    left: 11,
    top: 4,
    bottom: 4,
    width: 2,
    backgroundColor: '#fde68a',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: '#fbbf24',
    position: 'absolute',
    left: -19,
    top: 4,
  },
  dotActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#d97706',
  },
  eventCard: {
    flex: 1,
    backgroundColor: '#fafaf9',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    padding: spacing.sm,
  },
  eventCardActive: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  year: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d97706',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  eventDesc: {
    fontSize: 12,
    color: '#78716c',
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  hint: {
    fontSize: 9,
    color: '#a8a29e',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
