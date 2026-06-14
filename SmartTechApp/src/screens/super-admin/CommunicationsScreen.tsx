import React from 'react';
import { CommunicationsHub } from './communications/CommunicationsHub';

export const SuperAdminCommunicationsScreen: React.FC<any> = (props) => {
  return <CommunicationsHub {...props} />;
};
