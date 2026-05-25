import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Avatar } from '../../components';
import { Card } from '../../components';
import { Button } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';

type StudentPhotoScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

interface StudentWithPhoto {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  photoUrl: string | null;
  thumbnailUrl: string | null;
  hasPhoto: boolean;
  uploading?: boolean;
}

export const StudentPhotoScreen: React.FC<StudentPhotoScreenProps> = ({ navigation }) => {
  const [students, setStudents] = useState<StudentWithPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBulkUploading, setIsBulkUploading] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setIsLoading(true);
    try {
      const classData = await apiService.getTeacherClasses();
      const classStudents = classData?.students || [];
      const studentIds = classStudents.map((s: any) => s.id);

      let photoMap: Record<string, { imageUrl: string | null; thumbnailUrl: string | null }> = {};
      if (studentIds.length > 0) {
        try {
          photoMap = await apiService.getBatchStudentPhotos(studentIds);
        } catch {
          // photos not available for all
        }
      }

      setStudents(
        classStudents.map((s: any) => ({
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          admissionNumber: s.admissionNumber,
          photoUrl: photoMap[s.id]?.imageUrl || null,
          thumbnailUrl: photoMap[s.id]?.thumbnailUrl || null,
          hasPhoto: !!photoMap[s.id]?.imageUrl,
        }))
      );
    } catch (err: any) {
      Alert.alert('Error', 'Failed to load students');
    } finally {
      setIsLoading(false);
    }
  };

  const uploadSinglePhoto = async (studentId: string) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Gallery access is needed to upload photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setStudents(prev =>
      prev.map(s => (s.id === studentId ? { ...s, uploading: true } : s))
    );

    try {
      const formData = new FormData();
      const filename = result.assets[0].uri.split('/').pop() || 'photo.jpg';
      formData.append('photo', {
        uri: result.assets[0].uri,
        name: filename,
        type: 'image/jpeg',
      } as any);

      const res = await apiService.uploadStudentPhoto(studentId, formData);
      setStudents(prev =>
        prev.map(s =>
          s.id === studentId
            ? { ...s, photoUrl: res.imageUrl, thumbnailUrl: res.thumbnailUrl, hasPhoto: true, uploading: false }
            : s
        )
      );
    } catch (err: any) {
      setStudents(prev =>
        prev.map(s => (s.id === studentId ? { ...s, uploading: false } : s))
      );
      Alert.alert('Error', err.response?.data?.message || 'Failed to upload photo');
    }
  };

  const bulkUpload = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Gallery access is needed for bulk upload.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 50,
    });

    if (result.canceled || !result.assets.length) return;

    setIsBulkUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < result.assets.length && i < students.length; i++) {
      const student = students[i];
      if (!student) continue;

      setStudents(prev =>
        prev.map(s => (s.id === student.id ? { ...s, uploading: true } : s))
      );

      try {
        const formData = new FormData();
        const filename = result.assets[i].uri.split('/').pop() || 'photo.jpg';
        formData.append('photos', {
          uri: result.assets[i].uri,
          name: filename,
          type: 'image/jpeg',
        } as any);

        await apiService.uploadStudentPhoto(student.id, formData);
        setStudents(prev =>
          prev.map(s =>
            s.id === student.id
              ? { ...s, hasPhoto: true, uploading: false }
              : s
          )
        );
        successCount++;
      } catch {
        setStudents(prev =>
          prev.map(s => (s.id === student.id ? { ...s, uploading: false } : s))
        );
        failCount++;
      }
    }

    setIsBulkUploading(false);
    await loadStudents();
    Alert.alert('Bulk Upload Complete', `${successCount} uploaded, ${failCount} failed`);
  };

  const deletePhoto = (studentId: string) => {
    Alert.alert('Remove Photo', 'Remove this student photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.deleteStudentPhoto(studentId);
            setStudents(prev =>
              prev.map(s =>
                s.id === studentId
                  ? { ...s, photoUrl: null, thumbnailUrl: null, hasPhoto: false }
                  : s
              )
            );
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to delete photo');
          }
        },
      },
    ]);
  };

  const renderStudent = ({ item }: { item: StudentWithPhoto }) => (
    <Card style={styles.studentCard}>
      <View style={styles.studentRow}>
        <TouchableOpacity onPress={() => uploadSinglePhoto(item.id)} disabled={item.uploading}>
          {item.uploading ? (
            <View style={[styles.studentAvatar, styles.uploadingAvatar]}>
              <ActivityIndicator color={colors.primary} size="small" />
            </View>
          ) : (
            <Avatar
              photoUrl={item.thumbnailUrl}
              firstName={item.firstName}
              lastName={item.lastName}
              size={52}
            />
          )}
        </TouchableOpacity>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>
            {item.firstName} {item.lastName}
          </Text>
          <Text style={styles.studentAdmission}>{item.admissionNumber}</Text>
        </View>
        <View style={styles.studentActions}>
          <TouchableOpacity
            style={[styles.actionButton, item.hasPhoto && styles.actionButtonDanger]}
            onPress={() => (item.hasPhoto ? deletePhoto(item.id) : uploadSinglePhoto(item.id))}
          >
            <Text style={[styles.actionButtonText, item.hasPhoto && styles.actionButtonTextDanger]}>
              {item.hasPhoto ? 'Remove' : 'Upload'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={colors.gradient.blue} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Text style={styles.headerTitle}>Student Photos</Text>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient
        colors={colors.gradient.blue}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Student Photos</Text>
        <Text style={styles.headerSubtitle}>
          {students.filter(s => s.hasPhoto).length} / {students.length} have photos
        </Text>
      </LinearGradient>

      <View style={styles.bulkBar}>
        <Button
          title="Bulk Upload Photos"
          onPress={bulkUpload}
          loading={isBulkUploading}
          disabled={isBulkUploading}
          size="small"
        />
        <TouchableOpacity onPress={loadStudents} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={students}
        keyExtractor={item => item.id}
        renderItem={renderStudent}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No students found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
  },
  bulkBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  refreshButton: {
    padding: spacing.sm,
  },
  refreshText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryLight,
  },
  listContent: {
    padding: spacing.md,
  },
  studentCard: {
    marginBottom: spacing.sm,
    padding: spacing.sm,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingAvatar: {
    backgroundColor: colors.background,
  },
  studentInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  studentAdmission: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 2,
  },
  studentActions: {
    marginLeft: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary + '12',
  },
  actionButtonDanger: {
    backgroundColor: colors.error + '12',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryLight,
  },
  actionButtonTextDanger: {
    color: colors.error,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textLight,
  },
});
