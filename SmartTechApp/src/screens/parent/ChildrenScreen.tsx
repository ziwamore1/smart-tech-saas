import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components';
import { colors, spacing } from '../../theme';
import { useAppStore } from '../../store';
import { resolveImageUrl } from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export const ParentChildrenScreen: React.FC = () => {
  const { dashboard } = useAppStore();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const children = dashboard?.children || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Children</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {children.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={{ textAlign: 'center', color: colors.textLight }}>No children linked</Text>
          </Card>
        ) : (
          children.map((child: any) => (
            <TouchableOpacity key={child.id} onPress={() => navigation.navigate('PResults', { childId: child.id, childName: child.name })}>
              <Card variant="outlined" style={styles.childCard}>
                {child.photoUrl ? (
                  <Image source={{ uri: resolveImageUrl(child.photoUrl) || child.photoUrl }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatar}><Text style={styles.avatarText}>{child.name?.[0]}</Text></View>
                )}
                <View style={styles.info}>
                  <Text style={styles.name}>{child.name}</Text>
                  <Text style={styles.detail}>{child.class}</Text>
                  <Text style={styles.detail}>{child.admissionNumber}</Text>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  scrollContent: { padding: spacing.md, gap: spacing.sm },
  emptyCard: { padding: spacing.xl },
  childCard: { padding: spacing.md, flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { color: colors.white, fontWeight: '700', fontSize: 20 },
  info: { marginLeft: spacing.md, flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  detail: { fontSize: 13, color: colors.textLight, marginTop: 2 },
});
