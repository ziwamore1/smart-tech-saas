import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText, G } from 'react-native-svg';
import { colors, spacing, borderRadius } from '../../theme';

interface MapMarker {
  label: string;
  cx: number;
  cy: number;
  description?: string;
}

interface MapParams {
  title?: string;
  markers?: MapMarker[];
}

export function MobileMapView({ params }: { params: MapParams }) {
  const { title, markers = [] } = params;
  const [activeMarker, setActiveMarker] = useState<number | null>(null);
  const w = 240;
  const h = 180;

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.mapWrapper}>
        <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <Rect x="4" y="4" width={w - 8} height={h - 8} rx="6" fill="#fefce8" stroke="#d6d3d1" strokeWidth="1" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Line key={`h${i}`} x1="4" y1={4 + i * 43} x2={w - 4} y2={4 + i * 43} stroke="#e7e5e4" strokeWidth="0.5" />
          ))}
          {Array.from({ length: 4 }).map((_, i) => (
            <Line key={`v${i}`} x1={4 + i * 58} y1="4" x2={4 + i * 58} y2={h - 4} stroke="#e7e5e4" strokeWidth="0.5" />
          ))}
          {markers.map((m, i) => (
            <G key={i} onPress={() => setActiveMarker(activeMarker === i ? null : i)}>
              <Circle cx={m.cx} cy={m.cy} r={6} fill={activeMarker === i ? '#ea580c' : '#f97316'} stroke="#fff" strokeWidth="2" />
              <SvgText x={m.cx} y={m.cy - 10} textAnchor="middle" fontSize="8" fill="#78716c" fontWeight="500">
                {m.label}
              </SvgText>
            </G>
          ))}
        </Svg>
      </View>
      {activeMarker !== null && markers[activeMarker]?.description && (
        <View style={styles.descBox}>
          <Text style={styles.descText}>{markers[activeMarker].description}</Text>
        </View>
      )}
      <Text style={styles.hint}>Tap markers for details</Text>
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
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.orange,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    alignSelf: 'flex-start',
  },
  mapWrapper: {
    alignItems: 'center',
  },
  descBox: {
    backgroundColor: '#fffbeb',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: spacing.sm,
    marginTop: spacing.xs,
    width: '100%',
  },
  descText: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 17,
  },
  hint: {
    fontSize: 9,
    color: '#a8a29e',
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
});
