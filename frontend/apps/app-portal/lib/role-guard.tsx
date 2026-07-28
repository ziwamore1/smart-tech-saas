"use client";

import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AccessDenied } from '@/components/AccessDenied';

export type UserRole = 
  | 'SuperAdmin'
  | 'Director'
  | 'Deputy Director'
  | 'Head Teacher'
  | 'Deputy'
  | 'Deputy Head'
  | 'Accountant'
  | 'Secretary'
  | 'Teacher'
  | 'Class Teacher'
  | 'HOD'
  | 'Lower Primary Senior Teacher'
  | 'Upper Primary Senior Teacher'
  | 'Student'
  | 'Parent';

interface RoleProtectionProps {
  children: ReactNode;
  requiredRoles?: UserRole[];
}

export function RoleGuard({ children, requiredRoles }: RoleProtectionProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isAllowed, setIsAllowed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    
    if (!isAuthenticated) {
      router.push(`/login?redirect=${pathname}`);
      return;
    }

    if (requiredRoles && requiredRoles.length > 0) {
      const userRoles = user?.allRoles || user?.roles || [];
      const hasRequiredRole = requiredRoles.some(role =>
        userRoles.some((ur: string) => ur.toLowerCase().replace(/\s+/g, '') === role.toLowerCase().replace(/\s+/g, ''))
      );
      setIsAllowed(hasRequiredRole);
    } else {
      setIsAllowed(true);
    }
    setChecked(true);
  }, [isLoading, isAuthenticated, user, requiredRoles, router, pathname]);

  if (isLoading || !checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    return <AccessDenied requiredRoles={requiredRoles} />;
  }

  return <>{children}</>;
}

export function withRole(WrappedComponent: React.ComponentType<any>, requiredRoles: UserRole[]) {
  return function WithRoleComponent(props: any) {
    return (
      <RoleGuard requiredRoles={requiredRoles}>
        <WrappedComponent {...props} />
      </RoleGuard>
    );
  };
}

export function DirectorOnly({ children }: { children: ReactNode }) {
  return <RoleGuard requiredRoles={['Director']}>{children}</RoleGuard>;
}

export function SuperAdminOnly({ children }: { children: ReactNode }) {
  return <RoleGuard requiredRoles={['SuperAdmin']}>{children}</RoleGuard>;
}

export function AdminOnly({ children }: { children: ReactNode }) {
  return <RoleGuard requiredRoles={['Director', 'SuperAdmin', 'Head Teacher', 'Deputy', 'HOD']}>{children}</RoleGuard>;
}

export function TeacherOnly({ children }: { children: ReactNode }) {
  return <RoleGuard requiredRoles={['Teacher', 'Class Teacher']}>{children}</RoleGuard>;
}

export function AccountantOnly({ children }: { children: ReactNode }) {
  return <RoleGuard requiredRoles={['Accountant', 'Director']}>{children}</RoleGuard>;
}