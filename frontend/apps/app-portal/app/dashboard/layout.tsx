'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useIsSuperAdmin, useIsDirector, useIsTeacher, useIsClassTeacher } from '@/lib/auth-context';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { schoolApi } from '@/lib/api';
import '../dashboard-fix.css';

type NavItem = {
  name: string;
  href: string;
  icon: string;
  color: string;
  roles?: string[];
  typeRoles?: Record<string, string[]>;
  institutionTypes?: string[];
};

const ROLE_MAP: Record<string, Record<string, string[]>> = {
  admin: {
    PRIMARY_SCHOOL: ['Director', 'Head Teacher', 'Deputy Head', 'Lower Primary Senior Teacher', 'Upper Primary Senior Teacher'],
    SECONDARY_SCHOOL: ['Director', 'Deputy Director'],
    ADVANCED_SECONDARY: ['Director', 'Deputy Director'],
    COLLEGE: ['Principal', 'Registrar'],
    UNIVERSITY: ['Vice Chancellor', 'Dean'],
  },
  teaching: {
    PRIMARY_SCHOOL: ['Director', 'Head Teacher', 'Deputy Head', 'Lower Primary Senior Teacher', 'Upper Primary Senior Teacher', 'Primary Teacher'],
    SECONDARY_SCHOOL: ['Director', 'Deputy Director', 'HOD', 'Teacher', 'Class Teacher'],
    ADVANCED_SECONDARY: ['Director', 'Deputy Director', 'HOD', 'Teacher', 'Class Teacher'],
    COLLEGE: ['Principal', 'Lecturer'],
    UNIVERSITY: ['Dean', 'Lecturer', 'Research Supervisor'],
  },
  teachingStaff: {
    PRIMARY_SCHOOL: ['Primary Teacher'],
    SECONDARY_SCHOOL: ['Teacher', 'Class Teacher'],
    ADVANCED_SECONDARY: ['Teacher', 'Class Teacher'],
    COLLEGE: ['Lecturer'],
    UNIVERSITY: ['Lecturer', 'Research Supervisor'],
  },
  student: {
    PRIMARY_SCHOOL: ['Learner'],
    SECONDARY_SCHOOL: ['Student'],
    ADVANCED_SECONDARY: ['Student'],
    COLLEGE: ['Student'],
    UNIVERSITY: ['Student'],
  },
  parent: {
    PRIMARY_SCHOOL: ['Parent'],
    SECONDARY_SCHOOL: ['Parent'],
    ADVANCED_SECONDARY: ['Parent'],
    COLLEGE: [],
    UNIVERSITY: [],
  },
  everyone: {
    PRIMARY_SCHOOL: ['Director', 'Head Teacher', 'Deputy Head', 'Lower Primary Senior Teacher', 'Upper Primary Senior Teacher', 'Primary Teacher', 'Parent', 'Learner'],
    SECONDARY_SCHOOL: ['Director', 'Deputy Director', 'HOD', 'Teacher', 'Class Teacher', 'Parent', 'Student'],
    ADVANCED_SECONDARY: ['Director', 'Deputy Director', 'HOD', 'Teacher', 'Class Teacher', 'Parent', 'Student'],
    COLLEGE: ['Principal', 'Registrar', 'Lecturer', 'Student'],
    UNIVERSITY: ['Vice Chancellor', 'Dean', 'Lecturer', 'Research Supervisor', 'Student'],
  },
};

function r(type: string, roles: string[]): Record<string, string[]> {
  return { [type]: roles };
}

