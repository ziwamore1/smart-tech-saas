import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
  Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';
import { useAuthStore } from '../../store';
import { HeaderBar } from '../../components';

interface Props {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: any;
}

export const RegisterStudentScreen: React.FC<Props> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const { user } = useAuthStore();
  const canOverride = user?.roles?.includes('Director') || user?.roles?.includes('SuperAdmin');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [classId, setClassId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [manualOverride, setManualOverride] = useState(false);
  const [admissionPreview, setAdmissionPreview] = useState('');

  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadFormData();
  }, []);

  useEffect(() => {
    if (academicYearId) fetchPreview();
  }, [academicYearId, classId]);

  const loadFormData = async () => {
    try {
      const [clsRes, yearsRes] = await Promise.allSettled([
        apiService.getClasses(),
        apiService.getAcademicYears(),
      ]);

      let classList: any[] = [];
      if (clsRes.status === 'fulfilled') {
        const d = clsRes.value?.data || clsRes.value;
        classList = Array.isArray(d) ? d : d?.classes || d?.result || [];
      }
      if (classList.length === 0 && clsRes.status === 'fulfilled') {
        const d = clsRes.value?.data || clsRes.value;
        if (d?.length) classList = d;
      }
      setClasses(classList);

      let yearList: any[] = [];
      if (yearsRes.status === 'fulfilled') {
        const d = yearsRes.value?.data || yearsRes.value;
        yearList = Array.isArray(d) ? d : [];
      }
      setAcademicYears(yearList);

      const current = yearList.find((y: any) => y.isCurrent);
      if (current) {
        setAcademicYearId(current.id);
      }

      // Auto-select class for Class Teachers
      if (user?.roles?.includes('Class Teacher') || user?.roles?.includes('Teacher')) {
        try {
          const assigned = await apiService.getMobileTeacherClasses();
          const assignedList = Array.isArray(assigned) ? assigned : assigned?.data || [];
          if (assignedList.length === 1 && assignedList[0].classId) {
            setClassId(assignedList[0].classId);
          }
        } catch {}
      }
    } catch (err) {
      console.error('Failed to load form data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreview = async () => {
    try {
      const res = await apiService.previewAdmission(academicYearId, classId || undefined);
      setAdmissionPreview(res?.admissionNumber || '');
    } catch {
      setAdmissionPreview('');
    }
  };

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setAdmissionNumber('');
    setDateOfBirth('');
    setGender('');
    setEmail('');
    setPhone('');
    setAddress('');
    setParentName('');
    setParentPhone('');
    setParentEmail('');
    setClassId('');
    setManualOverride(false);
    const current = academicYears.find((y: any) => y.isCurrent);
    setAcademicYearId(current?.id || '');
    setAdmissionPreview('');
  };

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setMessage({ type: 'error', text: 'First name and last name are required.' });
      setTimeout(() => setMessage(null), 4000);
      return;
    }
    if (manualOverride && !admissionNumber.trim()) {
      setMessage({ type: 'error', text: 'Admission number is required when manual override is enabled.' });
      setTimeout(() => setMessage(null), 4000);
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const payload: any = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender: gender || undefined,
        dateOfBirth: dateOfBirth || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        parentName: parentName.trim() || undefined,
        parentPhone: parentPhone.trim() || undefined,
        parentEmail: parentEmail.trim() || undefined,
        academicYearId: academicYearId || undefined,
        classId: classId || undefined,
        manualOverride: manualOverride || undefined,
        status: 'ACTIVE',
      };
      if (manualOverride && admissionNumber.trim()) {
        payload.admissionNumber = admissionNumber.trim();
      }

      await apiService.createStudent(payload);
      setMessage({ type: 'success', text: 'Student registered successfully!' });
      setTimeout(() => setMessage(null), 4000);
      resetForm();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Registration failed. Please try again.';
      setMessage({ type: 'error', text: msg });
      setTimeout(() => setMessage(null), 6000);
    } finally {
      setSubmitting(false);
    }
  };

  const genderOptions = ['', 'Male', 'Female'];

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <HeaderBar title="Register Student" leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Register Student"
        subtitle="Fill in student details"
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
      />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.formCard}>
          {message && (
            <View style={[styles.messageBanner, message.type === 'success' ? styles.successBanner : styles.errorBanner]}>
              <Text style={[styles.messageText, message.type === 'success' ? styles.successText : styles.errorText]}>
                {message.text}
              </Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Student Information</Text>

          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>First Name *</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Last Name *</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Admission Number</Text>
            <View style={styles.admissionRow}>
              <TextInput
                style={[styles.input, styles.flexInput, !manualOverride && styles.readOnlyInput]}
                value={manualOverride ? admissionNumber : admissionPreview}
                onChangeText={setAdmissionNumber}
                editable={manualOverride}
                placeholder={admissionPreview || 'Auto-generated'}
                placeholderTextColor={colors.textMuted}
              />
              {canOverride && (
                <TouchableOpacity
                  style={[styles.overrideBtn, manualOverride && styles.overrideBtnActive]}
                  onPress={() => { setManualOverride(!manualOverride); setAdmissionNumber(''); }}
                >
                  <Text style={[styles.overrideBtnText, manualOverride && styles.overrideBtnTextActive]}>
                    {manualOverride ? 'Auto' : 'Override'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {!manualOverride && admissionPreview ? (
              <Text style={styles.hintSuccess}>Auto-generated: {admissionPreview}</Text>
            ) : null}
            {manualOverride ? (
              <Text style={styles.hintWarning}>Manual override: enter a unique admission number</Text>
            ) : null}
          </View>

          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Date of Birth</Text>
              <TextInput
                style={styles.input}
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Gender</Text>
              <View style={styles.optionsRow}>
                {genderOptions.map((g) => (
                  <TouchableOpacity
                    key={g || 'none'}
                    style={[styles.optionChip, gender === g && styles.optionChipActive]}
                    onPress={() => setGender(g)}
                  >
                    <Text style={[styles.optionChipText, gender === g && styles.optionChipTextActive]}>
                      {g || 'Select'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={address}
              onChangeText={setAddress}
              placeholder="Address"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={2}
            />
          </View>

          <Text style={styles.sectionTitle}>Enrollment Details</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Academic Year</Text>
            <View style={styles.optionsRow}>
              {academicYears.map((y: any) => (
                <TouchableOpacity
                  key={y.id}
                  style={[styles.optionChip, academicYearId === y.id && styles.optionChipActive]}
                  onPress={() => setAcademicYearId(y.id)}
                >
                  <Text style={[styles.optionChipText, academicYearId === y.id && styles.optionChipTextActive]}>
                    {y.name}{y.isCurrent ? ' (Current)' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Class</Text>
            <View style={styles.optionsRow}>
              {classes.map((c: any) => (
                <TouchableOpacity
                  key={c.id || c._id}
                  style={[styles.optionChip, classId === (c.id || c._id) && styles.optionChipActive]}
                  onPress={() => setClassId(c.id || c._id)}
                >
                  <Text style={[styles.optionChipText, classId === (c.id || c._id) && styles.optionChipTextActive]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.optionChip, classId === '' && styles.optionChipActive]}
                onPress={() => setClassId('')}
              >
                <Text style={[styles.optionChipText, classId === '' && styles.optionChipTextActive]}>
                  None
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>
            Parent / Guardian Information{' '}
            <Text style={styles.optionalLabel}>(optional - can be added later)</Text>
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={parentName}
              onChangeText={setParentName}
              placeholder="Parent/guardian full name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={parentPhone}
                onChangeText={setParentPhone}
                placeholder="Phone number"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={parentEmail}
                onChangeText={setParentEmail}
                placeholder="Email address"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Register Student</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: spacing.md, paddingBottom: 40 },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md, marginTop: spacing.sm },
  optionalLabel: { fontSize: 12, fontWeight: '400', color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  messageBanner: { padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md },
  successBanner: { backgroundColor: '#d1fae5', borderWidth: 1, borderColor: '#a7f3d0' },
  errorBanner: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca' },
  messageText: { fontSize: 14, fontWeight: '500' },
  successText: { color: '#065f46' },
  errorText: { color: '#991b1b' },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  halfField: { flex: 1 },
  field: { marginBottom: spacing.sm },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
    color: colors.text,
  },
  flexInput: { flex: 1 },
  readOnlyInput: { backgroundColor: '#f9fafb', color: colors.textMuted },
  textArea: { minHeight: 60, textAlignVertical: 'top' },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  optionChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionChipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  optionChipTextActive: { color: colors.white },
  admissionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  overrideBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  overrideBtnActive: { backgroundColor: '#fef3c7', borderColor: '#f59e0b' },
  overrideBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  overrideBtnTextActive: { color: '#d97706' },
  hintSuccess: { fontSize: 12, color: '#065f46', marginTop: 4 },
  hintWarning: { fontSize: 12, color: '#d97706', marginTop: 4 },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
});
