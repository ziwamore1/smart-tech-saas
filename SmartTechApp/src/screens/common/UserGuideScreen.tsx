import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '../../theme';

interface UserGuideScreenProps {
  navigation?: { goBack?: () => void };
}

const SECTIONS = [
  {
    title: 'Getting Started',
    items: [
      { icon: '🔑', text: 'Log in with your school credentials' },
      { icon: '🏠', text: 'View your personalized dashboard on login' },
      { icon: '📱', text: 'Use the hamburger menu (☰) to navigate between sections' },
    ],
  },
  {
    title: 'Dashboard',
    items: [
      { icon: '📊', text: 'View quick stats: classes, students, attendance' },
      { icon: '⚡', text: 'Access quick actions for common tasks' },
      { icon: '📈', text: 'Monitor school performance metrics' },
    ],
  },
  {
    title: 'Communication',
    items: [
      { icon: '✉️', text: 'Send announcements to staff, parents, or students' },
      { icon: '💬', text: 'View message history and delivery status' },
      { icon: '🔍', text: 'Search messages by subject or content' },
    ],
  },
  {
    title: 'Students & Classes',
    items: [
      { icon: '👨‍🎓', text: 'Manage student records and profiles' },
      { icon: '🏫', text: 'Organize classes and assign teachers' },
      { icon: '📋', text: 'Track attendance and performance' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { icon: '👤', text: 'Update your profile and preferences' },
      { icon: '🔒', text: 'Manage security and notification settings' },
      { icon: '❓', text: 'Contact support for additional help' },
    ],
  },
];

export const UserGuideScreen: React.FC<UserGuideScreenProps> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack?.()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Guide</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.welcomeTitle}>Welcome to SmartTech</Text>
        <Text style={styles.welcomeText}>
          SmartTech is your all-in-one school management platform. This guide will help you get started with the key features.
        </Text>

        {SECTIONS.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.card}>
              {section.items.map((item, iIdx) => (
                <View key={iIdx} style={[styles.row, iIdx < section.items.length - 1 && styles.rowBorder]}>
                  <Text style={styles.rowIcon}>{item.icon}</Text>
                  <Text style={styles.rowText}>{item.text}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.footerSection}>
          <Text style={styles.footerTitle}>Need More Help?</Text>
          <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL('mailto:support@smarttechsaas.com')}>
            <Text style={styles.contactBtnText}>📧 Contact Support</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 60 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },
  scroll: { padding: spacing.md },
  welcomeTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  welcomeText: { fontSize: 14, color: colors.textLight, lineHeight: 20, marginBottom: spacing.lg },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  card: { backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.sm },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  rowIcon: { fontSize: 18, marginRight: spacing.md, width: 28, textAlign: 'center', marginTop: 1 },
  rowText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
  footerSection: { alignItems: 'center', marginTop: spacing.md, paddingVertical: spacing.lg, backgroundColor: colors.white, borderRadius: borderRadius.xl },
  footerTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  contactBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  contactBtnText: { fontSize: 15, fontWeight: '600', color: colors.white },
});
