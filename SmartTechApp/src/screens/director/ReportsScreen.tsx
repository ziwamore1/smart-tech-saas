import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { HeaderBar, WidgetCard, GradientCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface DirectorReportsProps {
  onToggleDrawer?: () => void;
}

export const DirectorReportsScreen: React.FC<DirectorReportsProps> = ({ onToggleDrawer }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const handleShareReport = async (reportName: string) => {
    try {
      const reportContent = generateReportContent(reportName);
      const fileUri = FileSystem.documentDirectory + `${reportName.replace(/\s+/g, '_')}.txt`;
      await FileSystem.writeAsStringAsync(fileUri, reportContent);
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/plain',
        dialogTitle: `Share ${reportName}`,
        UTI: 'public.plain-text',
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to share report');
    }
  };

  const generateReportContent = (reportName: string): string => {
    const date = new Date().toLocaleDateString();
    const header = `SmartTech School - ${reportName}\nGenerated: ${date}\n${'='.repeat(40)}\n\n`;
    
    const metrics = `Key Metrics:\n- Pass Rate: 87%\n- Attendance: 92%\n- Average GPA: 4.2\n\n`;
    
    const subjects = `Subject Performance:\n- Mathematics: 72%\n- English: 78%\n- Science: 81%\n- Social Studies: 65%\n- Kiswahili: 70%\n`;
    
    return header + metrics + subjects;
  };

  const reportCategories = [
    {
      title: 'Academic Reports',
      icon: '📚',
      reports: [
        { name: 'Term Performance Summary', icon: '📊', description: 'Overall student performance by term' },
        { name: 'Subject Analysis', icon: '📈', description: 'Performance breakdown by subject' },
        { name: 'Grade Distribution', icon: '📋', description: 'Student grades across all classes' },
      ],
    },
    {
      title: 'Attendance Reports',
      icon: '✅',
      reports: [
        { name: 'Daily Attendance', icon: '📅', description: 'Daily attendance tracking' },
        { name: 'Monthly Summary', icon: '📆', description: 'Monthly attendance trends' },
        { name: 'Absenteeism Analysis', icon: '⚠️', description: 'Students with high absence rates' },
      ],
    },
    {
      title: 'Staff Reports',
      icon: '👨‍🏫',
      reports: [
        { name: 'Teacher Performance', icon: '📊', description: 'Teacher effectiveness metrics' },
        { name: 'Staff Attendance', icon: '📅', description: 'Staff attendance records' },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Reports"
        subtitle="School analytics & insights"
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <GradientCard
          title="Key Metrics"
          subtitle="Current term overview"
          icon="📊"
          gradient={['#EFF6FF', '#DBEAFE']}
          style={styles.metricsCard}
        >
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>87%</Text>
              <Text style={styles.metricLabel}>Pass Rate</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>92%</Text>
              <Text style={styles.metricLabel}>Attendance</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>4.2</Text>
              <Text style={styles.metricLabel}>Avg GPA</Text>
            </View>
          </View>
        </GradientCard>

        <WidgetCard title="Performance Overview">
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 160, paddingVertical: spacing.md }}>
            {[
              { label: 'Pass', value: 87, color: colors.success },
              { label: 'Attendance', value: 92, color: colors.primaryLight },
              { label: 'GPA (×20)', value: 84, color: colors.purple },
            ].map((bar) => (
              <View key={bar.label} style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: bar.color, marginBottom: 4 }}>{bar.value}%</Text>
                <View style={{ width: 40, height: bar.value * 1.4, backgroundColor: bar.color, borderRadius: 4, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }} />
                <Text style={{ fontSize: 10, color: colors.textLight, marginTop: 6 }}>{bar.label}</Text>
              </View>
            ))}
          </View>
        </WidgetCard>

        {reportCategories.map((category, idx) => (
          <WidgetCard key={idx} title={`${category.icon} ${category.title}`}>
            {category.reports.map((report, rIdx) => (
              <TouchableOpacity key={rIdx} style={styles.reportItem} onPress={() => handleShareReport(report.name)}>
                <View style={styles.reportIcon}>
                  <Text>{report.icon}</Text>
                </View>
                <View style={styles.reportInfo}>
                  <Text style={styles.reportName}>{report.name}</Text>
                  <Text style={styles.reportDesc}>{report.description}</Text>
                </View>
                <Text style={styles.shareIcon}>📤</Text>
              </TouchableOpacity>
            ))}
          </WidgetCard>
        ))}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  metricsCard: { marginBottom: spacing.lg },
  metricsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: spacing.md },
  metricItem: { alignItems: 'center' },
  metricValue: { fontSize: 24, fontWeight: '700', color: colors.primary },
  metricLabel: { fontSize: 12, color: colors.textLight, marginTop: 4 },
  metricDivider: { width: 1, height: 40, backgroundColor: colors.border },
  reportItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  reportIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  reportInfo: { flex: 1 },
  reportName: { fontSize: 15, fontWeight: '600', color: colors.text },
  reportDesc: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  shareIcon: { fontSize: 18 },
});
