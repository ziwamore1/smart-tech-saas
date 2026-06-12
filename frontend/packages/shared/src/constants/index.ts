export const APP_URL = 'https://app.smarttechsaas.com'
export const LANDING_URL = 'https://www.smarttechsaas.com'
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'
export const COMPANY_NAME = 'Smart Tech SaaS'
export const SUPPORT_EMAIL = 'support@smarttechsaas.com'

export const INSTITUTION_TYPES = {
  PRIMARY_SCHOOL: 'PRIMARY_SCHOOL',
  SECONDARY_SCHOOL: 'SECONDARY_SCHOOL',
  ADVANCED_SECONDARY: 'ADVANCED_SECONDARY',
  COLLEGE: 'COLLEGE',
  UNIVERSITY: 'UNIVERSITY',
} as const

export type InstitutionTypeCode = keyof typeof INSTITUTION_TYPES

export const INSTITUTION_TYPE_LABELS: Record<InstitutionTypeCode, string> = {
  PRIMARY_SCHOOL: 'Primary School',
  SECONDARY_SCHOOL: 'Secondary School',
  ADVANCED_SECONDARY: 'Advanced Secondary',
  COLLEGE: 'College',
  UNIVERSITY: 'University',
}

export const INSTITUTION_TYPE_ROLES: Record<InstitutionTypeCode, string[]> = {
  PRIMARY_SCHOOL: ['Head Teacher', 'Deputy Head', 'Primary Teacher', 'Parent', 'Learner'],
  SECONDARY_SCHOOL: ['Director', 'Deputy Director', 'HOD', 'Teacher', 'Class Teacher', 'Parent', 'Student'],
  ADVANCED_SECONDARY: ['Director', 'Deputy Director', 'HOD', 'Teacher', 'Class Teacher', 'Parent', 'Student'],
  COLLEGE: ['Principal', 'Registrar', 'Lecturer', 'Student'],
  UNIVERSITY: ['Vice Chancellor', 'Dean', 'Lecturer', 'Research Supervisor', 'Student'],
}

export const INSTITUTION_TYPE_FEATURES: Record<InstitutionTypeCode, {
  classStructure: string
  gradingSystem: string
  keyModules: string[]
}> = {
  PRIMARY_SCHOOL: {
    classStructure: 'Grade (1–7)',
    gradingSystem: 'Competency-based + ECZ Grade 7',
    keyModules: ['primary.curriculum', 'primary.reportCards', 'primary.analytics', 'primary.ece'],
  },
  SECONDARY_SCHOOL: {
    classStructure: 'Form (1–6)',
    gradingSystem: 'ECZ Form 5 + GCE',
    keyModules: ['secondary.timetable', 'secondary.exams', 'secondary.reports'],
  },
  ADVANCED_SECONDARY: {
    classStructure: 'Form (1–6)',
    gradingSystem: 'GCE Advanced Level',
    keyModules: ['advanced.timetable', 'advanced.exams', 'advanced.reports'],
  },
  COLLEGE: {
    classStructure: 'Year (1–4)',
    gradingSystem: 'Semester GPA',
    keyModules: ['college.courses', 'college.transcripts', 'college.enrollment'],
  },
  UNIVERSITY: {
    classStructure: 'Year (1–6)',
    gradingSystem: 'Semester GPA / CWA',
    keyModules: ['university.courses', 'university.transcripts', 'university.research'],
  },
}
