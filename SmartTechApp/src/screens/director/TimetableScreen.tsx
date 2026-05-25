import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface DirectorTimetableProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
}

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const periods = [
  { num: 1, time: '8:00 - 8:40' },
  { num: 2, time: '8:40 - 9:20' },
  { num: 3, time: '9:20 - 10:00' },
  { num: 4, time: '10:20 - 11:00' },
  { num: 5, time: '11:00 - 11:40' },
  { num: 6, time: '11:40 - 12:20' },
  { num: 7, time: '1:00 - 1:40' },
  { num: 8, time: '1:40 - 2:20' },
];

const mockTimetable: Record<string, Record<number, { subject: string; teacher: string }>> = {
  Monday: { 1: { subject: 'Mathematics', teacher: 'J. Smith' }, 2: { subject: 'English', teacher: 'M. Brown' }, 3: { subject: 'Science', teacher: 'S. Johnson' }, 5: { subject: 'History', teacher: 'E. Davis' }, 7: { subject: 'PE', teacher: 'D. Wilson' } },
  Tuesday: { 1: { subject: 'English', teacher: 'M. Brown' }, 2: { subject: 'Mathematics', teacher: 'J. Smith' }, 4: { subject: 'Geography', teacher: 'L. Anderson' }, 6: { subject: 'Art', teacher: 'L. Anderson' }, 8: { subject: 'Biology', teacher: 'S. Johnson' } },
  Wednesday: { 1: { subject: 'Science', teacher: 'S. Johnson' }, 2: { subject: 'History', teacher: 'E. Davis' }, 3: { subject: 'Mathematics', teacher: 'J. Smith' }, 5: { subject: 'English', teacher: 'M. Brown' }, 7: { subject: 'Chemistry', teacher: 'S. Johnson' } },
  Thursday: { 1: { subject: 'Mathematics', teacher: 'J. Smith' }, 2: { subject: 'PE', teacher: 'D. Wilson' }, 4: { subject: 'English', teacher: 'M. Brown' }, 6: { subject: 'Science', teacher: 'S. Johnson' }, 8: { subject: 'Geography', teacher: 'L. Anderson' } },
  Friday: { 1: { subject: 'History', teacher: 'E. Davis' }, 2: { subject: 'Mathematics', teacher: 'J. Smith' }, 3: { subject: 'Art', teacher: 'L. Anderson' }, 5: { subject: 'Biology', teacher: 'S. Johnson' }, 7: { subject: 'English', teacher: 'M. Brown' } },
};

export const DirectorTimetableScreen: React.FC<DirectorTimetableProps> = ({ onToggleDrawer, onNavigate }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [selectedDay, setSelectedDay] = useState('Monday');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Timetable"
        subtitle="School Schedule Overview"
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabs} contentContainerStyle={styles.dayTabsContent}>
        {days.map(day => (
          <TouchableOpacity key={day} style={[styles.dayTab, selectedDay === day && styles.dayTabActive]} onPress={() => setSelectedDay(day)}>
            <Text style={[styles.dayTabText, selectedDay === day && styles.dayTabTextActive]}>{day.slice(0, 3)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scroll}>
        <WidgetCard title={`${selectedDay} Schedule`}>
          {periods.map(period => {
            const slot = mockTimetable[selectedDay]?.[period.num];
            return (
              <View key={period.num} style={[styles.periodRow, !slot && styles.periodEmpty]}>
                <View style={styles.periodNum}>
                  <Text style={styles.periodNumText}>{period.num}</Text>
                  <Text style={styles.periodTime}>{period.time}</Text>
                </View>
                {slot ? (
                  <View style={styles.periodInfo}>
                    <Text style={styles.periodSubject}>{slot.subject}</Text>
                    <Text style={styles.periodTeacher}>{slot.teacher}</Text>
                  </View>
                ) : (
                  <Text style={styles.periodFree}>Free Period</Text>
                )}
              </View>
            );
          })}
        </WidgetCard>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  dayTabs: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  dayTabsContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  dayTab: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.lg, backgroundColor: colors.background },
  dayTabActive: { backgroundColor: colors.primary },
  dayTabText: { fontSize: 13, fontWeight: '600', color: colors.textLight },
  dayTabTextActive: { color: colors.white },
  scroll: { padding: spacing.md },
  periodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  periodEmpty: { opacity: 0.5 },
  periodNum: { width: 60, alignItems: 'center' },
  periodNumText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  periodTime: { fontSize: 10, color: colors.textLight },
  periodInfo: { flex: 1, marginLeft: spacing.md },
  periodSubject: { fontSize: 15, fontWeight: '600', color: colors.text },
  periodTeacher: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  periodFree: { flex: 1, marginLeft: spacing.md, fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
});
