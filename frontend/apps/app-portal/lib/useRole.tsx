"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';

export type UserRole = 
  | 'SuperAdmin'
  | 'Director'
  | 'Deputy Director'
  | 'Head Teacher'
  | 'Deputy'
  | 'Deputy Head'
  | 'HOD'
  | 'Accountant'
  | 'Secretary'
  | 'Teacher'
  | 'Class Teacher'
  | 'Lower Primary Senior Teacher'
  | 'Upper Primary Senior Teacher'
  | 'Student'
  | 'Parent';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  schoolId: string;
  roles: UserRole[];
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = () => {
      if (typeof window === 'undefined') {
        setIsLoading(false);
        return;
      }
      
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const parsed = JSON.parse(userStr);
          setUser(parsed);
        } catch {
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    loadUser();
  }, []);

  const login = (userData: User, token: string) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('auth_token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  const hasRole = (...roles: UserRole[]): boolean => {
    if (!user || roles.length === 0) return true;
    const userAll = (user as any).allRoles || user.roles || [];
    return roles.some(role =>
      userAll.some((ur: string) => ur.toLowerCase().replace(/\s+/g, '') === role.toLowerCase().replace(/\s+/g, ''))
    );
  };

  const isDirector = (): boolean => hasRole('Director');
  const isSuperAdmin = (): boolean => hasRole('SuperAdmin');
  const isTeacher = (): boolean => hasRole('Teacher', 'Class Teacher');
  const isAdmin = (): boolean => hasRole('Director', 'SuperAdmin', 'Head Teacher', 'Deputy', 'Deputy Head', 'HOD');

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    hasRole,
    isDirector,
    isSuperAdmin,
    isTeacher,
    isAdmin,
  };
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
  fallback?: React.ReactNode;
}

export function ProtectedRoute({ children, requiredRoles, fallback }: ProtectedRouteProps) {
  const { user, isLoading, hasRole } = useAuth();
  const router = useRouter();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
        setShouldRedirect(true);
      } else if (requiredRoles && !hasRole(...requiredRoles)) {
        setShouldRedirect(true);
      }
    }
  }, [user, isLoading, requiredRoles, hasRole, router]);

  if (isLoading || shouldRedirect) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || (requiredRoles && !hasRole(...requiredRoles))) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500">You don't have permission to view this page.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function requireRole(...roles: UserRole[]) {
  return (component: React.ReactNode) => (
    <ProtectedRoute requiredRoles={roles}>
      {component}
    </ProtectedRoute>
  );
}

export function RoleGuard({ 
  children, 
  role, 
  fallback = null 
}: { 
  children: React.ReactNode; 
  role: UserRole;
  fallback?: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  
  const userAll = (user as any)?.allRoles || user?.roles || [];
  const hasRole = userAll.some((ur: string) => ur.toLowerCase().replace(/\s+/g, '') === role.toLowerCase().replace(/\s+/g, ''));
  
  if (!hasRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}