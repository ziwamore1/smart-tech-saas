import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '../storage/mmkv';
import { User, DashboardData, Notification, INSTITUTION_TYPE_ROLES, InstitutionTypeCode, SuperAdminLoginResponse } from '../types';
import { apiService } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  saUser: User | null;
  saToken: string | null;
  login: (email: string, password: string, deviceToken?: string, username?: string) => Promise<void>;
  superAdminLogin: (email: string, password: string) => Promise<void>;
  switchToSchool: (schoolId: string) => Promise<void>;
  switchToSuperAdmin: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  clearError: () => void;
}

function extractInstitutionType(user: User): string | null {
  if (user.institutionType) return user.institutionType;
  const typeRoles = Object.entries(INSTITUTION_TYPE_ROLES) as [InstitutionTypeCode, string[]][];
  for (const [typeCode, roles] of typeRoles) {
    if (user.roles.some(r => roles.includes(r) || roles.some(tr => tr.toLowerCase() === r.toLowerCase()))) {
      return typeCode;
    }
  }
  return null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      saUser: null,
      saToken: null,

      login: async (email: string, password: string, deviceToken?: string, username?: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiService.login({
            ...(username ? { username } : { email }),
            password,
            deviceToken,
            platform: 'android',
          });
          const user = response.user;
          if (!user.institutionType) {
            user.institutionType = extractInstitutionType(user);
          }
          set({
            user,
            isAuthenticated: true,
            saUser: null,
            saToken: null,
            isLoading: false,
          });
        } catch (error: any) {
          const message = error.response?.data?.message || 'Login failed';
          set({ error: message, isLoading: false });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      superAdminLogin: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          console.log('[mobile-auth] store request start');
          const response: SuperAdminLoginResponse = await apiService.superAdminLogin({ email, password });
          console.log('[mobile-auth] store response received');
          const saUser: User = {
            id: response.user.id,
            email: response.user.email,
            firstName: response.user.fullName || response.user.email,
            lastName: '',
            roles: ['SuperAdmin'],
            schoolId: null,
            institutionType: null,
          };
          void AsyncStorage.setItem('sa_token', response.access_token).catch((error) =>
            console.warn('Failed to persist SuperAdmin token:', error),
          );
          void AsyncStorage.setItem('sa_user', JSON.stringify(saUser)).catch((error) =>
            console.warn('Failed to persist SuperAdmin user:', error),
          );
          set({
            user: saUser,
            isAuthenticated: true,
            saUser,
            saToken: response.access_token,
            isLoading: false,
          });
        } catch (error: any) {
          const message = error.response?.data?.message || 'SuperAdmin login failed';
          set({ error: message, isLoading: false });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      switchToSchool: async (schoolId: string) => {
        const currentUser = get().saUser || get().user;
        const currentToken = get().saToken || apiService.getToken() || await AsyncStorage.getItem('access_token');
        if (!currentUser || !currentToken) throw new Error('SuperAdmin session not available');
        const response = await apiService.switchIdentity(schoolId);
        const user = response.user;
        if (!user.institutionType) user.institutionType = extractInstitutionType(user);
        void AsyncStorage.setItem('sa_token', currentToken).catch((error) =>
          console.warn('Failed to persist SuperAdmin token:', error),
        );
        void AsyncStorage.setItem('sa_user', JSON.stringify(currentUser)).catch((error) =>
          console.warn('Failed to persist SuperAdmin user:', error),
        );
        set({ user, isAuthenticated: true, saUser: currentUser, saToken: currentToken, error: null });
      },

      switchToSuperAdmin: async () => {
        const saToken = get().saToken || await AsyncStorage.getItem('sa_token');
        const stored = get().saUser || JSON.parse((await AsyncStorage.getItem('sa_user')) || 'null');
        if (!saToken || !stored) throw new Error('SuperAdmin session not available');
        apiService.setToken(saToken);
        void AsyncStorage.setItem('access_token', saToken).catch((error) =>
          console.warn('Failed to persist access token:', error),
        );
        void AsyncStorage.setItem('user', JSON.stringify(stored)).catch((error) =>
          console.warn('Failed to persist user:', error),
        );
        set({ user: stored, isAuthenticated: true, saUser: stored, saToken, error: null });
      },

      logout: async () => {
        try {
          await apiService.logout();
        } finally {
          set({ user: null, isAuthenticated: false, saUser: null, saToken: null });
        }
      },

      setUser: (user: User | null) => {
        set({ user, isAuthenticated: !!user });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        saUser: state.saUser,
        saToken: state.saToken,
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
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
