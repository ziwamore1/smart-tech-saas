import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Avatar } from '../../components';
import { Card } from '../../components';
import { Button } from '../../components';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { useAuthStore } from '../../store';
import { apiService, resolveImageUrl } from '../../services/api';
import { socketService } from '../../services/socket';

type ProfileScreenProps = {
  navigation: NativeStackNavigationProp<any>;
  onToggleDrawer?: () => void;
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation, onToggleDrawer }) => {
  const { user, logout, setUser, saUser, switchToSuperAdmin } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fetchLatestProfile = useCallback(async () => {
    try {
      const profile = await apiService.getProfile();
      if (profile && user) {
        setUser({
          ...user,
          firstName: profile.firstName || user.firstName,
          lastName: profile.lastName || user.lastName,
          email: profile.email || user.email,
          phone: profile.phone || user.phone,
          photoUrl: profile.photoUrl ? resolveImageUrl(profile.photoUrl) || profile.photoUrl : user.photoUrl,
        });
        setFirstName(profile.firstName || user.firstName || '');
        setLastName(profile.lastName || user.lastName || '');
        setEmail(profile.email || user.email || '');
        setPhone(profile.phone || user.phone || '');
      }
    } catch (err) {
      console.warn('Failed to fetch latest profile:', err);
    }
  }, [user, setUser]);

  useEffect(() => {
    const handleProfileUpdated = (data: { userId: string; updatedBy: string; changes: string[] }) => {
      if (data.userId === user?.id && data.updatedBy !== user?.id) {
        fetchLatestProfile();
      }
    };
    const handleUserUpdated = (data: { userId: string; updatedBy: string }) => {
      if (data.userId === user?.id && data.updatedBy !== user?.id) {
        fetchLatestProfile();
      }
    };

    socketService.on('profile:updated', handleProfileUpdated);
    socketService.on('user:updated', handleUserUpdated);

    return () => {
      socketService.off('profile:updated', handleProfileUpdated);
      socketService.off('user:updated', handleUserUpdated);
    };
  }, [user?.id, fetchLatestProfile]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Gallery access is needed to upload a photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      uploadPhoto(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Camera access is needed to take a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      uploadPhoto(result.assets[0].uri);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert('Profile Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Gallery', onPress: pickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const uploadPhoto = async (uri: string) => {
    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'photo.jpg';
      formData.append('photo', { uri, name: filename, type: 'image/jpeg' } as any);
      const result = await apiService.uploadProfilePhoto(formData);
      if (user) {
        setUser({ ...user, photoUrl: resolveImageUrl(result.photoUrl) || result.photoUrl });
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to upload photo');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const removePhoto = () => {
    Alert.alert('Remove Photo', 'Are you sure you want to remove your profile photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.deleteProfilePhoto();
            if (user) {
              setUser({ ...user, photoUrl: null });
            }
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to remove photo');
          }
        },
      },
    ]);
  };

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Validation Error', 'First name and last name are required');
      return;
    }
    setIsSaving(true);
    try {
      const updatedUser = await apiService.updateProfile({ firstName, lastName, email, phone });
      if (user) {
        setUser({ ...user, ...updatedUser });
      }
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      Alert.alert('Validation Error', 'Current password is required');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Validation Error', 'New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match');
      return;
    }
    setIsChangingPassword(true);
    try {
      await apiService.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password changed successfully');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={colors.gradient.blue}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          {onToggleDrawer && (
            <TouchableOpacity style={styles.hamburgerBtn} onPress={onToggleDrawer}>
              <Text style={styles.hamburgerBtnText}>☰</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={showPhotoOptions} disabled={isUploadingPhoto} style={styles.photoContainer}>
            {isUploadingPhoto ? (
              <View style={[styles.avatarPlaceholder, styles.avatarLoading]}>
                <ActivityIndicator color={colors.white} size="large" />
              </View>
            ) : (
              <Avatar
                photoUrl={user?.photoUrl}
                firstName={user?.firstName}
                lastName={user?.lastName}
                size={100}
              />
            )}
            <View style={styles.cameraBadge}>
              <Text style={styles.cameraIcon}>📷</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.headerName}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.headerEmail}>{user?.email}</Text>

          <View style={styles.rolesRow}>
            {user?.roles?.map((role, index) => (
              <View key={index} style={styles.roleBadge}>
                <Text style={styles.roleText}>{role}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Personal Information</Text>
              <TouchableOpacity onPress={() => isEditing ? handleSaveProfile() : setIsEditing(true)}>
                <Text style={[styles.editButton, isSaving && styles.disabledText]}>
                  {isSaving ? 'Saving...' : isEditing ? 'Save' : 'Edit'}
                </Text>
              </TouchableOpacity>
            </View>

            {isEditing ? (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>First Name</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="First Name"
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Last Name</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Last Name"
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Phone</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="Phone Number"
                    keyboardType="phone-pad"
                  />
                </View>
              </>
            ) : (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>First Name</Text>
                  <Text style={styles.infoValue}>{user?.firstName}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Last Name</Text>
                  <Text style={styles.infoValue}>{user?.lastName}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{user?.email}</Text>
                </View>
                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{user?.phone || 'N/A'}</Text>
                </View>
              </>
            )}
          </Card>

          {user?.school && (
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>School Information</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>School Name</Text>
                <Text style={styles.infoValue}>{user.school.name}</Text>
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.infoLabel}>School ID</Text>
                <Text style={styles.infoValue}>{user.school.id.slice(0, 8)}...</Text>
              </View>
            </Card>
          )}

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Change Password</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Current Password</Text>
              <TextInput
                style={styles.fieldInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                secureTextEntry
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>New Password</Text>
              <TextInput
                style={styles.fieldInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password (min 8 chars)"
                secureTextEntry
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Confirm New Password</Text>
              <TextInput
                style={styles.fieldInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                secureTextEntry
              />
            </View>
            <Button
              title="Update Password"
              onPress={handleChangePassword}
              loading={isChangingPassword}
              variant="outline"
              size="small"
              style={styles.passwordButton}
            />
          </Card>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Account Created</Text>
              <Text style={styles.infoValue}>
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              </Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoLabel}>Roles</Text>
              <Text style={styles.infoValue}>{user?.roles?.join(', ')}</Text>
            </View>
          </Card>

          {saUser && user?.schoolId && (
            <Card style={styles.switchCard}>
              <Text style={styles.sectionTitle}>SuperAdmin Session</Text>
              <Text style={styles.switchDescription}>You are viewing this school as a linked staff member.</Text>
              <Button
                title="Back to Super Admin"
                onPress={async () => {
                  try { await switchToSuperAdmin(); } catch (error: any) { Alert.alert('Unable to switch', error?.message || 'Please sign in again.'); }
                }}
                variant="outline"
                size="small"
              />
            </Card>
          )}

          <Button
            title="Logout"
            onPress={handleLogout}
            variant="danger"
            style={styles.logoutButton}
          />
        </View>
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
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  hamburgerBtn: { position: 'absolute', top: spacing.sm, left: spacing.sm, padding: spacing.sm, zIndex: 10 },
  hamburgerBtnText: { fontSize: 24, color: colors.white },
  photoContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLoading: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.white,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  cameraIcon: {
    fontSize: 16,
  },
  headerName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.xs,
  },
  headerEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: spacing.sm,
  },
  rolesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  roleText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    padding: spacing.md,
    marginTop: -spacing.lg,
  },
  section: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  editButton: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryLight,
  },
  disabledText: {
    color: colors.textMuted,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textLight,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    maxWidth: '60%',
    textAlign: 'right',
  },
  fieldGroup: {
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textLight,
    marginBottom: spacing.xs,
  },
  fieldInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
  },
  passwordButton: {
    marginTop: spacing.sm,
  },
  logoutButton: {
    marginBottom: spacing.xl,
  },
  switchCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  switchDescription: {
    color: '#1e40af',
    fontSize: 13,
    marginBottom: spacing.md,
  },
});
