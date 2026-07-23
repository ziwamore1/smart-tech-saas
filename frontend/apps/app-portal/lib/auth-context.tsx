'use client';

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { authApi, roleApi } from '@/lib/api';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  username?: string;
  schoolId?: string | null;
  roles: string[];
  platformRoles?: string[];
  schoolRoles?: string[];
  role?: string;
  teacherId?: string;
  classTeacherOf?: string;
  institutionType?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isSuperAdmin: boolean;
  isDirector: boolean;
  isTeacher: boolean;
  isClassTeacher: boolean;
  allRoles: string[];
  login: (identifier: string, password: string, isSuperAdmin?: boolean, schoolId?: string) => Promise<void>;
  logout: () => void;
  switchToSchool: (schoolId: string) => Promise<void>;
  switchToSuperAdmin: () => void;
  isImpersonating: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mergeAllRoles(user: User | null): string[] {
  if (!user) return [];
  const seen = new Set<string>();
  const merged: string[] = [];
  const add = (r: string) => {
    const key = r.toLowerCase().replace(/\s+/g, '');
    if (!seen.has(key)) { seen.add(key); merged.push(r); }
  };
  (user.roles || []).forEach(add);
  (user.platformRoles || []).forEach(add);
  (user.schoolRoles || []).forEach(add);
  return merged;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('user');
    
    if (!storedToken || !storedUser) {
      setIsLoading(false);
      return;
    }

    setToken(storedToken);
    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);

      // Fetch fresh profile from backend to sync roles (handles role changes without re-login)
      authApi.getMe().then((res: any) => {
        const profile = res.data?.data || res.data;
        if (profile) {
          const mergedUser = {
            ...parsedUser,
            id: profile.id || parsedUser.id,
            email: profile.email || parsedUser.email,
            firstName: profile.firstName || parsedUser.firstName,
            lastName: profile.lastName || parsedUser.lastName,
            phone: profile.phone || parsedUser.phone,
            roles: profile.roles || parsedUser.roles,
            schoolRoles: profile.schoolRoles || parsedUser.schoolRoles,
            platformRoles: profile.platformRoles || parsedUser.platformRoles,
            schoolId: profile.schoolId ?? parsedUser.schoolId,
            teacherId: profile.teacherId || parsedUser.teacherId,
            classTeacherOf: profile.classTeacherOf || parsedUser.classTeacherOf,
            institutionType: profile.institutionType || parsedUser.institutionType,
          };
          localStorage.setItem('user', JSON.stringify(mergedUser));
          setUser(mergedUser);
        }
        setIsLoading(false);
      }).catch((err: any) => {
        const status = err?.response?.status;
        if (status === 401 || status === 403 || status === 404) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          localStorage.removeItem('sa_token');
          localStorage.removeItem('sa_user');
          setToken(null);
          setUser(null);
        }
        setIsLoading(false);
      });
    } catch (e) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      setIsLoading(false);
    }
  }, []);

  const login = async (identifier: string, password: string, isSuperAdmin: boolean = false, schoolId?: string) => {
    try {
      const response = isSuperAdmin 
        ? await authApi.superAdminLogin(identifier, password)
        : await authApi.login(identifier, password, schoolId);
      
      const responseData = response.data?.data || response.data;
      const access_token = responseData?.access_token;
      
      if (!access_token) {
        console.error('[Auth] No access token in response');
        throw new Error('Login failed: No access token received');
      }
      
      localStorage.setItem('auth_token', access_token);
      setToken(access_token);

      const payload = JSON.parse(atob(access_token.split('.')[1]));
      console.log('[Auth] JWT Payload:', JSON.stringify(payload));
      
      let userData: User;
      if (isSuperAdmin || payload.type === 'super_admin') {
        localStorage.setItem('sa_token', access_token);
        userData = {
          id: payload.sub,
          email: responseData?.user?.email || identifier,
          fullName: responseData?.user?.fullName || '',
          firstName: responseData?.user?.fullName?.split(' ')[0] || '',
          lastName: responseData?.user?.fullName?.split(' ').slice(1).join(' ') || '',
          phone: responseData?.user?.phone,
          roles: ['SuperAdmin'],
          role: 'SuperAdmin',
          schoolId: null,
        };
        localStorage.setItem('sa_user', JSON.stringify(userData));
      } else {
        userData = {
          id: payload.sub,
          email: responseData?.user?.email || identifier,
          firstName: responseData?.user?.firstName || payload.firstName || '',
          lastName: responseData?.user?.lastName || payload.lastName || '',
          phone: responseData?.user?.phone,
          schoolId: payload.schoolId,
          roles: payload.roles || [],
          platformRoles: payload.platformRoles || responseData?.user?.platformRoles || [],
          schoolRoles: payload.schoolRoles || responseData?.user?.schoolRoles || [],
          teacherId: payload.teacherId,
          classTeacherOf: payload.classTeacherOf,
          institutionType: payload.institutionType || null,
        };
        console.log('[Auth] User data set:', JSON.stringify(userData));
        console.log('[Auth] responseData.user:', JSON.stringify(responseData?.user));
      }
      
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      document.cookie = `auth_token=${access_token};path=/;max-age=${7 * 24 * 60 * 60};SameSite=Lax`;
      const instType = userData.institutionType || '';
      document.cookie = `institution_type=${instType};path=/;max-age=${7 * 24 * 60 * 60};SameSite=Lax`;
    } catch (error: any) {
      console.error('[Auth] Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('sa_token');
    localStorage.removeItem('user');
    localStorage.removeItem('sa_user');
    document.cookie = 'auth_token=;path=/;max-age=0';
    document.cookie = 'institution_type=;path=/;max-age=0';
    setToken(null);
    setUser(null);
  };

  const switchToSchool = async (schoolId: string) => {
    const saToken = localStorage.getItem('sa_token');
    if (!saToken) throw new Error('No SuperAdmin token available');

    const response = await authApi.switchIdentity(schoolId);
    const data = response.data?.data || response.data;
    if (!data?.access_token) throw new Error('Failed to switch identity');

    localStorage.setItem('auth_token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    window.location.href = '/dashboard';
  };

  const switchToSuperAdmin = () => {
    const saToken = localStorage.getItem('sa_token');
    const saUser = localStorage.getItem('sa_user');
    if (!saToken || !saUser) {
      window.location.href = '/login';
      return;
    }
    localStorage.setItem('auth_token', saToken);
    localStorage.setItem('user', saUser);
    localStorage.removeItem('sa_token');
    localStorage.removeItem('sa_user');
    window.location.reload();
  };

  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    setIsImpersonating(!!localStorage.getItem('sa_token'));
  }, []);

  const allRoles = mergeAllRoles(user);
  const isSuperAdmin = allRoles.includes('SuperAdmin');
  const isDirector = allRoles.includes('Director') || allRoles.includes('SuperAdmin');
  const isTeacher = allRoles.includes('Teacher') || allRoles.includes('Class Teacher') || allRoles.includes('ClassTeacher');
  const isClassTeacher = allRoles.includes('Class Teacher') || allRoles.includes('ClassTeacher') || !!user?.classTeacherOf;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isSuperAdmin,
        isDirector,
        isTeacher,
        isClassTeacher,
        allRoles,
        login,
        logout,
        switchToSchool,
        switchToSuperAdmin,
        isImpersonating,
        isAuthenticated: !!token && !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useUserRoles() {
  const { allRoles } = useAuth();
  return allRoles;
}

export function useIsSuperAdmin() {
  const { isSuperAdmin } = useAuth();
  return isSuperAdmin;
}

export function useIsDirector() {
  const { isDirector } = useAuth();
  return isDirector;
}

export function useIsTeacher() {
  const { isTeacher } = useAuth();
  return isTeacher;
}

export function useIsClassTeacher() {
  const { isClassTeacher } = useAuth();
  return isClassTeacher;
}

export function hasRole(roles: string[], requiredRole: string): boolean {
  return roles.some(r => r.toLowerCase().replace(/\s+/g, '') === requiredRole.toLowerCase().replace(/\s+/g, ''));
}

export function hasAnyRole(roles: string[], requiredRoles: string[]): boolean {
  return requiredRoles.some(role => hasRole(roles, role));
}
