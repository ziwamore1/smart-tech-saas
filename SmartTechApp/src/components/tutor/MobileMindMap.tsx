import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Circle, Rect, Text as SvgText, Line, G } from 'react-native-svg';
import { colors, spacing, borderRadius } from '../../theme';

interface MindMapNode {
  label: string;
  children?: string[];
}

interface MindMapParams {
  title?: string;
  center: string;
  nodes: MindMapNode[];
}

export function MobileMindMap({ params }: { params: MindMapParams }) {
  const { title, center, nodes } = params;
  const [activeNode, setActiveNode] = useState<number | null>(null);
  const w = 260;
  const h = 200;

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.svgWrapper}>
        <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <G>
            <Circle cx={w / 2} cy={28} r="16" fill="#f97316" />
            <SvgText x={w / 2} y={32} textAnchor="middle" fontSize="8" fill="#fff" fontWeight="700">
              {center}
            </SvgText>
          </G>
          {nodes.map((node, i) => {
            const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
            const endX = w / 2 + 50 * Math.cos(angle);
            const endY = 28 + 50 * Math.sin(angle);
            const isActive = activeNode === i;
            return (
              <G key={i}>
                <Line x1={w / 2} y1={44} x2={endX} y2={endY} stroke="#d97706" strokeWidth="1.5" />
                <Rect
                  x={endX - 22}
                  y={endY - 7}
                  width="44"
                  height="14"
                  rx="4"
                  fill={isActive ? '#fff7ed' : '#fefce8'}
                  stroke={isActive ? '#ea580c' : '#d97706'}
                  strokeWidth="1.5"
                  onPress={() => setActiveNode(isActive ? null : i)}
                />
                <SvgText
                  x={endX}
                  y={endY + 3}
                  textAnchor="middle"
                  fontSize="7"
                  fill="#9a3412"
                  fontWeight="600"
                  onPress={() => setActiveNode(isActive ? null : i)}
                >
                  {node.label}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>
      {activeNode !== null && nodes[activeNode]?.children && (
        <TouchableOpacity
          style={styles.detailBox}
          onPress={() => setActiveNode(null)}
          activeOpacity={0.8}
        >
          <Text style={styles.detailTitle}>{nodes[activeNode].label}</Text>
          {nodes[activeNode].children!.map((child, ci) => (
            <Text key={ci} style={styles.detailItem}>• {child}</Text>
          ))}
          <Text style={styles.detailHint}>Tap to close</Text>
        </TouchableOpacity>
      )}
      {activeNode === null && (
        <Text style={styles.hint}>Tap a branch to explore</Text>
      )}
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
  svgWrapper: {
    alignItems: 'center',
  },
  detailBox: {
    backgroundColor: '#fff7ed',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#fdba74',
    padding: spacing.sm,
    marginTop: spacing.xs,
    width: '100%',
  },
  detailTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#c2410c',
    marginBottom: 4,
  },
  detailItem: {
    fontSize: 11,
    color: '#9a3412',
    lineHeight: 17,
    paddingLeft: 4,
  },
  detailHint: {
    fontSize: 9,
    color: '#fdba74',
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
  hint: {
    fontSize: 9,
    color: '#a8a29e',
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
});