const regularNav: NavItem[] = [
  { 
    name: 'Dashboard', 
    href: '/dashboard', 
    icon: 'fa-th-large',
    color: '#ea6645',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY']
  },
  { 
    name: 'Primary Dashboard', 
    href: '/dashboard/primary', 
    icon: 'fa-th-large',
    color: '#059669',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL']
  },
  { 
    name: 'Pupil Registration', 
    href: '/dashboard/primary/students', 
    icon: 'fa-user-graduate',
    color: '#3b82f6',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL']
  },
  { 
    name: 'Primary Staff', 
    href: '/dashboard/primary/teachers', 
    icon: 'fa-chalkboard-teacher',
    color: '#10b981',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL']
  },
  { 
    name: 'Primary Classes', 
    href: '/dashboard/primary/classes', 
    icon: 'fa-school',
    color: '#8b5cf6',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL']
  },
  { 
    name: 'Primary Subjects', 
    href: '/dashboard/primary/subjects', 
    icon: 'fa-book',
    color: '#f59e0b',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL']
  },
  { 
    name: 'Primary Curriculum', 
    href: '/dashboard/primary/curriculum', 
    icon: 'fa-book-open',
    color: '#0891b2',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL']
  },
  { 
    name: 'ECE Module', 
    href: '/dashboard/primary/ece', 
    icon: 'fa-baby',
    color: '#ec4899',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL']
  },
  { 
    name: 'Grade 7 ECZ', 
    href: '/dashboard/primary/grade7', 
    icon: 'fa-graduation-cap',
    color: '#7c3aed',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL']
  },
  { 
    name: 'Secondary Dashboard', 
    href: '/dashboard/secondary', 
    icon: 'fa-school',
    color: '#3b82f6',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['SECONDARY_SCHOOL']
  },
  { 
    name: 'Advanced Secondary', 
    href: '/dashboard/advanced-secondary', 
    icon: 'fa-graduation-cap',
    color: '#a855f7',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['ADVANCED_SECONDARY']
  },
  { 
    name: 'College Dashboard', 
    href: '/dashboard/college', 
    icon: 'fa-landmark',
    color: '#06b6d4',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['COLLEGE']
  },
  { 
    name: 'University Dashboard', 
    href: '/dashboard/university', 
    icon: 'fa-university',
    color: '#d97706',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['UNIVERSITY']
  },
  { 
    name: 'Students', 
    href: '/dashboard/students', 
    icon: 'fa-user-graduate',
    color: '#3b82f6',
    typeRoles: ROLE_MAP.teaching,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Teachers', 
    href: '/dashboard/teachers', 
    icon: 'fa-chalkboard-teacher',
    color: '#10b981',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Staff Positions', 
    href: '/dashboard/staff-positions', 
    icon: 'fa-user-tag',
    color: '#0891b2',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY']
  },
  { 
    name: 'Staff Returns Hub', 
    href: '/dashboard/staff-records', 
    icon: 'fa-id-card',
    color: '#a855f7',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY']
  },
  { 
    name: 'Classes', 
    href: '/dashboard/classes', 
    icon: 'fa-school',
    color: '#8b5cf6',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Class List', 
    href: '/dashboard/class-list', 
    icon: 'fa-list-alt',
    color: '#06b6d4',
    typeRoles: ROLE_MAP.teaching,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Subjects', 
    href: '/dashboard/subjects', 
    icon: 'fa-book',
    color: '#f59e0b',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Elements of Construct', 
    href: '/dashboard/elements-of-construct', 
    icon: 'fa-puzzle-piece',
    color: '#8b5cf6',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Topics & Subtopics', 
    href: '/dashboard/topics', 
    icon: 'fa-sitemap',
    color: '#06b6d4',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Competencies', 
    href: '/dashboard/competencies', 
    icon: 'fa-bullseye',
    color: '#f97316',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'SBA Tasks', 
    href: '/dashboard/sba-tasks', 
    icon: 'fa-tasks',
    color: '#22c55e',
    typeRoles: ROLE_MAP.teaching,
    institutionTypes: ['SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Timetable', 
    href: '/timetable', 
    icon: 'fa-calendar-alt',
    color: '#ec4899',
    typeRoles: ROLE_MAP.teaching,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY']
  },
  { 
    name: 'Attendance Register', 
    href: '/dashboard/attendance-register', 
    icon: 'fa-clipboard-list',
    color: '#059669',
    typeRoles: ROLE_MAP.teaching,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Attendance Dashboard', 
    href: '/dashboard/attendance/dashboard', 
    icon: 'fa-chart-pie',
    color: '#0d9488',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Assessments', 
    href: '/dashboard/assessments', 
    icon: 'fa-clipboard-check',
    color: '#f97316',
    typeRoles: ROLE_MAP.teaching,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY']
  },
  { 
    name: 'Score Entry', 
    href: '/dashboard/assessment-entry', 
    icon: 'fa-edit',
    color: '#2563eb',
    typeRoles: ROLE_MAP.teaching,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Assessment Config', 
    href: '/dashboard/assessment-config', 
    icon: 'fa-cogs',
    color: '#7c3aed',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Assessment Defs', 
    href: '/dashboard/assessments/definitions', 
    icon: 'fa-layer-group',
    color: '#0891b2',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Assessment Oversight', 
    href: '/dashboard/assessment-oversight', 
    icon: 'fa-eye',
    color: '#7c3aed',
    typeRoles: {
      PRIMARY_SCHOOL: ['Director', 'Head Teacher', 'Deputy Head'],
      SECONDARY_SCHOOL: ['Director', 'Deputy Director', 'HOD'],
      ADVANCED_SECONDARY: ['Director', 'Deputy Director', 'HOD'],
      COLLEGE: ['Principal', 'Registrar'],
      UNIVERSITY: ['Vice Chancellor', 'Dean'],
    },
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY']
  },
  { 
    name: 'Teacher Performance', 
    href: '/dashboard/teacher-performance', 
    icon: 'fa-chart-bar',
    color: '#0891b2',
    typeRoles: {
      PRIMARY_SCHOOL: ['Director', 'Head Teacher', 'Deputy Head'],
      SECONDARY_SCHOOL: ['Director', 'Deputy Director', 'HOD'],
      ADVANCED_SECONDARY: ['Director', 'Deputy Director', 'HOD'],
      COLLEGE: ['Principal', 'Registrar'],
      UNIVERSITY: ['Vice Chancellor', 'Dean'],
    },
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY']
  },
  { 
    name: 'Role Permissions', 
    href: '/dashboard/permissions', 
    icon: 'fa-shield-alt',
    color: '#6366f1',
    typeRoles: {
      PRIMARY_SCHOOL: ['Director', 'Head Teacher'],
      SECONDARY_SCHOOL: ['Director', 'Deputy Director'],
      ADVANCED_SECONDARY: ['Director', 'Deputy Director'],
      COLLEGE: ['Principal'],
      UNIVERSITY: ['Vice Chancellor'],
    },
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY']
  },
  { 
    name: 'Results Management', 
    href: '/dashboard/results-management', 
    icon: 'fa-file-alt',
    color: '#ea6645',
    typeRoles: ROLE_MAP.teaching,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Results Analytics', 
    href: '/dashboard/result-analytics', 
    icon: 'fa-chart-line',
    color: '#059669',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Report Cards', 
    href: '/dashboard/report-cards', 
    icon: 'fa-file-text',
    color: '#0891b2',
    typeRoles: ROLE_MAP.teaching,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Template Personalization', 
    href: '/dashboard/template-personalization', 
    icon: 'fa-palette',
    color: '#ea6645',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY']
  },
  { 
    name: 'Grading Policies', 
    href: '/dashboard/grading-policies', 
    icon: 'fa-graduation-cap',
    color: '#dc2626',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Online Exams', 
    href: '/dashboard/exams', 
    icon: 'fa-file-signature',
    color: '#dc2626',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Fees',
    href: '/dashboard/fees', 
    icon: 'fa-money-bill-wave',
    color: '#22c55e',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Reports', 
    href: '/dashboard/reports', 
    icon: 'fa-file-alt',
    color: '#6366f1',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Communications', 
    href: '/dashboard/communications', 
    icon: 'fa-comments',
    color: '#0ea5e9',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY']
  },
  { 
    name: 'Library', 
    href: '/dashboard/library', 
    icon: 'fa-book-open',
    color: '#0d9488',
    typeRoles: ROLE_MAP.teaching,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY']
  },
  { 
    name: 'Lesson Plans', 
    href: '/dashboard/lesson-plans', 
    icon: 'fa-clipboard-list',
    color: '#f59e0b',
    typeRoles: ROLE_MAP.teaching,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Photo Gallery', 
    href: '/dashboard/gallery', 
    icon: 'fa-images',
    color: '#db2777',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY']
  },
  { 
    name: 'Analytics', 
    href: '/dashboard/analytics', 
    icon: 'fa-chart-bar',
    color: '#a855f7',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Enhanced Analytics', 
    href: '/dashboard/analytics-enhanced', 
    icon: 'fa-chart-line',
    color: '#ec4899',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'AI Tutor', 
    href: '/dashboard/ai-tutor', 
    icon: 'fa-robot',
    color: '#14b8a6',
    typeRoles: ROLE_MAP.everyone,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY']
  },
  { 
    name: 'Benchmarking', 
    href: '/dashboard/benchmarking', 
    icon: 'fa-trophy',
    color: '#f59e0b',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Psychometric', 
    href: '/dashboard/psychometric', 
    icon: 'fa-flask',
    color: '#8b5cf6',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY']
  },
  { 
    name: 'Adaptive Testing', 
    href: '/dashboard/adaptive-testing', 
    icon: 'fa-microchip',
    color: '#06b6d4',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Learning Style', 
    href: '/dashboard/learning-style', 
    icon: 'fa-brain',
    color: '#10b981',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Exam Quality', 
    href: '/dashboard/exam-quality', 
    icon: 'fa-clipboard-check',
    color: '#f97316',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Users', 
    href: '/dashboard/users', 
    icon: 'fa-users',
    color: '#059669',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'School Members', 
    href: '/dashboard/school-members', 
    icon: 'fa-user-plus',
    color: '#0891b2',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Parents', 
    href: '/dashboard/parents', 
    icon: 'fa-user-friends',
    color: '#ec4899',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Digital Stamps', 
    href: '/dashboard/digital-stamps', 
    icon: 'fa-stamp',
    color: '#7c3aed',
    typeRoles: ROLE_MAP.teaching,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Account Center', 
    href: '/security/account-center', 
    icon: 'fa-user-circle',
    color: '#6366f1',
    typeRoles: ROLE_MAP.everyone,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY']
  },
  { 
    name: 'Device Manager', 
    href: '/security/device-manager', 
    icon: 'fa-laptop',
    color: '#06b6d4',
    typeRoles: ROLE_MAP.everyone,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY']
  },
  { 
    name: 'OTP Verification', 
    href: '/security/otp', 
    icon: 'fa-shield-alt',
    color: '#0d9488',
    typeRoles: ROLE_MAP.everyone,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY']
  },
  { 
    name: 'Password Hub', 
    href: '/security/password-hub', 
    icon: 'fa-key',
    color: '#dc2626',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Audit Center', 
    href: '/security/audit-center', 
    icon: 'fa-history',
    color: '#f59e0b',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Account Recovery', 
    href: '/security/recovery', 
    icon: 'fa-life-ring',
    color: '#10b981',
    typeRoles: ROLE_MAP.everyone,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY']
  },
  { 
    name: 'Curriculum', 
    href: '/dashboard/curriculum', 
    icon: 'fa-book-open',
    color: '#0891b2',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY']
  },
  { 
    name: 'Settings', 
    href: '/dashboard/settings', 
    icon: 'fa-cog',
    color: '#64748b',
    typeRoles: ROLE_MAP.admin,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY']
  },
  { 
    name: 'Profile', 
    href: '/dashboard/profile', 
    icon: 'fa-user-circle',
    color: '#ea6645',
    typeRoles: ROLE_MAP.everyone,
    institutionTypes: ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY']
  },
];

const superAdminNav = [
  { 
    name: 'Dashboard', 
    href: '/super-admin', 
    icon: 'fa-th-large',
    color: '#ea6645'
  },
  { 
    name: 'Schools', 
    href: '/super-admin/schools', 
    icon: 'fa-building',
    color: '#3b82f6'
  },
  { 
    name: 'Subscription Plans', 
    href: '/super-admin/subscription-plans', 
    icon: 'fa-credit-card',
    color: '#10b981'
  },
  { 
    name: 'Institution Types', 
    href: '/super-admin/institution-types', 
    icon: 'fa-university',
    color: '#059669'
  },
  { 
    name: 'Platform Roles', 
    href: '/super-admin/platform-roles', 
    icon: 'fa-user-shield',
    color: '#7c3aed'
  },
  { 
    name: 'Feature Locks', 
    href: '/super-admin/model-locks', 
    icon: 'fa-lock',
    color: '#8b5cf6'
  },
  { 
    name: 'Intelligence', 
    href: '/super-admin/intelligence', 
    icon: 'fa-brain',
    color: '#14b8a6'
  },
  { 
    name: 'Audit Logs', 
    href: '/super-admin/audit-logs', 
    icon: 'fa-history',
    color: '#f59e0b'
  },
  { 
    name: 'Password Hub', 
    href: '/security/password-hub', 
    icon: 'fa-key',
    color: '#dc2626'
  },
  { 
    name: 'Account Center', 
    href: '/security/account-center', 
    icon: 'fa-user-circle',
    color: '#6366f1'
  },
  { 
    name: 'Device Manager', 
    href: '/security/device-manager', 
    icon: 'fa-laptop',
    color: '#06b6d4'
  },
  { 
    name: 'OTP Verification', 
    href: '/security/otp', 
    icon: 'fa-shield-alt',
    color: '#0d9488'
  },
  { 
    name: 'Audit Center', 
    href: '/security/audit-center', 
    icon: 'fa-clipboard-list',
    color: '#f59e0b'
  },
  { 
    name: 'Account Recovery', 
    href: '/security/recovery', 
    icon: 'fa-life-ring',
    color: '#10b981'
  },
  { 
    name: 'Settings', 
    href: '/super-admin/settings', 
    icon: 'fa-cog',
    color: '#64748b'
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const isSuperAdmin = useIsSuperAdmin();
  const isDirector = useIsDirector();
  const router = useRouter();
  const pathname = usePathname();
  const userRoles = user?.roles || [];
  const institutionType = user?.institutionType || null;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: schoolData, error: schoolError, isLoading: schoolLoading } = useQuery({
    queryKey: ['school', user?.schoolId],
    queryFn: async () => {
      try {
        const res = await schoolApi.getProfile();
        return res.data?.data || res.data || null;
      } catch (err: any) {
        return null;
      }
    },
    retry: 2,
    staleTime: 5 * 60 * 1000,
    enabled: !isPureSuperAdmin && isAuthenticated && !!user?.schoolId,
  });

  const resolvedInstitutionType = institutionType || schoolData?.institutionType?.code || null;
  const isPureSuperAdmin = isSuperAdmin && !user?.schoolId;
  const navigation = isPureSuperAdmin ? superAdminNav : regularNav.filter(item => {
    if (item.institutionTypes && item.institutionTypes.length > 0) {
      if (!resolvedInstitutionType) return false;
      if (!item.institutionTypes.includes(resolvedInstitutionType)) return false;
    }
    if (item.typeRoles && resolvedInstitutionType) {
      const allowedRoles = item.typeRoles[resolvedInstitutionType];
      if (allowedRoles && allowedRoles.length > 0) {
        return allowedRoles.some(role => userRoles.includes(role));
      }
      return false;
    }
    if (item.roles) {
      return item.roles.some(role => userRoles.includes(role));
    }
    return true;
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isLoading && isSuperAdmin && !user?.schoolId && pathname === '/dashboard') {
      router.push('/super-admin');
    }
  }, [isLoading, isSuperAdmin, user, pathname, router]);

  const TYPE_ROUTE_MAP: Record<string, string> = {
    PRIMARY_SCHOOL: '/dashboard/primary',
    SECONDARY_SCHOOL: '/dashboard/secondary',
    ADVANCED_SECONDARY: '/dashboard/advanced-secondary',
    COLLEGE: '/dashboard/college',
    UNIVERSITY: '/dashboard/university',
  };

  const typeDashboardPath = resolvedInstitutionType
    ? TYPE_ROUTE_MAP[resolvedInstitutionType] || null
    : null;

  useEffect(() => {
    if (!isLoading && !isPureSuperAdmin && pathname === '/dashboard' && typeDashboardPath && typeDashboardPath !== '/dashboard') {
      router.push(typeDashboardPath);
    }
  }, [isLoading, isSuperAdmin, pathname, router, typeDashboardPath]);

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f5efe8'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <img src="/smart_tech_logo.png" alt="Smart Tech SaaS" style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover' }} />
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e8ddd0',
            borderTopColor: '#ea6645',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f5efe8'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <img src="/smart_tech_logo.png" alt="Smart Tech SaaS" style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover' }} />
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e8ddd0',
            borderTopColor: '#ea6645',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span style={{ color: '#666', fontSize: '14px' }}>Redirecting to login...</span>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5efe8' }}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .sidebar-link:hover .nav-icon {
          transform: scale(1.1);
        }
        .sidebar-link.active {
          background: linear-gradient(135deg, rgba(234,102,69,0.1), rgba(245,158,11,0.1)) !important;
          border-left: 3px solid #ea6645 !important;
        }
        .sidebar-link.active .nav-icon {
          color: #ea6645 !important;
        }
        .sidebar-link.active .nav-text {
          color: #ea6645 !important;
          font-weight: 600 !important;
        }
      `}</style>

      {/* Mobile Header */}
      <header style={{
        display: 'none',
        background: '#fdfaf7',
        borderBottom: '1px solid #e8ddd0',
        padding: '12px 16px',
        position: 'sticky',
        top: 0,
        zIndex: 40
      }}
      className="mobile-header"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/smart_tech_logo.png" alt="Smart Tech SaaS" style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover' }} />
            <span style={{ fontWeight: 600, color: '#1f2937' }}>
              {isPureSuperAdmin ? 'Super Admin' : 
                (schoolData?.name || 'School')
              }
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            <i className={`fa fa-${mobileMenuOpen ? 'times' : 'bars'}`} style={{ fontSize: '20px' }}></i>
          </button>
        </div>

        {mobileMenuOpen && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 100,
            backdropFilter: 'blur(4px)',
          }} onClick={() => setMobileMenuOpen(false)}>
          <nav style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '280px',
            background: '#fdfaf7',
            boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
            overflowY: 'auto',
            zIndex: 101,
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e8ddd0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, color: '#1f2937', fontSize: '16px' }}>Menu</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <i className="fa fa-times" style={{ fontSize: '14px', color: '#6b7280' }}></i>
              </button>
            </div>
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`sidebar-link ${pathname === item.href || (item.href !== '/super-admin' && pathname.startsWith(item.href)) ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  color: '#374151',
                  borderLeft: '3px solid transparent',
                  transition: 'all 0.2s'
                }}
              >
                <i className={`fa ${item.icon} nav-icon`} style={{ 
                  fontSize: '18px', 
                  width: '24px',
                  color: item.color,
                  transition: 'all 0.2s'
                }}></i>
                <span className="nav-text" style={{ fontSize: '14px' }}>{item.name}</span>
              </Link>
            ))}
            {/* Mobile User Profile & Logout */}
            <div style={{ borderTop: '1px solid #e8ddd0', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #ea6645, #f59e0b)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '14px',
                  flexShrink: 0
                }}>
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937', margin: 0, whiteSpace: 'nowrap' }}>
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0, whiteSpace: 'nowrap' }}>
                    {user?.roles?.[0] || 'User'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                  router.push('/login');
                }}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  fontSize: '13px',
                  color: '#ef4444',
                  background: '#fefcf9',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
              >
                <i className="fa fa-sign-out-alt"></i>
                <span>Sign Out</span>
              </button>
            </div>
          </nav>
          </div>
        )}
      </header>

      <div style={{ display: 'flex' }}>
        {/* Desktop Sidebar */}
        <aside style={{
          width: sidebarCollapsed ? '72px' : '260px',
          background: '#fdfaf7',
          borderRight: '1px solid #e8ddd0',
          position: 'fixed',
          height: '100vh',
          overflowY: 'auto',
          transition: 'width 0.3s ease',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column'
        }}
        className="desktop-sidebar"
        >
          {/* Logo Section */}
          <div style={{ 
            padding: sidebarCollapsed ? '20px 12px' : '20px 24px',
            borderBottom: '1px solid #e8ddd0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <img src="/smart_tech_logo.png" alt="Smart Tech SaaS" style={{ width: '42px', height: '42px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
            {!sidebarCollapsed && (
              <div style={{ overflow: 'hidden' }}>
                <h1 style={{ 
                  fontSize: '16px', 
                  fontWeight: '700', 
                  color: '#1f2937',
                  margin: 0,
                  whiteSpace: 'nowrap'
                }}>
                  Smart Tech SaaS
                </h1>
                <p style={{ 
                  fontSize: '11px', 
                  color: '#9ca3af',
                  margin: 0,
                  whiteSpace: 'nowrap'
                }}>
                  {isPureSuperAdmin ? 'Super Admin Portal' : (schoolData?.name || 'School Management')}
                </p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav style={{ 
            flex: 1, 
            padding: '16px 12px',
            overflowY: 'auto'
          }}>
            {!sidebarCollapsed && (
              <div style={{ 
                fontSize: '11px', 
                fontWeight: '600', 
                color: '#9ca3af',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                padding: '0 12px',
                marginBottom: '8px'
              }}>
                {isPureSuperAdmin ? 'Administration' : 'Management'}
              </div>
            )}
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`sidebar-link ${pathname === item.href || (item.href !== '/super-admin' && pathname.startsWith(item.href)) ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: sidebarCollapsed ? '12px' : '10px 12px',
                  marginBottom: '4px',
                  color: '#374151',
                  borderRadius: '8px',
                  borderLeft: '3px solid transparent',
                  transition: 'all 0.2s',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
                }}
              >
                <i className={`fa ${item.icon} nav-icon`} style={{ 
                  fontSize: '18px', 
                  width: '24px',
                  color: item.color,
                  transition: 'all 0.2s'
                }}></i>
                {!sidebarCollapsed && (
                  <span className="nav-text" style={{ 
                    fontSize: '14px',
                    fontWeight: pathname === item.href || (item.href !== '/super-admin' && pathname.startsWith(item.href)) ? 600 : 500,
                    color: pathname === item.href || (item.href !== '/super-admin' && pathname.startsWith(item.href)) ? item.color : '#374151',
                    transition: 'all 0.2s'
                  }}>
                    {item.name}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* Collapse Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              padding: '16px',
              background: 'none',
              border: 'none',
              borderTop: '1px solid #e8ddd0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: '12px',
              color: '#9ca3af',
              transition: 'all 0.2s'
            }}
          >
            <i className={`fa fa-chevron-${sidebarCollapsed ? 'right' : 'left'}`} style={{ fontSize: '14px' }}></i>
            {!sidebarCollapsed && (
              <span style={{ fontSize: '13px' }}>Collapse Menu</span>
            )}
          </button>

          {/* User Profile */}
          <div style={{ 
            padding: sidebarCollapsed ? '16px 12px' : '16px 20px',
            borderTop: '1px solid #e8ddd0',
            background: '#f5efe8'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              marginBottom: '12px',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #ea6645, #f59e0b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '600',
                fontSize: '14px',
                flexShrink: 0
              }}>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              {!sidebarCollapsed && (
                <div style={{ overflow: 'hidden' }}>
                  <p style={{ 
                    fontSize: '13px', 
                    fontWeight: '600', 
                    color: '#1f2937',
                    margin: 0,
                    whiteSpace: 'nowrap'
                  }}>
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p style={{ 
                    fontSize: '11px', 
                    color: '#9ca3af',
                    margin: 0,
                    whiteSpace: 'nowrap'
                  }}>
                    {user?.roles?.[0] || 'User'}
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              style={{
                width: sidebarCollapsed ? '100%' : 'auto',
                padding: sidebarCollapsed ? '10px' : '8px 16px',
                fontSize: '13px',
                color: '#ef4444',
                background: '#fefcf9',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                transition: 'all 0.2s'
              }}
            >
              <i className="fa fa-sign-out-alt"></i>
              {!sidebarCollapsed && <span>Sign Out</span>}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main style={{
          flex: 1,
          marginLeft: sidebarCollapsed ? '72px' : '260px',
          minHeight: '100vh',
          transition: 'margin-left 0.3s ease'
        }}
        className="main-content"
        >
          {/* Page Header */}
          <header style={{
            background: '#fdfaf7',
            borderBottom: '1px solid #e8ddd0',
            padding: '20px 32px',
            position: 'sticky',
            top: 0,
            zIndex: 30
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div>
                <h1 style={{ 
                  fontSize: '24px', 
                  fontWeight: '700', 
                  color: '#1f2937',
                  margin: 0
                }}>
                  {navigation.find(n => pathname === n.href || (n.href !== '/super-admin' && pathname.startsWith(n.href)))?.name || 'Dashboard'}
                </h1>
                <p style={{ 
                  fontSize: '13px', 
                  color: '#9ca3af',
                  margin: '4px 0 0'
                }}>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Link 
                  href="/" 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    color: '#6b7280',
                    background: '#fefcf9',
                    border: '1px solid #e8ddd0',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  <i className="fa fa-external-link-alt"></i>
                  Public View
                </Link>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <div className="page-content" style={{ padding: '32px' }}>
            {children}
          </div>
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar {
            display: none !important;
          }
          .mobile-header {
            display: block !important;
          }
          .main-content {
            margin-left: 0 !important;
          }
          .page-content {
            padding: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}
