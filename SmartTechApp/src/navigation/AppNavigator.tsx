import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../store';
import { colors, spacing, typography } from '../theme';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ProfileScreen } from '../screens/common/ProfileScreen';
import { StudentDashboardScreen } from '../screens/student/DashboardScreen';
import { StudentResultsScreen } from '../screens/student/ResultsScreen';
import { StudentTimetableScreen } from '../screens/student/TimetableScreen';
import { StudentAttendanceScreen } from '../screens/student/AttendanceScreen';
import { ParentDashboardScreen } from '../screens/parent/DashboardScreen';
import { ParentChildrenScreen } from '../screens/parent/ChildrenScreen';
import { ParentChildResultsScreen } from '../screens/parent/ChildResultsScreen';
import { TeacherDashboardScreen } from '../screens/teacher/DashboardScreen';
import { TeacherClassesScreen } from '../screens/teacher/ClassesScreen';
import { TeacherMarksScreen } from '../screens/teacher/MarksScreen';
import { LearningStyleScreen } from '../screens/intelligence/LearningStyleScreen';
import { AiTutorScreen } from '../screens/intelligence/AiTutorScreen';
import { AnalyticsScreen } from '../screens/intelligence/AnalyticsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => (
  <View style={[tabStyles.iconContainer, focused && tabStyles.iconActive]}>
    <Text style={[tabStyles.icon, focused && tabStyles.iconActiveText]}>{name}</Text>
  </View>
);

const tabStyles = StyleSheet.create({
  iconContainer: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  icon: { fontSize: 14, color: colors.textLight },
  iconActive: { backgroundColor: colors.secondary + '20', borderRadius: 8 },
  iconActiveText: { color: colors.secondary, fontWeight: '700' },
});

function StudentTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.secondary, tabBarStyle: { borderTopColor: colors.border, paddingBottom: 4, height: 60 } }}>
      <Tab.Screen name="SDashboard" component={StudentDashboardScreen} options={{ tabBarLabel: 'Home', tabBarIcon: ({ focused }) => <TabIcon name="📊" focused={focused} /> }} />
      <Tab.Screen name="SResults" component={StudentResultsScreen} options={{ tabBarLabel: 'Results', tabBarIcon: ({ focused }) => <TabIcon name="📝" focused={focused} /> }} />
      <Tab.Screen name="STimetable" component={StudentTimetableScreen} options={{ tabBarLabel: 'Timetable', tabBarIcon: ({ focused }) => <TabIcon name="📅" focused={focused} /> }} />
      <Tab.Screen name="SAttendance" component={StudentAttendanceScreen} options={{ tabBarLabel: 'Attendance', tabBarIcon: ({ focused }) => <TabIcon name="✅" focused={focused} /> }} />
      <Tab.Screen name="SProfile" component={ProfileScreen} options={{ tabBarLabel: 'Profile', tabBarIcon: ({ focused }) => <TabIcon name="👤" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

function ParentTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.secondary, tabBarStyle: { borderTopColor: colors.border, paddingBottom: 4, height: 60 } }}>
      <Tab.Screen name="PDashboard" component={ParentDashboardScreen} options={{ tabBarLabel: 'Home', tabBarIcon: ({ focused }) => <TabIcon name="📊" focused={focused} /> }} />
      <Tab.Screen name="PChildren" component={ParentChildrenScreen} options={{ tabBarLabel: 'Children', tabBarIcon: ({ focused }) => <TabIcon name="👨‍👩‍👧‍👦" focused={focused} /> }} />
      <Tab.Screen name="PResults" component={ParentChildResultsScreen} options={{ tabBarLabel: 'Results', tabBarIcon: ({ focused }) => <TabIcon name="📝" focused={focused} /> }} />
      <Tab.Screen name="PProfile" component={ProfileScreen} options={{ tabBarLabel: 'Profile', tabBarIcon: ({ focused }) => <TabIcon name="👤" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

function TeacherTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.secondary, tabBarStyle: { borderTopColor: colors.border, paddingBottom: 4, height: 60 } }}>
      <Tab.Screen name="TDashboard" component={TeacherDashboardScreen} options={{ tabBarLabel: 'Home', tabBarIcon: ({ focused }) => <TabIcon name="📊" focused={focused} /> }} />
      <Tab.Screen name="TClasses" component={TeacherClassesScreen} options={{ tabBarLabel: 'Classes', tabBarIcon: ({ focused }) => <TabIcon name="🏫" focused={focused} /> }} />
      <Tab.Screen name="TMarks" component={TeacherMarksScreen} options={{ tabBarLabel: 'Marks', tabBarIcon: ({ focused }) => <TabIcon name="✏️" focused={focused} /> }} />
      <Tab.Screen name="TProfile" component={ProfileScreen} options={{ tabBarLabel: 'Profile', tabBarIcon: ({ focused }) => <TabIcon name="👤" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { isAuthenticated, user } = useAuthStore();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            {user?.roles?.includes('Student') && (
              <Stack.Screen name="StudentApp" component={StudentTabs} />
            )}
            {user?.roles?.includes('Parent') && (
              <Stack.Screen name="ParentApp" component={ParentTabs} />
            )}
            {(user?.roles?.includes('Teacher') || user?.roles?.includes('Class Teacher')) && (
              <Stack.Screen name="TeacherApp" component={TeacherTabs} />
            )}
            {(user?.roles?.includes('Director') || user?.roles?.includes('Head Teacher') || user?.roles?.includes('Deputy')) && (
              <Stack.Screen name="TeacherApp" component={TeacherTabs} />
            )}
            {(!user?.roles || user.roles.length === 0) && (
              <Stack.Screen name="StudentApp" component={StudentTabs} />
            )}
            <Stack.Screen name="LearningStyle" component={LearningStyleScreen} />
            <Stack.Screen name="AiTutor" component={AiTutorScreen} />
            <Stack.Screen name="Analytics" component={AnalyticsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
