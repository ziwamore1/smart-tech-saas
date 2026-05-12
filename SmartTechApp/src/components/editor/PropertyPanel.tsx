import React from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { EditorComponent } from '../../types';

interface PropertyPanelProps {
  component: EditorComponent | null;
  onUpdate: (id: string, data: Partial<EditorComponent>) => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({ component, onUpdate }) => {
  if (!component) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Properties</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>◻</Text>
          <Text style={styles.emptyText}>Select a component</Text>
          <Text style={styles.emptySubtext}>Tap on a layer or canvas element to edit its properties</Text>
        </View>
      </View>
    );
  }

  const updateField = (field: string, value: any) => {
    onUpdate(component.id, { [field]: value } as Partial<EditorComponent>);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Properties</Text>
        <Text style={styles.headerType}>{component.type}</Text>
      </View>

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Label</Text>
            <TextInput
              style={styles.input}
              value={component.label}
              onChangeText={(v) => updateField('label', v)}
              placeholder="Component label"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.readonlyValue}>
              <Text style={styles.readonlyText}>{component.type}</Text>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Required</Text>
            <View style={styles.readonlyValue}>
              <Text style={styles.readonlyText}>{component.isRequired ? 'Yes' : 'No'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Position</Text>

          <View style={styles.row}>
            <View style={[styles.field, styles.halfField]}>
              <Text style={styles.label}>X</Text>
              <TextInput
                style={styles.input}
                value={String(component.position?.x ?? 0)}
                onChangeText={(v) => {
                  const num = parseFloat(v);
                  if (!isNaN(num)) {
                    onUpdate(component.id, {
                      position: { ...component.position, x: num },
                    } as Partial<EditorComponent>);
                  }
                }}
                keyboardType="numeric"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={[styles.field, styles.halfField]}>
              <Text style={styles.label}>Y</Text>
              <TextInput
                style={styles.input}
                value={String(component.position?.y ?? 0)}
                onChangeText={(v) => {
                  const num = parseFloat(v);
                  if (!isNaN(num)) {
                    onUpdate(component.id, {
                      position: { ...component.position, y: num },
                    } as Partial<EditorComponent>);
                  }
                }}
                keyboardType="numeric"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Size</Text>

          <View style={styles.row}>
            <View style={[styles.field, styles.halfField]}>
              <Text style={styles.label}>Width</Text>
              <TextInput
                style={styles.input}
                value={String(component.size?.width ?? 0)}
                onChangeText={(v) => {
                  const num = parseFloat(v);
                  if (!isNaN(num)) {
                    onUpdate(component.id, {
                      size: { ...component.size, width: num },
                    } as Partial<EditorComponent>);
                  }
                }}
                keyboardType="numeric"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={[styles.field, styles.halfField]}>
              <Text style={styles.label}>Height</Text>
              <TextInput
                style={styles.input}
                value={String(component.size?.height ?? 0)}
                onChangeText={(v) => {
                  const num = parseFloat(v);
                  if (!isNaN(num)) {
                    onUpdate(component.id, {
                      size: { ...component.size, height: num },
                    } as Partial<EditorComponent>);
                  }
                }}
                keyboardType="numeric"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Content</Text>
          <View style={styles.field}>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={
                component.content
                  ? typeof component.content === 'string'
                    ? component.content
                    : JSON.stringify(component.content, null, 2)
                  : ''
              }
              onChangeText={(v) => updateField('content', v)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholder="Component content"
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Styles</Text>
          <View style={styles.field}>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={
                component.styles
                  ? typeof component.styles === 'string'
                    ? component.styles
                    : JSON.stringify(component.styles, null, 2)
                  : '{}'
              }
              onChangeText={(v) => updateField('styles', v)}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              placeholder='{ "fontSize": 14 }'
              placeholderTextColor="#94a3b8"
            />
          </View>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerType: {
    fontSize: 10,
    color: '#94a3b8',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  scrollArea: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 40,
    color: '#cbd5e1',
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
  },
  section: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  field: {
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    fontSize: 13,
    color: '#1e293b',
    backgroundColor: '#fcfcfc',
  },
  multilineInput: {
    minHeight: 80,
    paddingTop: spacing.xs + 2,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  halfField: {
    flex: 1,
  },
  readonlyValue: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    backgroundColor: '#f8fafc',
  },
  readonlyText: {
    fontSize: 13,
    color: '#64748b',
  },
});
