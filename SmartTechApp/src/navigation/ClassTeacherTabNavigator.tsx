import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../store';
import { ClassTeacherDashboardScreen } from '../screens/class-teacher/DashboardScreen';
import { PrimaryClassTeacherScreen } from '../screens/class-teacher/PrimaryClassTeacherScreen';
import { ClassTeacherStudentsScreen } from '../screens/class-teacher/StudentsScreen';
import { ClassTeacherCommunicationScreen } from '../screens/class-teacher/CommunicationScreen';
import { ClassTeacherAnalyticsScreen } from '../screens/class-teacher/AnalyticsScreen';
import { ClassTeacherAttendanceScreen } from '../screens/class-teacher/AttendanceScreen';
import { StudentPhotoScreen } from '../screens/class-teacher/StudentPhotoScreen';
import { ProfileScreen } from '../screens/common/ProfileScreen';
import { AiTutorScreen } from '../screens/intelligence/AiTutorScreen';
import { colors, borderRadius, shadows } from '../theme';

const Tab = createBottomTabNavigator();

const TabIcon: React.FC<{ icon: string; focused: boolean }> = ({ icon, focused }) => (
  <View style={[styles.tabIconWrap, focused && styles.tabIconActive]}>
    <Text style={[styles.tabIcon, focused && styles.tabIconActiveText]}>{icon}</Text>
  </View>
);

export const ClassTeacherTabNavigator: React.FC = () => {
  const institutionType = useAuthStore((state) => state.user?.institutionType);
  const isPrimary = institutionType === 'PRIMARY_SCHOOL';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="CTDashboard"
        component={ClassTeacherDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} />,
        }}
      />
      {isPrimary && <Tab.Screen
        name="CTPrimary"
        component={PrimaryClassTeacherScreen}
        options={{
          tabBarLabel: 'Primary',
          tabBarIcon: ({ focused }) => <TabIcon icon="🌿" focused={focused} />,
        }}
      />}
      <Tab.Screen
        name="CTStudents"
        component={ClassTeacherStudentsScreen}
        options={{
          tabBarLabel: 'Students',
          tabBarIcon: ({ focused }) => <TabIcon icon="👥" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="CTCommunication"
        component={ClassTeacherCommunicationScreen}
        options={{
          tabBarLabel: 'Messages',
          tabBarIcon: ({ focused }) => <TabIcon icon="💬" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="CTAnalytics"
        component={ClassTeacherAnalyticsScreen}
        options={{
          tabBarLabel: 'Analytics',
          tabBarIcon: ({ focused }) => <TabIcon icon="📊" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="CTAiTutor"
        component={AiTutorScreen}
        options={{
          tabBarLabel: 'AI Tutor',
          tabBarIcon: ({ focused }) => <TabIcon icon="🤖" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="CTAttendance"
        component={ClassTeacherAttendanceScreen}
        options={{
          tabBarLabel: 'Attendance',
          tabBarIcon: ({ focused }) => <TabIcon icon="📋" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="CTPhotos"
        component={StudentPhotoScreen}
        options={{
          tabBarLabel: 'Photos',
          tabBarIcon: ({ focused }) => <TabIcon icon="📸" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="CTProfile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon icon="👤" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.white,
    borderTopWidth: 0,
    height: 65,
    paddingBottom: 8,
    paddingTop: 8,
    ...shadows.lg,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tabIconWrap: {
    width: 40,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabIconActive: {
    backgroundColor: colors.primary + '15',
  },
  tabIcon: {
    fontSize: 18,
    opacity: 0.6,
  },
  tabIconActiveText: {
    opacity: 1,
  },
});
