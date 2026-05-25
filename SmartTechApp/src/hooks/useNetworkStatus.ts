import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

interface NetworkState {
  isConnected: boolean;
  isOnline: boolean;
  type: string;
}

export function useNetworkStatus(): NetworkState {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: true,
    isOnline: true,
    type: 'unknown',
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkState({
        isConnected: state.isConnected ?? false,
        isOnline: state.isInternetReachable ?? false,
        type: state.type || 'unknown',
      });
    });

    NetInfo.fetch().then(state => {
      setNetworkState({
        isConnected: state.isConnected ?? false,
        isOnline: state.isInternetReachable ?? false,
        type: state.type || 'unknown',
      });
    });

    return () => unsubscribe();
  }, []);

  return networkState;
}
