import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme';

interface ComparisonParams {
  title?: string;
  headers: string[];
  rows: string[][];
}

export function MobileComparisonTable({ params }: { params: ComparisonParams }) {
  const { title, headers, rows } = params;
  if (!headers || headers.length === 0) return null;

  return (
    <View style={styles.container}>
      {title && <View style={styles.titleBar}><Text style={styles.title}>{title}</Text></View>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.headerRow}>
            {headers.map((h, i) => (
              <Text key={i} style={[styles.headerCell, i === 0 && styles.firstCell]}>
                {h}
              </Text>
            ))}
          </View>
          {rows.map((row, ri) => (
            <View key={ri} style={[styles.dataRow, ri % 2 === 0 ? styles.rowEven : styles.rowOdd]}>
              {row.map((cell, ci) => (
                <Text key={ci} style={[styles.dataCell, ci === 0 && styles.firstCell, ci === 0 && styles.labelCell]}>
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  titleBar: {
    padding: spacing.sm,
    backgroundColor: '#fffbeb',
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#fafaf9',
    borderBottomWidth: 1,
    borderBottomColor: '#e7e5e4',
  },
  headerCell: {
    minWidth: 90,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 11,
    fontWeight: '700',
    color: '#44403c',
  },
  firstCell: {
    minWidth: 100,
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e7e5e4',
  },
  rowEven: {
    backgroundColor: colors.white,
  },
  rowOdd: {
    backgroundColor: '#fafaf9',
  },
  dataCell: {
    minWidth: 90,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 11,
    color: '#57534e',
  },
  labelCell: {
    fontWeight: '600',
    color: '#44403c',
  },
});
