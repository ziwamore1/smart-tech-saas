export type UserRole =
  | 'SuperAdmin'
  | 'Director'
  | 'Deputy Director'
  | 'Head Teacher'
  | 'Deputy'
  | 'HOD'
  | 'Teacher'
  | 'Class Teacher'
  | 'Accountant'
  | 'Secretary'
  | 'Student'
  | 'Parent'
  | 'Principal'
  | 'Registrar'
  | 'Vice Chancellor'
  | 'Dean'
  | 'Lecturer'
  | 'Research Supervisor'
  | 'Primary Teacher'
  | 'Lower Primary Senior Teacher'
  | 'Upper Primary Senior Teacher'
  | 'Learner'

export type InstitutionType =
  | 'PRIMARY_SCHOOL'
  | 'SECONDARY_SCHOOL'
  | 'ADVANCED_SECONDARY'
  | 'COLLEGE'
  | 'UNIVERSITY'

export type SubscriptionTier = 'BASIC' | 'STANDARD' | 'PREMIUM'

export type FeatureCategory =
  | 'students'
  | 'teachers'
  | 'classes'
  | 'subjects'
  | 'timetable'
  | 'results'
  | 'fees'
  | 'communications'
  | 'analytics'
  | 'reports'
  | 'integrations'
  | 'advanced'
  | 'primary'
  | 'premium-staff-records'

export interface Feature {
  id: string
  key: string
  name: string
  description: string
  category: FeatureCategory
  minTier: SubscriptionTier
  isEnabled: boolean
  isLocked: boolean
  limits?: {
    basic?: number
    standard?: number
    premium?: number
  }
}

export interface SubscriptionPlan {
  id: string
  name: string
  tier: SubscriptionTier
  price: number
  currency: string
  interval: 'monthly' | 'yearly'
  features: string[]
  limits: {
    students: number
    teachers: number
    classes: number
    storage: number
  }
  isActive: boolean
}

export interface SchoolSubscription {
  id: string
  schoolId: string
  planId: string
  tier: SubscriptionTier
  status: 'active' | 'trial' | 'expired' | 'cancelled'
  startDate: string
  endDate: string
  trialEndsAt?: string
}

export interface FeatureAccess {
  featureKey: string
  hasAccess: boolean
  currentTier: SubscriptionTier
  requiredTier: SubscriptionTier
  upgradeRequired: boolean
}

