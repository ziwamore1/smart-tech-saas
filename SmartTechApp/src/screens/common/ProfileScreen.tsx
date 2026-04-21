import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Card, Loading } from '../../components';
import { colors, spacing } from '../../theme';
import { useAuthStore } from '../../store';
import { apiService } from '../../services/api';

type ProfileScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { user, logout } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await logout();
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Card variant="elevated" style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </Text>
            </View>
          </View>
          
          <Text style={styles.name}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.email}>{user?.email}</Text>
          
          <View style={styles.rolesContainer}>
            {user?.roles?.map((role, index) => (
              <View key={index} style={styles.roleBadge}>
                <Text style={styles.roleText}>{role}</Text>
              </View>
            ))}
          </View>
        </Card>

        {user?.school && (
          <Card style={styles.schoolCard}>
            <Text style={styles.sectionTitle}>School Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>School Name</Text>
              <Text style={styles.infoValue}>{user.school.name}</Text>
            </View>
          </Card>
        )}

        <Card style={styles.schoolCard}>
          <Text style={styles.sectionTitle}>App Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
        </Card>

        <Button
          title="Logout"
          onPress={handleLogout}
          variant="danger"
          loading={isLoading}
          style={styles.logoutButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  avatarContainer: {
    marginBottom: spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.white,
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: 16,
    color: colors.textLight,
    marginBottom: spacing.md,
  },
  rolesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  roleBadge: {
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  roleText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '500',
  },
  schoolCard: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textLight,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  logoutButton: {
    marginTop: spacing.xl,
  },
});
