'use client';

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { authApi, roleApi } from '@/lib/api';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  schoolId?: string | null;
  roles: string[];
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
  login: (email: string, password: string, isSuperAdmin?: boolean) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        
        if (parsedUser.id && !parsedUser.roles?.length) {
          roleApi.getUserRoles(parsedUser.id).then((roleRes: any) => {
            if (roleRes.data?.length) {
              const roles = roleRes.data.map((r: any) => r.roleName);
              const updatedUser = { ...parsedUser, roles };
              localStorage.setItem('user', JSON.stringify(updatedUser));
              setUser(updatedUser);
            }
          }).catch(() => {});
        }
      } catch (e) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string, isSuperAdmin: boolean = false) => {
    try {
      const response = isSuperAdmin 
        ? await authApi.superAdminLogin(email, password)
        : await authApi.login(email, password);
      
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
      if (payload.type === 'super_admin' || isSuperAdmin) {
        userData = {
          id: payload.sub,
          email: responseData?.user?.email || email,
          fullName: responseData?.user?.fullName || '',
          firstName: responseData?.user?.fullName?.split(' ')[0] || '',
          lastName: responseData?.user?.fullName?.split(' ').slice(1).join(' ') || '',
          roles: ['SuperAdmin'],
          role: 'SuperAdmin',
          schoolId: null,
        };
      } else {
        userData = {
          id: payload.sub,
          email: responseData?.user?.email || email,
          firstName: responseData?.user?.firstName || payload.firstName || '',
          lastName: responseData?.user?.lastName || payload.lastName || '',
          schoolId: payload.schoolId,
          roles: payload.roles || [],
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
    localStorage.removeItem('user');
    document.cookie = 'auth_token=;path=/;max-age=0';
    document.cookie = 'institution_type=;path=/;max-age=0';
    setToken(null);
    setUser(null);
  };

  const isSuperAdmin = user?.roles?.includes('SuperAdmin') || false;
  const isDirector = user?.roles?.includes('Director') || false;
  const isTeacher = user?.roles?.includes('Teacher') || user?.roles?.includes('ClassTeacher') || false;
  const isClassTeacher = user?.roles?.includes('ClassTeacher') || !!user?.classTeacherOf;

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
        login,
        logout,
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
  const { user } = useAuth();
  return user?.roles || [];
}

export function useIsSuperAdmin() {
  const { user } = useAuth();
  return user?.roles?.includes('SuperAdmin') || false;
}

export function useIsDirector() {
  const { user } = useAuth();
  return user?.roles?.includes('Director') || false;
}

export function useIsTeacher() {
  const { user } = useAuth();
  return user?.roles?.includes('Teacher') || user?.roles?.includes('ClassTeacher') || false;
}

export function useIsClassTeacher() {
  const { user } = useAuth();
  return user?.roles?.includes('ClassTeacher') || !!user?.classTeacherOf;
}

export function hasRole(roles: string[], requiredRole: string): boolean {
  return roles.includes(requiredRole);
}

export function hasAnyRole(roles: string[], requiredRoles: string[]): boolean {
  return requiredRoles.some(role => roles.includes(role));
}
