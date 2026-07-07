import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Text as SvgText, Line, Polygon } from 'react-native-svg';
import { colors, spacing, borderRadius } from '../../theme';

interface FlowNode {
  id: string;
  label: string;
  description?: string;
}

interface FlowConnection {
  from: string;
  to: string;
}

interface FlowChartParams {
  title?: string;
  nodes: FlowNode[];
  connections?: FlowConnection[];
}

export function MobileFlowChart({ params }: { params: FlowChartParams }) {
  const { title, nodes, connections = [] } = params;
  const w = 260;
  const h = Math.max(160, Math.ceil(nodes.length / 3) * 70);
  const cols = Math.min(nodes.length, 3);
  const cellW = 70;
  const cellH = 36;

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.svgWrapper}>
        <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          {connections.map((conn, i) => {
            const fromNode = nodes.findIndex(n => n.id === conn.from);
            const toNode = nodes.findIndex(n => n.id === conn.to);
            if (fromNode < 0 || toNode < 0) return null;
            const fCol = fromNode % cols;
            const fRow = Math.floor(fromNode / cols);
            const tCol = toNode % cols;
            const tRow = Math.floor(toNode / cols);
            const x1 = 20 + fCol * cellW + cellW;
            const y1 = 25 + fRow * 70 + cellH / 2;
            const x2 = 20 + tCol * cellW;
            const y2 = 25 + tRow * 70 + cellH / 2;
            return (
              <React.Fragment key={i}>
                <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d97706" strokeWidth="1.5" strokeDasharray="4,2" />
                <Polygon points={`${x2 - 3},${y2 - 5} ${x2 + 5},${y2} ${x2 - 3},${y2 + 5}`} fill="#d97706" />
              </React.Fragment>
            );
          })}
          {nodes.map((node, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = 20 + col * cellW;
            const y = 25 + row * 70;
            return (
              <React.Fragment key={node.id}>
                <Rect x={x} y={y} width={cellW - 10} height={cellH} rx="6" fill="#fff7ed" stroke="#f97316" strokeWidth="1.5" />
                <SvgText x={x + (cellW - 10) / 2} y={y + cellH / 2 + 2} textAnchor="middle" fontSize="9" fill="#9a3412" fontWeight="600">
                  {node.label}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </View>
      {nodes.length > 0 && (
        <View style={styles.legend}>
          {nodes.map(node => (
            <View key={node.id} style={styles.legendItem}>
              <View style={styles.legendDot} />
              <Text style={styles.legendLabel}>{node.id}. {node.label}</Text>
              {node.description && (
                <Text style={styles.legendDesc}>— {node.description}</Text>
              )}
            </View>
          ))}
        </View>
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
    width: '100%',
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.orange,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  svgWrapper: {
    alignItems: 'center',
  },
  legend: {
    marginTop: spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  legendLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#57534e',
  },
  legendDesc: {
    fontSize: 9,
    color: '#a8a29e',
  },
});
