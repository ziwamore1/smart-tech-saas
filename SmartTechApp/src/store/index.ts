import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, DashboardData, Notification } from '../types';
import { apiService } from '../services/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string, deviceToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string, deviceToken?: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiService.login({
            email,
            password,
            deviceToken,
            platform: 'android',
          });
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          const message = error.response?.data?.message || 'Login failed';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await apiService.logout();
        } finally {
          set({ user: null, isAuthenticated: false });
        }
      },

      setUser: (user: User | null) => {
        set({ user, isAuthenticated: !!user });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

interface AppState {
  dashboard: DashboardData | null;
  notifications: Notification[];
  unreadCount: number;
  isLoadingDashboard: boolean;
  isLoadingNotifications: boolean;
  fetchDashboard: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  setUnreadCount: (count: number) => void;
  clearCache: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  dashboard: null,
  notifications: [],
  unreadCount: 0,
  isLoadingDashboard: false,
  isLoadingNotifications: false,

  fetchDashboard: async () => {
    set({ isLoadingDashboard: true });
    try {
      const data = await apiService.getDashboard();
      set({ dashboard: data, isLoadingDashboard: false });
    } catch (error) {
      set({ isLoadingDashboard: false });
      throw error;
    }
  },

  fetchNotifications: async () => {
    set({ isLoadingNotifications: true });
    try {
      const [notificationsRes, countRes] = await Promise.all([
        apiService.getNotifications(),
        apiService.getUnreadNotificationCount(),
      ]);
      set({
        notifications: notificationsRes.notifications || [],
        unreadCount: countRes.count || 0,
        isLoadingNotifications: false,
      });
    } catch (error) {
      set({ isLoadingNotifications: false });
      throw error;
    }
  },

  setUnreadCount: (count: number) => set({ unreadCount: count }),

  clearCache: () => set({ dashboard: null, notifications: [], unreadCount: 0 }),
}));

interface CacheState {
  timetable: any | null;
  results: any | null;
  attendance: any | null;
  lastFetched: {
    timetable?: number;
    results?: number;
    attendance?: number;
  };
  setTimetable: (data: any) => void;
  setResults: (data: any) => void;
  setAttendance: (data: any) => void;
  getTimetable: () => any | null;
  getResults: () => any | null;
  getAttendance: () => any | null;
  clearCache: () => void;
}

const CACHE_DURATION = 15 * 60 * 1000;

export const useCacheStore = create<CacheState>()(
  persist(
    (set, get) => ({
      timetable: null,
      results: null,
      attendance: null,
      lastFetched: {},

      setTimetable: (data: any) => {
        set({
          timetable: data,
          lastFetched: { ...get().lastFetched, timetable: Date.now() },
        });
      },

      setResults: (data: any) => {
        set({
          results: data,
          lastFetched: { ...get().lastFetched, results: Date.now() },
        });
      },

      setAttendance: (data: any) => {
        set({
          attendance: data,
          lastFetched: { ...get().lastFetched, attendance: Date.now() },
        });
      },

      getTimetable: () => {
        const { timetable, lastFetched } = get();
        if (!timetable || !lastFetched.timetable) return null;
        if (Date.now() - lastFetched.timetable > CACHE_DURATION) return null;
        return timetable;
      },

      getResults: () => {
        const { results, lastFetched } = get();
        if (!results || !lastFetched.results) return null;
        if (Date.now() - lastFetched.results > CACHE_DURATION) return null;
        return results;
      },

      getAttendance: () => {
        const { attendance, lastFetched } = get();
        if (!attendance || !lastFetched.attendance) return null;
        if (Date.now() - lastFetched.attendance > CACHE_DURATION) return null;
        return attendance;
      },

      clearCache: () => set({ timetable: null, results: null, attendance: null, lastFetched: {} }),
    }),
    {
      name: 'cache-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
