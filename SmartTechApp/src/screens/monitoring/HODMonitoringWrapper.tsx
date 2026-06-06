import React from 'react';
import { MonitoringDashboardScreen } from './MonitoringDashboardScreen';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const HODMonitoringWrapper: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  return (
    <MonitoringDashboardScreen
      stackNavigation={navigation}
      onNavigate={(screen) => navigation.navigate(screen)}
    />
  );
};

export default HODMonitoringWrapper;