export interface ApiResponse<T> {
  statusCode: number
  timestamp: string
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export const TIER_ORDER: Record<SubscriptionTier, number> = {
  BASIC: 1,
  STANDARD: 2,
  PREMIUM: 3,
}

export const TIER_COLORS: Record<SubscriptionTier, { bg: string; text: string; border: string }> = {
  BASIC: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  STANDARD: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  PREMIUM: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
}

export const DEFAULT_FEATURES: Feature[] = [
  {
    id: 'students-basic',
    key: 'students.view',
    name: 'View Students',
    description: 'View student list and details',
    category: 'students',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'students-add',
    key: 'students.add',
    name: 'Add Students',
    description: 'Add new students to the system',
    category: 'students',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'students-bulk',
    key: 'students.bulkImport',
    name: 'Bulk Import Students',
    description: 'Import students via Excel/CSV',
    category: 'students',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
    limits: { basic: 100, standard: 500, premium: -1 },
  },
  {
    id: 'students-advanced',
    key: 'students.advanced',
    name: 'Advanced Student Features',
    description: 'Health records, guardians management, attendance',
    category: 'students',
    minTier: 'STANDARD',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'teachers-basic',
    key: 'teachers.view',
    name: 'View Teachers',
    description: 'View teacher list and details',
    category: 'teachers',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'teachers-add',
    key: 'teachers.add',
    name: 'Add Teachers',
    description: 'Add new teachers to the system',
    category: 'teachers',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'teachers-bulk',
    key: 'teachers.bulkImport',
    name: 'Bulk Import Teachers',
    description: 'Import teachers via Excel/CSV',
    category: 'teachers',
    minTier: 'STANDARD',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'classes-basic',
    key: 'classes.view',
    name: 'View Classes',
    description: 'View class list and details',
    category: 'classes',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'classes-add',
    key: 'classes.add',
    name: 'Add Classes',
    description: 'Create new classes',
    category: 'classes',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
    limits: { basic: 10, standard: 30, premium: -1 },
  },
  {
    id: 'subjects-basic',
    key: 'subjects.view',
    name: 'View Subjects',
    description: 'View subject list',
    category: 'subjects',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'subjects-add',
    key: 'subjects.add',
    name: 'Add Subjects',
    description: 'Create new subjects',
    category: 'subjects',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
    limits: { basic: 10, standard: 25, premium: -1 },
  },
  {
    id: 'timetable-basic',
    key: 'timetable.view',
    name: 'View Timetable',
    description: 'View master and class timetables',
    category: 'timetable',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'timetable-edit',
    key: 'timetable.edit',
    name: 'Edit Timetable',
    description: 'Manually edit and adjust timetable',
    category: 'timetable',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'timetable-generate',
    key: 'timetable.generate',
    name: 'AI Timetable Generator',
    description: 'Auto-generate timetables using AI',
    category: 'timetable',
    minTier: 'STANDARD',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'timetable-constraints',
    key: 'timetable.constraints',
    name: 'Timetable Constraints',
    description: 'Set custom constraints for scheduling',
    category: 'timetable',
    minTier: 'PREMIUM',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'results-basic',
    key: 'results.view',
    name: 'View Results',
    description: 'View student results',
    category: 'results',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'results-add',
    key: 'results.add',
    name: 'Add Results',
    description: 'Enter and manage student results',
    category: 'results',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'results-bulk',
    key: 'results.bulkImport',
    name: 'Bulk Import Results',
    description: 'Import results via Excel',
    category: 'results',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'results-reports',
    key: 'results.reports',
    name: 'Result Reports',
    description: 'Generate comprehensive result reports',
    category: 'results',
    minTier: 'STANDARD',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'fees-basic',
    key: 'fees.view',
    name: 'View Fees',
    description: 'View fee structure and payments',
    category: 'fees',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'fees-manage',
    key: 'fees.manage',
    name: 'Manage Fees',
    description: 'Create and modify fee structures',
    category: 'fees',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'fees-online',
    key: 'fees.onlinePayment',
    name: 'Online Payment',
    description: 'Enable online fee payment gateway',
    category: 'fees',
    minTier: 'STANDARD',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'communications-basic',
    key: 'communications.view',
    name: 'View Communications',
    description: 'View messages and notifications',
    category: 'communications',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'communications-send',
    key: 'communications.send',
    name: 'Send Messages',
    description: 'Send messages to parents and teachers',
    category: 'communications',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'communications-bulk',
    key: 'communications.bulk',
    name: 'Bulk Messaging',
    description: 'Send bulk SMS and emails',
    category: 'communications',
    minTier: 'STANDARD',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'communications-whatsapp',
    key: 'communications.whatsapp',
    name: 'WhatsApp Integration',
    description: 'Send messages via WhatsApp',
    category: 'communications',
    minTier: 'PREMIUM',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'analytics-basic',
    key: 'analytics.view',
    name: 'View Analytics',
    description: 'View basic analytics dashboards',
    category: 'analytics',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'analytics-advanced',
    key: 'analytics.advanced',
    name: 'Advanced Analytics',
    description: 'Predictive analytics and insights',
    category: 'analytics',
    minTier: 'STANDARD',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'analytics-ai',
    key: 'analytics.ai',
    name: 'AI-Powered Insights',
    description: 'AI-generated recommendations and predictions',
    category: 'analytics',
    minTier: 'PREMIUM',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'reports-basic',
    key: 'reports.generate',
    name: 'Generate Reports',
    description: 'Generate standard system reports',
    category: 'reports',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'reports-custom',
    key: 'reports.custom',
    name: 'Custom Reports',
    description: 'Create and customize reports',
    category: 'reports',
    minTier: 'STANDARD',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'reports-export',
    key: 'reports.export',
    name: 'Export Reports',
    description: 'Export reports in various formats',
    category: 'reports',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'integrations-api',
    key: 'integrations.api',
    name: 'API Access',
    description: 'Access to REST API for integrations',
    category: 'integrations',
    minTier: 'STANDARD',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'integrations-webhooks',
    key: 'integrations.webhooks',
    name: 'Webhooks',
    description: 'Configure webhook notifications',
    category: 'integrations',
    minTier: 'PREMIUM',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'advanced-backup',
    key: 'advanced.backup',
    name: 'Data Backup',
    description: 'Automated data backup',
    category: 'advanced',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'advanced-restore',
    key: 'advanced.restore',
    name: 'Data Restore',
    description: 'Restore from backup',
    category: 'advanced',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'advanced-multiuser',
    key: 'advanced.multiuser',
    name: 'Multi-user Access',
    description: 'Multiple admin user accounts',
    category: 'advanced',
    minTier: 'STANDARD',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'advanced-sso',
    key: 'advanced.sso',
    name: 'Single Sign-On (SSO)',
    description: 'SSO integration with external systems',
    category: 'advanced',
    minTier: 'PREMIUM',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'primary-dashboard',
    key: 'primary.dashboard',
    name: 'Primary Dashboard',
    description: 'View primary school dashboard overview',
    category: 'primary',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'primary-students',
    key: 'primary.students',
    name: 'Primary Pupils',
    description: 'Manage pupil records and admissions',
    category: 'primary',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'primary-classes',
    key: 'primary.classes',
    name: 'Primary Classes',
    description: 'View and manage primary class rosters',
    category: 'primary',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'primary-attendance',
    key: 'primary.attendance',
    name: 'Primary Attendance',
    description: 'Mark and track daily pupil attendance',
    category: 'primary',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'primary-results',
    key: 'primary.results',
    name: 'Primary Results',
    description: 'Enter continuous assessment scores',
    category: 'primary',
    minTier: 'BASIC',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'primary-staff',
    key: 'primary.staff',
    name: 'Primary Staff',
    description: 'Manage teaching and non-teaching staff',
    category: 'primary',
    minTier: 'STANDARD',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'primary-parents',
    key: 'primary.parents',
    name: 'Parent Portal',
    description: 'Parent registration, linking, and communication',
    category: 'primary',
    minTier: 'STANDARD',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'primary-reportCards',
    key: 'primary.reportCards',
    name: 'Curriculum Report Cards',
    description: 'Generate curriculum-based report cards with division badges',
    category: 'primary',
    minTier: 'STANDARD',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'primary-curriculum',
    key: 'primary.curriculum',
    name: 'Curriculum Config',
    description: 'Configure scoring rules, best-subject selection, and performance categories',
    category: 'primary',
    minTier: 'STANDARD',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'primary-analytics',
    key: 'primary.analytics',
    name: 'Primary Analytics',
    description: 'Enrollment pipeline, attendance trends, and class performance',
    category: 'primary',
    minTier: 'STANDARD',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'primary-ece',
    key: 'primary.ece',
    name: 'ECE Module',
    description: 'Early Childhood Education specific assessments and tracking',
    category: 'primary',
    minTier: 'STANDARD',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'primary-grade7',
    key: 'primary.grade7',
    name: 'Grade 7 ECZ Management',
    description: 'ECZ exam registration, raw score conversion, and division computation',
    category: 'primary',
    minTier: 'PREMIUM',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'primary-benchmarking',
    key: 'primary.benchmarking',
    name: 'Primary Benchmarking',
    description: 'Compare performance against national primary averages',
    category: 'primary',
    minTier: 'PREMIUM',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'primary-aiReports',
    key: 'primary.aiReports',
    name: 'AI Report Comments',
    description: 'AI-generated personalized report card comments',
    category: 'primary',
    minTier: 'PREMIUM',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'premium-staff-returns-hub',
    key: 'PREMIUM_STAFF_RETURNS_HUB',
    name: 'Staff Returns & HR Intelligence Hub',
    description: 'Premium enterprise HR intelligence with staff returns, transfers, district reporting, and workforce analytics',
    category: 'premium-staff-records',
    minTier: 'PREMIUM',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'premium-staff-returns',
    key: 'premium.staff.returns',
    name: 'Staff Returns',
    description: 'Generate and manage district, provincial, and ministry staff returns',
    category: 'premium-staff-records',
    minTier: 'PREMIUM',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'premium-staff-transfers',
    key: 'premium.staff.transfers',
    name: 'Staff Transfers',
    description: 'Inter-school, district, and province staff transfer management',
    category: 'premium-staff-records',
    minTier: 'PREMIUM',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'premium-staff-analytics',
    key: 'premium.staff.analytics',
    name: 'Staff Workforce Analytics',
    description: 'Advanced HR intelligence, grade level analysis, and workforce planning',
    category: 'premium-staff-records',
    minTier: 'PREMIUM',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'premium-staff-exports',
    key: 'premium.staff.exports',
    name: 'Advanced Staff Exports',
    description: 'Dynamic Excel and PDF exports with district template support',
    category: 'premium-staff-records',
    minTier: 'PREMIUM',
    isEnabled: true,
    isLocked: false,
  },
  {
    id: 'premium-staff-district-reports',
    key: 'premium.staff.district-reports',
    name: 'District Staff Reporting',
    description: 'District-level consolidated staff reporting and returns aggregation',
    category: 'premium-staff-records',
    minTier: 'PREMIUM',
    isEnabled: true,
    isLocked: false,
  },
]

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan-basic',
    name: 'Basic',
    tier: 'BASIC',
    price: 29,
    currency: 'USD',
    interval: 'monthly',
    features: [
      'students.view',
      'students.add',
      'teachers.view',
      'teachers.add',
      'classes.view',
      'classes.add',
      'subjects.view',
      'subjects.add',
      'timetable.view',
      'timetable.edit',
      'results.view',
      'results.add',
      'results.bulkImport',
      'fees.view',
      'fees.manage',
      'communications.view',
      'communications.send',
      'analytics.view',
      'reports.generate',
      'reports.export',
      'advanced.backup',
      'advanced.restore',
    ],
    limits: {
      students: 100,
      teachers: 20,
      classes: 10,
      storage: 5,
    },
    isActive: true,
  },
  {
    id: 'plan-standard',
    name: 'Standard',
    tier: 'STANDARD',
    price: 79,
    currency: 'USD',
    interval: 'monthly',
    features: [
      'students.view',
      'students.add',
      'students.bulkImport',
      'students.advanced',
      'teachers.view',
      'teachers.add',
      'teachers.bulkImport',
      'classes.view',
      'classes.add',
      'subjects.view',
      'subjects.add',
      'timetable.view',
      'timetable.edit',
      'timetable.generate',
      'results.view',
      'results.add',
      'results.bulkImport',
      'results.reports',
      'fees.view',
      'fees.manage',
      'fees.onlinePayment',
      'communications.view',
      'communications.send',
      'communications.bulk',
      'analytics.view',
      'analytics.advanced',
      'reports.generate',
      'reports.custom',
      'reports.export',
      'integrations.api',
      'advanced.backup',
      'advanced.restore',
      'advanced.multiuser',
    ],
    limits: {
      students: 500,
      teachers: 100,
      classes: 30,
      storage: 50,
    },
    isActive: true,
  },
  {
    id: 'plan-premium',
    name: 'Premium',
    tier: 'PREMIUM',
    price: 149,
    currency: 'USD',
    interval: 'monthly',
    features: [
      'students.view',
      'students.add',
      'students.bulkImport',
      'students.advanced',
      'teachers.view',
      'teachers.add',
      'teachers.bulkImport',
      'classes.view',
      'classes.add',
      'subjects.view',
      'subjects.add',
      'timetable.view',
      'timetable.edit',
      'timetable.generate',
      'timetable.constraints',
      'results.view',
      'results.add',
      'results.bulkImport',
      'results.reports',
      'fees.view',
      'fees.manage',
      'fees.onlinePayment',
      'communications.view',
      'communications.send',
      'communications.bulk',
      'communications.whatsapp',
      'analytics.view',
      'analytics.advanced',
      'analytics.ai',
      'reports.generate',
      'reports.custom',
      'reports.export',
      'integrations.api',
      'integrations.webhooks',
      'advanced.backup',
      'advanced.restore',
      'advanced.multiuser',
      'advanced.sso',
    ],
    limits: {
      students: -1,
      teachers: -1,
      classes: -1,
      storage: 500,
    },
    isActive: true,
  },
]
