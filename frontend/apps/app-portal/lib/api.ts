import axios from 'axios';

let API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
if (!API_BASE_URL.endsWith('/api/v1') && !API_BASE_URL.endsWith('/api/v1/')) {
  API_BASE_URL = API_BASE_URL.replace(/\/+$/, '') + '/api/v1';
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log(`[API Request] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {
          headers: config.headers,
          data: config.data
        });
      } else {
        console.log(`[API Request] ${config.method?.toUpperCase()} ${config.baseURL}${config.url} - NO TOKEN`);
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    if (response.data?.statusCode && response.data?.timestamp) {
      response.data = response.data.data ?? response.data;
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const url = error.config?.url || '';
      const isAuthEndpoint = url.startsWith('/auth/');
      const alreadyOnLogin = window.location.pathname === '/login';
      const hadToken = !!error.config?.headers?.Authorization;
      if (!isAuthEndpoint && !alreadyOnLogin && hadToken) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    if (error.config) {
      const silentUrls = [
        '/substitutions', 
        '/notifications', 
        '/my-timetable',
        '/student/timetable',
        '/teacher', 
        '/school/stats',
        '/subscription/status',
        '/timetable/job/',
        '/school/profile',
        '/school/current',
        '/term/current',
        '/classrooms',
        '/school',
        '/rooms',
        '/auth/',
        '/public/',
        '/feature-locks',
      ];
      const isSilent = silentUrls.some(url => error.config.url?.includes(url));
      if (!isSilent) {
        console.error(`API Error: ${error.config.method?.toUpperCase()} ${error.config.baseURL}${error.config.url}`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          responseData: error.response?.data,
        });
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (identifier: string, password: string, schoolId?: string) =>
    api.post('/auth/login', { identifier, password, ...(schoolId ? { schoolId } : {}) }),
  
  superAdminLogin: (email: string, password: string) =>
    api.post('/auth/super-admin/login', { email, password }),

  getMe: () => api.get('/auth/me'),

  registerSchool: (data: {
    schoolName: string;
    directorFirstName: string;
    directorLastName: string;
    email: string;
    password: string;
    institutionType?: string;
  }) => api.post('/auth/register-school', data),

  getInstitutionTypes: () => api.get('/auth/institution-types'),

  registerInstitution: (data: {
    institutionName: string;
    institutionType: string;
    directorFirstName: string;
    directorLastName: string;
    email: string;
    password: string;
    phone?: string;
    address?: string;
  }) => api.post('/auth/register-institution', data),

  registerSuperAdmin: (data: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }) => api.post('/auth/register-super-admin', data),

  registerTeacher: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    schoolId: string;
  }) => api.post('/auth/register-teacher', data),

  createSchool: (data: {
    schoolName: string;
    address?: string;
    email?: string;
    phone?: string;
  }) => api.post('/auth/school', data),

  createDirector: (data: {
    fullName: string;
    email?: string;
    phone: string;
    schoolId: string;
  }) => api.post('/auth/director', data),

  switchIdentity: (schoolId: string) =>
    api.post('/auth/switch-identity', { schoolId }),

  getLinkedIdentities: () => api.get('/auth/linked-identities'),

  createTeacher: (data: {
    fullName: string;
    phone: string;
    email?: string;
    classId?: string;
    subjectId?: string;
  }) => api.post('/auth/teacher', data),

  forgotPassword: (identifier: string) =>
    api.post('/auth/forgot-password', { identifier }),

  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword }),
};

export const schoolApi = {
  getProfile: (schoolId?: string) => api.get('/school/profile', { 
    params: schoolId ? { schoolId } : {} 
  }),
  getCurrentSchool: () => api.get('/school/current'),
  getAll: () => api.get('/school'),
  getById: (id: string) => api.get(`/school/${id}`),
  updateProfile: (data: any) => api.patch('/school/profile', data),
  updateBranding: (data: any) => api.patch('/school/branding', data),
  getStats: () => api.get('/school/stats'),
  getTimeSettings: () => api.get('/school/time-settings'),
  updateTimeSettings: (data: {
    startTime?: string;
    periodDuration?: number;
    periodsPerDay?: number;
    daysPerWeek?: number;
    breakAfterPeriod?: number;
    breakDuration?: number;
    breaks?: Array<{ afterPeriod: number; duration: number; name?: string }>;
    periodDurations?: number[];
  }) => api.patch('/school/time-settings', data),
  updateGradingSystem: (gradingSystem: string) => api.patch('/school/grading-system', { gradingSystem }),
};

export const classroomApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get('/classrooms', { params }),
  getById: (id: string) => api.get(`/classrooms/${id}`),
  create: (data: { name: string; capacity?: number; schoolId: string }) => 
    api.post('/classrooms', data),
  update: (id: string, data: any) => api.patch(`/classrooms/${id}`, data),
  delete: (id: string) => api.delete(`/classrooms/${id}`),
};

export const timetableApi = {
  getCurrentTerm: () => api.get('/timetable/current-term'),
  
  getMyTimetable: (termId?: string) => 
    api.get('/timetable/my-timetable', { params: { termId } }),
  
  getStudentTimetable: (termId?: string) => 
    api.get('/timetable/student/timetable', { params: { termId } }),
  
  getChildrenTimetables: (termId?: string) => 
    api.get('/timetable/parent/children-timetable', { params: { termId } }),
  
  getChildTimetable: (studentId: string, termId?: string) => 
    api.get(`/timetable/parent/child/${studentId}`, { params: { termId } }),
  
  getClassTimetable: (classId: string, termId: string) => 
    api.get('/timetable/class', { params: { classId, termId } }),
  
  publishTimetable: (timetableId: string) => 
    api.post(`/timetable/${timetableId}/publish`),
  
  getClassesWithTimetables: (termId: string) => 
    api.get('/timetable/class/list', { params: { termId } }),
  
  getTeacherTimetable: (teacherId: string, termId: string) => 
    api.get('/timetable/teacher', { params: { teacherId, termId } }),
  
  getTeachersWithTimetables: (termId: string) => 
    api.get('/timetable/teacher/list', { params: { termId } }),
  
  getRooms: () => api.get('/timetable/room/list'),
  
  getRoomTimetable: (roomId: string, termId: string) => 
    api.get('/timetable/room', { params: { roomId, termId } }),
  
  getLessonRequirements: (classId: string) => 
    api.get('/timetable/lesson-requirements', { params: { classId } }),
  
  getAllLessonRequirements: () => 
    api.get('/timetable/lesson-requirements/all').catch(() => ({ data: [] })),
  
  createLessonRequirement: (data: {
    classId: string;
    subjectId: string;
    teacherId: string;
    lessonsPerWeek: number;
    lessonType?: string;
  }) => api.post('/timetable/lesson-requirement', data),
  
  deleteLessonRequirement: (id: string) => 
    api.delete(`/timetable/lesson-requirement/${id}`),
  
  deleteLessonRequirementsByClass: (classId: string) =>
    api.delete(`/timetable/lesson-requirements/class/${classId}`),
  
  generateTimetable: (classId: string, termId: string, teacherConstraints?: Record<string, any>) => 
    api.post(`/timetable/generate/${classId}`, { termId, teacherConstraints }),
  
  generateTimetableAI: (classId: string, termId: string) => 
    api.post(`/timetable/generate-ai/${classId}`, { termId }),
  
  generateAllClasses: (termId: string) =>
    api.post('/timetable/generate/queue/all-classes', { termId }),
  
  generateSelectedClasses: (termId: string, classIds: string[]) =>
    api.post('/timetable/generate/queue/classes', { termId, classIds }),
  
  getJobStatus: (jobId: string) => api.get(`/timetable/job/${jobId}/status`),
  
  getSchoolJobStatus: () => api.get('/timetable/job/status/list'),
  
  moveSlot: (slotId: string, day: number, period: number) => 
    api.post(`/timetable/moveSlot/${slotId}`, { day, period }),
  
  swapSlot: (sourceSlotId: string, targetDay: number, targetPeriod: number) => 
    api.post(`/timetable/swapSlot/${sourceSlotId}`, { sourceSlotId, targetDay, targetPeriod }),
  
  previewMove: (slotId: string, targetDay: number, targetPeriod: number) => 
    api.post('/timetable/previewMove', { slotId, targetDay, targetPeriod }),
  
  createSnapshot: (timetableId: string) => 
    api.post(`/timetable/snapshot/${timetableId}`),
  
  getVersions: (timetableId: string) => 
    api.get(`/timetable/versions/${timetableId}`),
  
  restoreVersion: (versionId: string) => 
    api.post(`/timetable/restoreVersion/${versionId}`),
  
  deleteTimetable: (timetableId: string) => 
    api.delete(`/timetable/${timetableId}`),

  getSubstitutions: (params: { 
    termId: string; 
    classId?: string; 
    teacherId?: string; 
    roomId?: string;
    startDate?: string;
    endDate?: string;
  }) => api.get('/timetable/substitutions', { params }),
  
  createSubstitution: (data: {
    originalSlotId: string;
    date: string;
    newTeacherId?: string;
    newRoomId?: string;
    newSubjectId?: string;
    reason: string;
    isCancelled?: boolean;
  }) => api.post('/timetable/substitution', data),
  
  updateSubstitution: (id: string, data: any) => 
    api.patch(`/timetable/substitution/${id}`, data),
  
  deleteSubstitution: (id: string) => 
    api.delete(`/timetable/substitution/${id}`),
  
  getWeekRotation: (classId: string, termId: string) => 
    api.get('/timetable/week-rotation', { params: { classId, termId } }),
  
  setWeekRotation: (classId: string, termId: string, weekType: 'A' | 'B' | 'regular') => 
    api.post('/timetable/week-rotation', { classId, termId, weekType }),
  
  getTeacherAbsences: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/timetable/teacher-absences', { params }),
  
  createTeacherAbsence: (data: {
    teacherId: string;
    startDate: string;
    endDate: string;
    reason: string;
  }) => api.post('/timetable/teacher-absence', data),
  
  getRealTimeUpdates: () => api.get('/timetable/realtime/status'),
};

export const subscriptionApi = {
  getPlans: () => api.get('/subscription/plans'),
  
  getPlan: (planId: string) => api.get(`/subscription/plans/${planId}`),
  
  createPlan: (data: {
    name: string;
    tier: string;
    price: number;
    currency: string;
    interval: string;
    features: string[];
    limits: { students: number; teachers: number; classes: number; storage: number };
  }) => api.post('/subscription/plans', data),
  
  updatePlan: (planId: string, data: any) => 
    api.patch(`/subscription/plans/${planId}`, data),
  
  deletePlan: (planId: string) => 
    api.delete(`/subscription/plans/${planId}`),
  
  getMySubscription: () => api.get('/subscription/my-subscription'),
  
  checkStatus: () => api.get('/subscription/status'),
  
  createPayment: (data: {
    planId: string;
    paymentMethod: 'card' | 'mobilemoney';
    phone?: string;
    network?: 'MTN' | 'AIRTEL' | 'ZAMTEL';
  }) => api.post('/subscription/create-payment', data),
  
  cancelSubscription: () => api.post('/subscription/cancel'),
  
  changePlan: (planId: string) => api.post('/subscription/change-plan', { planId }),
  
  getReceipts: () => api.get('/subscription/receipts'),
  
  getReceipt: (id: string) => api.get(`/subscription/receipt/${id}`),
};

export const studentApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; classId?: string }) =>
    api.get('/student', { params }),
  getById: (id: string) => api.get(`/student/${id}`),
  getMyProfile: () => api.get('/student/me'),
  getByParent: (parentId: string) => api.get(`/student/parent/${parentId}`),
  create: (data: any) => api.post('/student', data),
  update: (id: string, data: any) => api.patch(`/student/${id}`, data),
  delete: (id: string) => api.delete(`/student/${id}`, { timeout: 120000 }),
  changeStatus: (id: string, status: string) =>
    api.post(`/student/${id}/status`, { status }),
  getStatusHistory: (id: string) => api.get(`/student/${id}/status-history`),
  importExcel: (formData: FormData) =>
    api.post('/student/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

export const teacherApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; schoolId?: string }) =>
    api.get('/teacher', { params }),
  getById: (id: string) => api.get(`/teacher/${id}`),
  getClasses: () => api.get('/teacher/classes'),
  create: (data: any) => api.post('/teacher', data),
  update: (id: string, data: any) => api.put(`/teacher/${id}`, data),
  delete: (id: string) => api.delete(`/teacher/${id}`),
};

export const teachingAssignmentApi = {
  getAll: () => api.get('/teaching-assignment'),
  getByTeacher: (teacherId: string) => api.get(`/teaching-assignment/teacher/${teacherId}`),
  create: (data: { teacherId: string; subjectId: string; classId: string; academicYearId: string }) =>
    api.post('/teaching-assignment', data),
  delete: (id: string) => api.delete(`/teaching-assignment/${id}`),
};

export const classApi = {
  getAll: () => api.get('/class'),
  getById: (id: string) => api.get(`/class/${id}`),
  create: (data: any) => api.post('/class', data),
  update: (id: string, data: any) => api.patch(`/class/${id}`, data),
  delete: (id: string) => api.delete(`/class/${id}`),
  setClassTeacher: (id: string, teacherId: string | null) => api.patch(`/class/${id}/class-teacher`, { teacherId }),
};

export const subjectApi = {
  getAll: () => api.get('/subject'),
  getById: (id: string) => api.get(`/subject/${id}`),
  create: (data: any) => api.post('/subject', data),
  update: (id: string, data: any) => api.patch(`/subject/${id}`, data),
  delete: (id: string) => api.delete(`/subject/${id}`),
};

export const classSubjectApi = {
  getAll: () => api.get('/class-subjects'),
  getByClass: (classId: string, termId?: string) => api.get(`/class-subjects/class/${classId}${termId ? `?termId=${termId}` : ''}`),
  getBySubject: (subjectId: string) => api.get(`/class-subjects/subject/${subjectId}`),
  add: (data: { classId: string; subjectId: string }) => api.post('/class-subjects', data),
  remove: (classId: string, subjectId: string) => api.delete(`/class-subjects/${classId}/${subjectId}`),
};

export const studentSubjectApi = {
  getByStudent: (studentId: string) => api.get(`/student-subjects/student/${studentId}`),
  getByClass: (classId: string) => api.get(`/student-subjects/class/${classId}`),
  getMissing: (classId: string) => api.get(`/student-subjects/class/${classId}/missing`),
  assign: (data: { studentId: string; subjectIds: string[]; classId: string; academicYearId?: string }) =>
    api.post('/student-subjects/assign', data),
  bulkAssign: (data: { classId: string; assignments: Array<{ studentId: string; subjectIds: string[] }>; academicYearId?: string }) =>
    api.post('/student-subjects/bulk-assign', data),
  unassign: (studentId: string, subjectId: string, classId: string) =>
    api.delete(`/student-subjects?studentId=${studentId}&subjectId=${subjectId}&classId=${classId}`),
};

export const termApi = {
  getAll: () => api.get('/term'),
  getByYear: (academicYearId: string) => api.get(`/term/${academicYearId}`),
  getCurrent: () => api.get('/term/current'),
  create: (data: { name: string; startDate: string; endDate: string; academicYearId: string }) => api.post('/term', data),
  update: (id: string, data: any) => api.patch(`/term/${id}`, data),
  setCurrent: (id: string) => api.patch(`/term/${id}/set-current`),
  unfinalize: (id: string) => api.patch(`/term/${id}/unfinalize`),
  delete: (id: string) => api.delete(`/term/${id}`),
};

export const academicYearApi = {
  getAll: () => api.get('/academic-year'),
  create: (data: { name: string; startDate: string; endDate: string }) => api.post('/academic-year', data),
  update: (id: string, data: { name?: string; startDate?: string; endDate?: string }) => api.patch(`/academic-year/${id}`, data),
  setCurrent: (id: string) => api.patch(`/academic-year/${id}/current`),
  delete: (id: string) => api.delete(`/academic-year/${id}`),
};

export const resultApi = {
  getAll: (params?: { classId?: string; termId?: string; subjectId?: string }) =>
    api.get('/results', { params }),
  getById: (id: string) => api.get(`/results/${id}`),
  getByClass: (classId: string, termId: string) =>
    api.get('/results', { params: { classId, termId } }),
  getComputedByClass: (classId: string, termId: string) =>
    api.get('/results/computed', { params: { classId, termId } }),
  getByStudent: (studentId: string, termId: string) =>
    api.get(`/results/student/${studentId}`, { params: { termId } }),
  create: (data: { studentId: string; subjectId: string; termId: string; score: number }) =>
    api.post('/results', data),
  createBulk: (results: Array<{ studentId: string; subjectId: string; termId: string; score: number }>) =>
    api.post('/results/bulk', { results }),
  update: (id: string, score: number) => api.patch(`/results/${id}`, { score }),
  delete: (id: string) => api.delete(`/results/${id}`),
  uploadExcel: (termId: string, formData: FormData) =>
    api.post(`/results/upload/${termId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getTemplate: (termId: string, params?: { classId?: string }) =>
    api.get(`/results/template/${termId}`, { params, responseType: 'blob' }),
  recalculateGrades: (classId: string, termId: string) =>
    api.post('/results/recalculate-grades', { classId, termId }),
  recalculatePoints: (classId: string, termId: string) =>
    api.post('/results/recalculate-points', { classId, termId }),
};

export const assessmentApi = {
  getTypes: (params?: { subjectId?: string; termId?: string }) =>
    api.get('/assessment/types', { params }),
  getWeights: (subjectId: string, termId: string) =>
    api.get('/assessment/weights', { params: { subjectId, termId } }),
  getStudentAssessments: (studentId: string, termId: string) =>
    api.get('/assessment/student', { params: { studentId, termId } }),
  getClassDashboard: (classId: string, subjectId: string, termId: string) =>
    api.get('/assessment/class-dashboard', { params: { classId, subjectId, termId } }),
  createType: (data: { subjectId: string; termId: string; name: string; maxScore: number; weight: number }) =>
    api.post('/assessment/create-type', data),
  createBulkTypes: (data: { subjectId: string; termId: string; types: Array<{ name: string; maxScore: number; weight: number }> }) =>
    api.post('/assessment/bulk-create', data),
  updateType: (id: string, data: { name?: string; maxScore?: number; weight?: number }) =>
    api.patch(`/assessment/type/${id}`, data),
  deleteType: (id: string) => api.delete(`/assessment/type/${id}`),
  enterScore: (data: { studentId: string; assessmentTypeId: string; score: number }) =>
    api.post('/assessment/enter-score', data),
  enterBulkScores: (scores: Array<{ studentId: string; assessmentTypeId: string; score: number }>) =>
    api.post('/assessment/bulk-enter-scores', { scores }),
  updateScore: (id: string, score: number) => api.patch(`/assessment/score/${id}`, { score }),
  computeResult: (studentId: string, subjectId: string, termId: string) =>
    api.get('/assessment/compute', { params: { studentId, subjectId, termId } }),
  computeAllClass: (classId: string, subjectId: string, termId: string) =>
    api.post('/assessment/compute-all', { classId, subjectId, termId }),
};

export const publishingApi = {
  publish: (classId: string, termId: string) =>
    api.post('/publishing/publish-results', { classId, termId }, { timeout: 300000 }),
  unpublish: (classId: string, termId: string) =>
    api.post('/publishing/unpublish-results', { classId, termId }, { timeout: 120000 }),
  publishAll: (termId: string) =>
    api.post('/publishing/publish-all', { termId }, { timeout: 300000 }),
  getStatus: () => api.get('/publishing/status'),
  getTermLockStatus: (termId: string) => api.get(`/publishing/status/${termId}`),
  checkCompleteness: (classId: string, termId: string) =>
    api.get('/publishing/check-completeness', { params: { classId, termId } }),
  getResultsSummary: (classId: string, termId: string) =>
    api.get('/publishing/results-summary', { params: { classId, termId } }),
  downloadZip: (classId: string, termId: string) =>
    api.get('/publishing/download-zip', { params: { classId, termId }, responseType: 'blob' }),
  getClassSummaryPdf: (classId: string, termId: string) =>
    api.get('/publishing/class-summary-pdf', { params: { classId, termId }, responseType: 'blob' }),
};

export const dashboardConfigApi = {
  get: () => api.get('/dashboard-config'),
  update: (data: any) => api.put('/dashboard-config', data),
  updateWidgets: (widgets: any[]) => api.put('/dashboard-config/widgets', { widgets }),
};

export const superAdminApi = {
  getSchools: (status?: string) => 
    api.get('/super-admin/schools', { params: status ? { status } : undefined }),
  
  getSchool: (id: string) => 
    api.get(`/super-admin/schools/${id}`),
  
  createSchool: (data: {
    name: string;
    registrationNumber?: string;
    phone?: string;
    email?: string;
    address?: string;
    website?: string;
    motto?: string;
    subscriptionTier?: string;
    subscriptionStatus?: string;
  }) => api.post('/super-admin/schools', data),
  
  updateSchool: (id: string, data: any) => 
    api.patch(`/super-admin/schools/${id}`, data),
  
  deleteSchool: (id: string) => 
    api.delete(`/super-admin/schools/${id}`),
  
  activateSchool: (id: string) => 
    api.post(`/super-admin/schools/${id}/activate`),
  
  deactivateSchool: (id: string) => 
    api.post(`/super-admin/schools/${id}/deactivate`),
  
  updateSubscription: (id: string, data: { subscriptionStatus?: string; trialEndsAt?: Date }) => 
    api.put(`/super-admin/schools/${id}/subscription`, data),
  
  createDirector: (schoolId: string, data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => api.post(`/super-admin/schools/${schoolId}/directors`, data),
  
  getDirectors: (schoolId: string) => 
    api.get(`/super-admin/schools/${schoolId}/directors`),
  
  sendSchoolLink: (schoolId: string, directorId: string, method: 'email' | 'whatsapp' | 'both') => 
    api.post(`/super-admin/schools/${schoolId}/directors/${directorId}/send-link`, { method }),
  
  getStats: () => api.get('/super-admin/stats'),
  
  getResultsAnalytics: () => api.get('/super-admin/results-analytics'),
  
  getAuditLogs: (params?: { schoolId?: string; limit?: number }) => 
    api.get('/super-admin/audit-logs', { params }),
  
  getAllSettings: () => api.get('/super-admin/settings'),
  
  getSetting: (key: string) => api.get(`/super-admin/settings/${key}`),
  
  updateSetting: (key: string, value: any, isPublic?: boolean) => 
    api.put('/super-admin/settings', { key, value, isPublic }),
  
  enrollSelfAsStaff: (schoolId: string, role: string) =>
    api.post('/super-admin/enroll-self-as-staff', { schoolId, role }),
};

export const featureLockApi = {
  getFeatures: () => api.get('/feature-locks'),
  
  updateFeature: (featureKey: string, data: {
    isEnabled?: boolean;
    isLocked?: boolean;
    minTier?: string;
  }) => api.patch(`/feature-locks/${featureKey}`, data),
  
  resetToDefaults: () => api.post('/feature-locks/reset'),
  
  getFeatureAccess: (schoolId: string) => 
    api.get(`/feature-locks/access/${schoolId}`),
};

export const communicationApi = {
  getAll: (params?: { type?: string; status?: string; limit?: number; offset?: number }) =>
    api.get('/communications', { params }),
  
  getById: (id: string) => api.get(`/communications/${id}`),
  
  create: (data: {
    type: string;
    subject?: string;
    message: string;
    recipientType?: string;
    recipientIds?: string[];
    scheduledAt?: string;
  }) => api.post('/communications', data),
  
  send: (id: string) => api.post(`/communications/${id}/send`),
  
  sendBulk: (id: string, recipientIds: string[]) =>
    api.post(`/communications/${id}/send-bulk`, { recipientIds }),
  
  delete: (id: string) => api.delete(`/communications/${id}`),
  
  getStats: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/communications/stats', { params }),
  
  getSettings: () => api.get('/communications/settings'),
  
  updateSettings: (data: any) => api.put('/communications/settings', data),
  
  schedule: (data: {
    type: string;
    subject?: string;
    message: string;
    recipientType?: string;
    scheduledAt: string;
  }) => api.post('/communications/schedule', data),
  
  getTemplates: () => api.get('/communications/templates/list'),
  
  createTemplate: (data: { name: string; type: string; subject?: string; message: string }) =>
    api.post('/communications/templates', data),
  
  getFacebookAnalytics: () => api.get('/communications/platforms/facebook'),
  
  getYouTubeAnalytics: () => api.get('/communications/platforms/youtube'),
  
  getLinkedInAnalytics: () => api.get('/communications/platforms/linkedin'),
  
  getWhatsAppAnalytics: () => api.get('/communications/platforms/whatsapp'),
  
  getRealtimeAlerts: () => api.get('/communications/alerts/realtime'),
  
  sendSMSAlert: (data: { message: string; priority?: string }) =>
    api.post('/communications/alerts/sms', data),
};

export const resultsSmsApi = {
  preview: (classId: string, termId: string) =>
    api.get('/results-sms/preview', { params: { classId, termId }, timeout: 60000 }),

  send: (data: { classId: string; termId: string; parentIds?: string[]; studentIds?: string[]; allowResend?: boolean }) =>
    api.post('/results-sms/send', data),

  autoSend: (data: { classId: string; termId: string }) =>
    api.post('/results-sms/auto-send', data),

  getHistory: (classId?: string, termId?: string) =>
    api.get('/results-sms/history', { params: { classId, termId } }),

  getBatchLogs: (batchId: string) =>
    api.get(`/results-sms/batches/${batchId}`),

  getLogById: (id: string) =>
    api.get(`/results-sms/logs/${id}`),

  getFailedLogs: (batchId?: string) =>
    api.get('/results-sms/failed', { params: { batchId } }),

  getSettings: () =>
    api.get('/results-sms/settings'),

  getDashboard: () =>
    api.get('/results-sms/dashboard'),

  retry: (id: string) =>
    api.post(`/results-sms/logs/${id}/retry`),

  updateDeliveryStatus: (id: string, data: { status: string; providerResponse?: string }) =>
    api.post(`/results-sms/logs/${id}/delivery-status`, data),
};

export const enrollmentApi = {
  getByStudent: (studentId: string) => api.get(`/enrollments/student/${studentId}`),
  getByClass: (classId: string) => api.get(`/enrollments/class/${classId}`),
  create: (data: { studentId: string; academicYearId: string; classId: string; termId?: string; streamId?: string }) => api.post('/enrollments', data),
  update: (id: string, data: any) => api.patch(`/enrollments/${id}`, data),
  delete: (id: string) => api.delete(`/enrollments/${id}`),
  removeFromClass: (enrollmentId: string) => api.delete(`/enrollments/${enrollmentId}`),
};

export const levelTypeApi = {
  getAll: () => api.get('/level-type'),
  getById: (id: string) => api.get(`/level-type/${id}`),
  create: (data: any) => api.post('/level-type', data),
  update: (id: string, data: any) => api.put(`/level-type/${id}`, data),
  delete: (id: string) => api.delete(`/level-type/${id}`),
};

export const gradingSystemApi = {
  getAll: () => api.get('/grading-systems'),
  getById: (id: string) => api.get(`/grading-systems/${id}`),
  getDefault: () => api.get('/grading-systems/default'),
  create: (data: { name: string; scales: Array<{ minScore: number; maxScore: number; grade: string; remark: string; points: number }> }) =>
    api.post('/grading-systems', data),
  update: (id: string, data: any) => api.patch(`/grading-systems/${id}`, data),
  delete: (id: string) => api.delete(`/grading-systems/${id}`),
  setDefault: (id: string) => api.patch(`/grading-systems/${id}/set-default`),
};

export const reportCardApi = {
  getReportCard: (studentId: string, termId: string) =>
    api.get(`/report-card/${studentId}/${termId}`),
  
  downloadReportCardPdf: (studentId: string, termId: string) =>
    api.get(`/report-card/${studentId}/${termId}/pdf`, { responseType: 'blob' }),
  
  downloadClassReportsPdf: (classId: string, termId: string) =>
    api.get(`/report-card/class/${classId}/term/${termId}/pdf`, { responseType: 'blob' }),
  
  getTranscript: (studentId: string) =>
    api.get(`/report-card/transcript/${studentId}/pdf`, { responseType: 'blob' }),
};

export const reportTemplateApi = {
  getAll: () => api.get('/report-templates'),
  
  getById: (id: string) => api.get(`/report-templates/${id}`),
  
  getDefault: () => api.get('/report-templates/default'),
  
  create: (data: {
    name: string;
    headerText?: string;
    footerText?: string;
    logoUrl?: string;
    stampUrl?: string;
    signatureUrl?: string;
    directorName?: string;
    includeLogo?: boolean;
    includeStamp?: boolean;
    includeSignature?: boolean;
    includeUniversity?: boolean;
    includeBestSix?: boolean;
    includeRankings?: boolean;
    includeComments?: boolean;
    includeGrading?: boolean;
    primaryColor?: string;
    secondaryColor?: string;
    remarksEnabled?: boolean;
    customRemarks?: any;
    isDefault?: boolean;
  }) => api.post('/report-templates', data),
  
  update: (id: string, data: any) => api.patch(`/report-templates/${id}`, data),
  
  delete: (id: string) => api.delete(`/report-templates/${id}`),
  
  uploadStamp: (id: string, formData: FormData) =>
    api.post(`/report-templates/${id}/upload-stamp`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  
  uploadSignature: (id: string, formData: FormData) =>
    api.post(`/report-templates/${id}/upload-signature`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  
  uploadLogo: (id: string, formData: FormData) =>
    api.post(`/report-templates/${id}/upload-logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

export const analyticsApi = {
  getClassPerformance: (classId: string, termId: string) =>
    api.get('/analytics/class-performance', { params: { classId, term: termId } }),
  
  getClassRanking: (classId: string, termId: string) =>
    api.get('/analytics/class-ranking', { params: { classId, term: termId } }),
  
  getSubjectPerformance: (classId: string, termId: string) =>
    api.get('/analytics/subject-performance', { params: { classId, termId } }),
  
  getGradeDistribution: (classId: string, termId: string) =>
    api.get('/analytics/grade-distribution', { params: { classId, termId } }),
  
  getGenderPerformance: (classId: string, termId: string) =>
    api.get('/analytics/gender-performance', { params: { classId, termId } }),
  
  getTeacherPerformance: (termId: string) =>
    api.get('/analytics/teacher-performance', { params: { termId } }),
  
  getDirectorDashboard: (classId: string, termId: string) =>
    api.get('/analytics/director-dashboard', { params: { classId, termId } }),
  
  getSubjectHeatmap: (classId: string, termId: string) =>
    api.get(`/analytics/heatmap/${classId}/${termId}`),
  
  getPerformanceAlerts: (classId: string, termId: string, previousTermId?: string) =>
    api.get(`/analytics/alerts/${classId}/${termId}`, {
      params: previousTermId ? { previousTermId } : undefined,
    }),
  
  getPieChartData: (classId?: string) =>
    api.get('/analytics/charts/pie', { params: classId ? { classId } : undefined }),
  
  getLineChartData: (classId: string, subjectId?: string) =>
    api.get('/analytics/charts/line', { params: { classId, subjectId } }),
  
  getBarChartData: (classId: string, termId: string) =>
    api.get('/analytics/charts/bar', { params: { classId, termId } }),
  
  getHistogramData: (classId: string, termId: string) =>
    api.get('/analytics/charts/histogram', { params: { classId, termId } }),
  
  getStudentResultsStats: (termId: string) =>
    api.get('/analytics/results-stats', { params: { termId } }),
  
  getSubscriptionStats: () => api.get('/analytics/subscription-stats'),
  
  getDashboardCharts: () => api.get('/analytics/dashboard-charts'),

  getAiInsights: (params?: { classId?: string; termId?: string; teacherId?: string }) =>
    api.get('/analytics/ai-insights', { params }),
};

export const attendanceApi = {
  getAll: (params?: { classId?: string; date?: string; startDate?: string; endDate?: string; status?: string }) =>
    api.get('/attendance', { params }),
  
  getByStudent: (studentId: string, params?: { startDate?: string; endDate?: string }) =>
    api.get(`/attendance/student/${studentId}`, { params }),
  
  getByClass: (classId: string, date: string) =>
    api.get('/attendance/class', { params: { classId, date } }),
  
  getBySlot: (slotId: string, date: string) =>
    api.get('/attendance/slot', { params: { slotId, date } }),
  
  create: (data: {
    studentId: string;
    slotId?: string;
    date: string;
    status: 'present' | 'absent' | 'late' | 'excused';
    remarks?: string;
  }) => api.post('/attendance', data),
  
  createBulk: (records: Array<{
    studentId: string;
    slotId?: string;
    date: string;
    status: 'present' | 'absent' | 'late' | 'excused';
    remarks?: string;
  }>) => api.post('/attendance/bulk', { records }),
  
  createByClass: (data: {
    classId: string;
    slotId?: string;
    date: string;
    records: Array<{ studentId: string; status: string; remarks?: string }>;
    schoolId: string;
  }) => api.post('/attendance/class', data),
  
  update: (id: string, data: { status?: string; remarks?: string }) =>
    api.patch(`/attendance/${id}`, data),
  
  delete: (id: string) => api.delete(`/attendance/${id}`),
  
  getStats: (params?: { classId?: string; startDate?: string; endDate?: string; termId?: string }) =>
    api.get('/attendance/stats', { params }),
  
  getStudentSummary: (studentId: string, params?: { termId?: string }) =>
    api.get(`/attendance/student/${studentId}/summary`, { params }),
  
  getClassSummary: (classId: string, params?: { startDate?: string; endDate?: string }) =>
    api.get(`/attendance/class/${classId}/summary`, { params }),
  
  getCalendar: (params?: { startDate: string; endDate: string; classId?: string }) =>
    api.get('/attendance/calendar', { params }),

  getAttendanceHeatmap: (classId: string, startDate: string, endDate: string) =>
    api.get('/attendance/heatmap', { params: { classId, startDate, endDate } }),

  getStudentLongitudinalAnalysis: (studentId: string) =>
    api.get(`/attendance/longitudinal/${studentId}`),

  getAttendancePerformanceCorrelation: (classId: string, termId: string) =>
    api.get('/attendance/performance-correlation', { params: { classId, termId } }),

  getChronicAbsenteeismReport: (params?: { threshold?: number }) =>
    api.get('/attendance/chronic-absenteeism', { params }),

  getPunctualityTrends: (classId: string, termId?: string) =>
    api.get('/attendance/punctuality-trends', { params: { classId, termId } }),

  getRegisterPdf: (classId: string, date: string) =>
    api.get('/attendance/register/pdf', { params: { classId, date }, responseType: 'blob' }),

  getStudentPdf: (studentId: string, params?: { startDate?: string; endDate?: string }) =>
    api.get(`/attendance/student/${studentId}/pdf`, { params, responseType: 'blob' }),
};

export const homeworkApi = {
  getAll: (params?: { classId?: string; subjectId?: string; dueDate?: string; status?: string }) =>
    api.get('/homework', { params }),
  
  getById: (id: string) => api.get(`/homework/${id}`),
  
  getByStudent: (studentId: string, params?: { includeCompleted?: boolean }) =>
    api.get(`/homework/student/${studentId}`, { params }),
  
  getByClass: (classId: string, params?: { subjectId?: string }) =>
    api.get(`/homework/class/${classId}`, { params }),
  
  getBySlot: (slotId: string) =>
    api.get(`/homework/slot/${slotId}`),
  
  create: (data: {
    title: string;
    description?: string;
    slotId?: string;
    classId: string;
    subjectId: string;
    dueDate: string;
    maxScore?: number;
    attachments?: string[];
  }) => api.post('/homework', data),
  
  update: (id: string, data: any) => api.patch(`/homework/${id}`, data),
  
  delete: (id: string) => api.delete(`/homework/${id}`),
  
  submit: (homeworkId: string, data: { submission?: string; attachments?: string[] }) =>
    api.post(`/homework/${homeworkId}/submit`, data),
  
  grade: (submissionId: string, data: { score: number; feedback?: string }) =>
    api.post(`/homework/${submissionId}/grade`, data),
  
  getSubmissions: (homeworkId: string) =>
    api.get(`/homework/${homeworkId}/submissions`),
  
  getMySubmissions: (homeworkId: string) =>
    api.get(`/homework/${homeworkId}/my-submission`),
  
  getCalendar: (params?: { startDate: string; endDate: string; classId?: string }) =>
    api.get('/homework/calendar', { params }),
};

export const workloadApi = {
  getTeacherLoad: (teacherId: string, params?: { termId?: string }) =>
    api.get(`/workload/teacher/${teacherId}`, { params }),
  
  getAllTeachers: (params?: { termId?: string }) =>
    api.get('/workload/teachers', { params }),
  
  getClassLoad: (classId: string, params?: { termId?: string }) =>
    api.get(`/workload/class/${classId}`, { params }),
  
  getBalancingSuggestions: (termId: string) =>
    api.get('/workload/balancing-suggestions', { params: { termId } }),
  
  getConflicts: (params?: { termId?: string }) =>
    api.get('/workload/conflicts', { params }),
  
  getUtilization: (params?: { termId?: string }) =>
    api.get('/workload/utilization', { params }),
};

export const calendarSyncApi = {
  getGoogleAuthUrl: () => api.get('/calendar/google/auth-url'),
  
  googleCallback: (code: string) => api.post('/calendar/google/callback', { code }),
  
  getGoogleStatus: () => api.get('/calendar/google/status'),
  
  disconnectGoogle: () => api.post('/calendar/google/disconnect'),
  
  syncToGoogle: (params?: { classId?: string }) =>
    api.post('/calendar/google/sync', params || {}),
  
  getSyncStatus: () => api.get('/calendar/sync-status'),
  
  exportToIcal: (params?: { classId?: string; teacherId?: string }) =>
    api.get('/calendar/export/ical', { params, responseType: 'blob' }),
};

export const multiSchoolApi = {
  getMySchools: () => api.get('/schools/my-schools'),
  
  switchSchool: (schoolId: string) => api.post(`/schools/switch/${schoolId}`),
  
  getSchool: (schoolId: string) => api.get(`/schools/${schoolId}`),
  
  getSchoolStats: (schoolId: string) => api.get(`/schools/${schoolId}/stats`),
  
  getQuickAccess: () => api.get('/schools/quick-access'),
};

export const libraryApi = {
  getAll: () => api.get('/library'),
  
  getById: (id: string) => api.get(`/library/${id}`),
  
  create: (data: { title: string; description?: string; category: string; fileType?: string }) => 
    api.post('/library', data),
  
  update: (id: string, data: { title?: string; description?: string; category?: string }) => 
    api.patch(`/library/${id}`, data),
  
  delete: (id: string) => api.delete(`/library/${id}`),
  
  uploadFile: (id: string, formData: FormData) =>
    api.post(`/library/${id}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  
  downloadFile: (id: string) => api.get(`/library/${id}/download`, { responseType: 'blob' }),
  
  getByCategory: (category: string) => api.get(`/library?category=${category}`),

  logReadingSession: (id: string, data: { durationSeconds: number; pagesViewed: string[]; completedAt: string }) => 
    api.post(`/library/${id}/reading-session`, data),
};

export const galleryApi = {
  getAll: () => api.get('/gallery'),

  getRecentEvents: (limit?: number) =>
    api.get('/gallery/public/recent', { params: { limit } }),

  getById: (id: string) => api.get(`/gallery/${id}`),

  create: (data: { title: string; description?: string; eventDate?: string }) =>
    api.post('/gallery', data),

  update: (id: string, data: { title?: string; description?: string; eventDate?: string }) =>
    api.patch(`/gallery/${id}`, data),

  delete: (id: string) => api.delete(`/gallery/${id}`),

  uploadPhoto: (id: string, formData: FormData) =>
    api.post(`/gallery/${id}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  deletePhoto: (galleryId: string, photoId: string) =>
    api.delete(`/gallery/${galleryId}/photo/${photoId}`),

  getByEvent: (eventId: string) => api.get(`/gallery?eventId=${eventId}`),
};

export interface LessonPlanSection {
  id: string;
  type: string;
  title: string;
  content: string;
  order: number;
  config?: Record<string, any>;
}

export interface LessonPlanConfig {
  defaultSectionTypes?: string[];
  customSections?: boolean;
  allowReordering?: boolean;
  showSectionTitles?: boolean;
}

export const lessonPlansApi = {
  getAll: (filters?: { classId?: string; subjectId?: string; status?: string; search?: string; tag?: string; weekStart?: string; weekEnd?: string }) => 
    api.get('/lesson-plans', { params: filters }),
  
  getById: (id: string) => api.get(`/lesson-plans/${id}`),
  
  getWeekly: (weekStart?: string) => 
    api.get('/lesson-plans/weekly', { params: weekStart ? { weekStart } : {} }),
  
  create: (data: {
    title: string;
    description?: string;
    classId: string;
    subjectId: string;
    weekStart: string;
    weekEnd: string;
    objectives?: string[];
    materials?: string;
    procedures?: string;
    assessment?: string;
    notes?: string;
    content?: LessonPlanSection[];
    config?: LessonPlanConfig;
    tags?: string[];
    attachments?: any[];
    status?: string;
  }) => api.post('/lesson-plans', data),
  
  update: (id: string, data: {
    title?: string;
    description?: string;
    classId?: string;
    subjectId?: string;
    weekStart?: string;
    weekEnd?: string;
    objectives?: string[];
    materials?: string;
    procedures?: string;
    assessment?: string;
    notes?: string;
    content?: LessonPlanSection[];
    config?: LessonPlanConfig;
    tags?: string[];
    attachments?: any[];
    status?: string;
  }) => api.patch(`/lesson-plans/${id}`, data),
  
  delete: (id: string) => api.delete(`/lesson-plans/${id}`),
};

export const examApi = {
  // CRUD
  getAll: (filters?: Record<string, string | undefined>) =>
    api.get('/exam', { params: filters }),
  getById: (id: string) => api.get(`/exam/${id}`),
  create: (data: any) => api.post('/exam', data),
  update: (id: string, data: any) => api.patch(`/exam/${id}`, data),
  delete: (id: string) => api.delete(`/exam/${id}`),

  // Status
  publish: (id: string) => api.post(`/exam/${id}/publish`),
  unpublish: (id: string) => api.post(`/exam/${id}/unpublish`),
  archive: (id: string) => api.post(`/exam/${id}/archive`),

  // Sections
  addSection: (examId: string, data: any) => api.post(`/exam/${examId}/sections`, data),
  getSections: (examId: string) => api.get(`/exam/${examId}/sections`),
  updateSection: (sectionId: string, data: any) => api.patch(`/exam/sections/${sectionId}`, data),
  deleteSection: (sectionId: string) => api.delete(`/exam/sections/${sectionId}`),

  // Questions
  addQuestion: (examId: string, data: any) => api.post(`/exam/${examId}/questions`, data),
  updateQuestion: (questionId: string, data: any) => api.patch(`/exam/questions/${questionId}`, data),
  deleteQuestion: (questionId: string) => api.delete(`/exam/questions/${questionId}`),
  reorderQuestions: (examId: string, order: { id: string; order: number }[]) =>
    api.post(`/exam/${examId}/questions/reorder`, { order }),
  uploadQuestionFile: (examId: string, formData: FormData) =>
    api.post(`/exam/${examId}/upload-question`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Preview
  getPreview: (id: string) => api.get(`/exam/${id}/preview`),
  renderPreviewHtml: (id: string) => api.post(`/exam/${id}/preview/html`),

  // Attempts
  startAttempt: (examId: string, studentId: string) =>
    api.post(`/exam/${examId}/start`, { studentId }),
  submitAnswer: (attemptId: string, data: { questionId: string; answer: string; timeSpent?: number }) =>
    api.post(`/exam/attempt/${attemptId}/answer`, data),
  submitExam: (attemptId: string) => api.post(`/exam/attempt/${attemptId}/submit`),
  getAttempt: (attemptId: string) => api.get(`/exam/attempt/${attemptId}`),

  // Marking
  autoMarkExam: (examId: string) => api.post(`/exam/${examId}/auto-mark`),
  autoMarkAttempt: (attemptId: string) => api.post(`/exam/attempt/${attemptId}/auto-mark`),

  // Answer Key / Marking Key
  uploadAnswerKey: (examId: string, formData: FormData) =>
    api.post(`/exam/${examId}/answer-key`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  uploadMarkingKey: (examId: string, formData: FormData) =>
    api.post(`/exam/${examId}/marking-key`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  toggleAutoGrade: (examId: string, enabled: boolean) =>
    api.patch(`/exam/${examId}/auto-grade`, { enabled }),

  // Grade individual answer
  gradeAnswer: (attemptId: string, data: { questionId: string; score: number; isCorrect?: boolean; feedback?: string }) =>
    api.patch(`/exam/attempt/${attemptId}/answer`, data),

  // Results
  getResults: (examId: string) => api.get(`/exam/${examId}/results`),
  getStudentResults: (params?: Record<string, string | undefined>) =>
    api.get('/exam/results/student', { params }),
  getStats: (examId: string) => api.get(`/exam/${examId}/stats`),

  // Question Bank
  getBankQuestions: (filters?: Record<string, string | undefined>) =>
    api.get('/exam/bank/questions', { params: filters }),
  createBankQuestion: (data: any) => api.post('/exam/bank/questions', data),
  updateBankQuestion: (id: string, data: any) => api.patch(`/exam/bank/questions/${id}`, data),
  deleteBankQuestion: (id: string) => api.delete(`/exam/bank/questions/${id}`),
  importFromBank: (examId: string, questionIds: string[]) =>
    api.post(`/exam/${examId}/bank/import`, { questionIds }),
  getBankCategories: (subjectId?: string) =>
    api.get('/exam/bank/categories', { params: { subjectId } }),
  createBankCategory: (data: any) => api.post('/exam/bank/categories', data),
  deleteBankCategory: (id: string) => api.delete(`/exam/bank/categories/${id}`),

  // Templates
  getTemplates: (subjectId?: string) =>
    api.get('/exam/templates', { params: { subjectId } }),
  getTemplateById: (id: string) => api.get(`/exam/templates/${id}`),
  createTemplate: (data: any) => api.post('/exam/templates', data),
  updateTemplate: (id: string, data: any) => api.patch(`/exam/templates/${id}`, data),
  deleteTemplate: (id: string) => api.delete(`/exam/templates/${id}`),
  applyTemplate: (examId: string, templateId: string) =>
    api.post(`/exam/${examId}/apply-template`, { templateId }),

  // Uploaded Exams
  uploadExam: (formData: FormData) =>
    api.post('/exam/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getUploadedExams: () => api.get('/exam/uploaded/list'),
  getUploadedExam: (id: string) => api.get(`/exam/uploaded/${id}`),
  updateUploadedExam: (id: string, data: any) => api.patch(`/exam/uploaded/${id}`, data),
  deleteUploadedExam: (id: string) => api.delete(`/exam/uploaded/${id}`),
  uploadAnswerScript: (id: string, formData: FormData) =>
    api.post(`/exam/uploaded/${id}/answer-script`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  parseExamDoc: (id: string) => api.post(`/exam/uploaded/${id}/parse`),
  getUploadedPreview: (id: string) => api.get(`/exam/uploaded/${id}/preview`),
};

export const roleApi = {
  getAll: () => api.get('/roles'),
  getSchoolRoles: () => api.get('/roles/school'),
  getUserRoles: (userId: string) => api.get(`/roles/user/${userId}`),
  assignRole: (userId: string, roleName: string) => api.post('/roles/assign', { userId, roleName }),
  removeRole: (userId: string, roleName: string) => api.post('/roles/remove', { userId, roleName }),
  getSchoolUsers: () => api.get('/roles/school/users'),
};

export const templateBuilderApi = {
  getTemplates: (params?: { type?: string; status?: string; categoryId?: string }) =>
    api.get('/template-builder', { params }),

  getTemplate: (id: string) => api.get(`/template-builder/${id}`),

  getClassReportTemplateAssignments: () => api.get('/template-builder/class-assignments/report-cards'),

  assignClassReportTemplate: (classId: string, templateId: string | null) =>
    api.patch(`/template-builder/classes/${classId}/report-template`, { templateId }),

  setReportCardTemplateDefault: (id: string, isDefault: boolean) =>
    api.patch(`/template-builder/${id}/report-card-default`, { isDefault }),

  createTemplate: (data: any) => api.post('/template-builder', data),

  updateTemplate: (id: string, data: any) => api.patch(`/template-builder/${id}`, data),

  deleteTemplate: (id: string) => api.delete(`/template-builder/${id}`),

  duplicateTemplate: (id: string) => api.post(`/template-builder/${id}/duplicate`),

  publishTemplate: (id: string) => api.post(`/template-builder/${id}/publish`),

  archiveTemplate: (id: string) => api.post(`/template-builder/${id}/archive`),

  getCategories: () => api.get('/template-builder/categories'),

  createCategory: (data: { name: string; slug: string; description?: string; icon?: string }) =>
    api.post('/template-builder/categories', data),

  deleteCategory: (id: string) => api.delete(`/template-builder/categories/${id}`),

  getAvailableComponents: () => api.get('/template-builder/components'),

  getMarketplaceTemplates: (params?: { category?: string; featured?: boolean; search?: string }) =>
    api.get('/template-builder/marketplace', { params }),

  publishToMarketplace: (templateId: string, data: any) =>
    api.post(`/template-builder/marketplace/${templateId}`, data),

  downloadFromMarketplace: (marketplaceId: string) =>
    api.post(`/template-builder/marketplace/download/${marketplaceId}`, undefined, { timeout: 60000 }),

  getMarketplaceCategories: () => api.get('/template-builder/marketplace/categories'),

  getBrandingPresets: () => api.get('/template-builder/branding'),

  createBrandingPreset: (data: any) => api.post('/template-builder/branding', data),

  updateBrandingPreset: (id: string, data: any) => api.patch(`/template-builder/branding/${id}`, data),

  deleteBrandingPreset: (id: string) => api.delete(`/template-builder/branding/${id}`),

  applyBrandingToTemplate: (templateId: string, presetId: string) =>
    api.post('/template-builder/branding/apply', { templateId, presetId }),

  getAssets: (params?: { type?: string; search?: string }) =>
    api.get('/template-builder/cloud-assets', { params }),

  uploadAsset: (formData: FormData) =>
    api.post('/template-builder/cloud-assets', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  deleteAsset: (id: string) => api.delete(`/template-builder/cloud-assets/${id}`),

  getAssetCategories: () => api.get('/template-builder/cloud-assets/categories'),

  getSignatures: () => api.get('/template-builder/signatures'),

  createSignature: (data: any) => api.post('/template-builder/signatures', data),

  updateSignature: (id: string, data: any) => api.patch(`/template-builder/signatures/${id}`, data),

  deleteSignature: (id: string) => api.delete(`/template-builder/signatures/${id}`),

  signDocument: (signatureId: string, documentHash: string) =>
    api.post('/template-builder/signatures/sign', { signatureId, documentHash }),

  getAISuggestions: () => api.get('/template-builder/ai/suggestions'),

  generateAILayout: (templateType: string, preferences?: any) =>
    api.post('/template-builder/ai/generate-layout', { templateType, preferences }),

  getStats: () => api.get('/template-builder/stats'),
};

export const academicTemplateApi = {
  getCategories: () => api.get('/super-admin/academic-templates/categories'),
  createCategory: (data: any) => api.post('/super-admin/academic-templates/categories', data),
  updateCategory: (id: string, data: any) => api.patch(`/super-admin/academic-templates/categories/${id}`, data),
  deleteCategory: (id: string) => api.delete(`/super-admin/academic-templates/categories/${id}`),
  getTemplates: (params?: { categoryId?: string; educationLevel?: string; type?: string }) =>
    api.get('/super-admin/academic-templates', { params }),
  getTemplate: (id: string) => api.get(`/super-admin/academic-templates/${id}`),
  createTemplate: (data: any) => api.post('/super-admin/academic-templates', data),
  updateTemplate: (id: string, data: any) => api.patch(`/super-admin/academic-templates/${id}`, data),
  deleteTemplate: (id: string) => api.delete(`/super-admin/academic-templates/${id}`),
  duplicateTemplate: (id: string) => api.post(`/super-admin/academic-templates/${id}/duplicate`),
  seedDefaults: () => api.post('/super-admin/academic-templates/seed-defaults'),
  seedMarketplace: () => api.post('/super-admin/academic-templates/seed-marketplace'),
  getOverview: () => api.get('/super-admin/academic-templates/stats/overview'),
  generateAiRemarks: (data: any) => api.post('/super-admin/academic-templates/ai-remarks/generate', data),

  publishToMarketplace: (id: string, data?: { title?: string; description?: string; category?: string; tags?: string[]; featured?: boolean }) =>
    api.post(`/super-admin/academic-templates/${id}/publish-to-marketplace`, data || {}),

  assignToSchools: (id: string, schoolIds?: string[]) =>
    api.post(`/super-admin/academic-templates/${id}/assign-to-schools`, { schoolIds }),
};

export const stampApi = {
  getStamps: (params?: { type?: string }) =>
    api.get('/template-builder/stamps', { params }),

  getStamp: (id: string) => api.get(`/template-builder/stamps/${id}`),

  createStamp: (data: {
    name: string;
    type: string;
    shape?: string;
    imageUrl?: string;
    svgContent?: string;
    opacity?: number;
    width?: number;
    height?: number;
    isDefault?: boolean;
  }) => api.post('/template-builder/stamps', data),

  updateStamp: (id: string, data: any) =>
    api.patch(`/template-builder/stamps/${id}`, data),

  deleteStamp: (id: string) => api.delete(`/template-builder/stamps/${id}`),

  duplicateStamp: (id: string) =>
    api.post(`/template-builder/stamps/${id}/duplicate`),

  getDefaultStamps: () => api.get('/template-builder/stamps/defaults'),

  getTemplateStamps: (templateId: string) =>
    api.get(`/template-builder/templates/${templateId}/stamps`),

  assignStampToTemplate: (templateId: string, data: {
    stampId: string;
    positionX?: number;
    positionY?: number;
    width?: number;
    height?: number;
    rotation?: number;
    opacity?: number;
    layerOrder?: number;
  }) => api.post(`/template-builder/templates/${templateId}/stamps`, data),

  updateTemplateStamp: (templateStampId: string, data: any) =>
    api.patch(`/template-builder/template-stamps/${templateStampId}`, data),

  removeTemplateStamp: (templateStampId: string) =>
    api.delete(`/template-builder/template-stamps/${templateStampId}`),

  createVerification: (data: { documentId: string; documentType: string; stampId?: string; metadata?: any }) =>
    api.post('/template-builder/stamps/verify', data),

  verifyDocument: (hash: string) =>
    api.get(`/template-builder/stamps/verify/${hash}`),

  getVerificationStatus: (documentId: string) =>
    api.get(`/template-builder/stamps/verify/document/${documentId}`),
};

export const intelligenceApi = {
  // Descriptive Stats
  getStudentStats: (studentId: string) => api.get(`/intelligence/descriptive-stats/student/${studentId}`),
  getClassStats: (classId: string, termId: string) => api.get(`/intelligence/descriptive-stats/class/${classId}`, { params: { termId } }),
  getZScoreAnalysis: (classId: string, termId: string) => api.get(`/intelligence/descriptive-stats/zscores/${classId}`, { params: { termId } }),
  getHistogram: (classId: string, termId: string, bins?: number) => api.get(`/intelligence/descriptive-stats/histogram/${classId}`, { params: { termId, bins } }),

  // Trends
  getStudentGrowthTrajectory: (studentId: string) => api.get(`/intelligence/trends/student/${studentId}`),
  getSubjectTrend: (classId: string, subjectId: string) => api.get(`/intelligence/trends/subject/${classId}`, { params: { subjectId } }),
  getClassComparisonTrend: (classId: string) => api.get(`/intelligence/trends/class-comparison/${classId}`),
  getLongitudinalReport: (studentId: string) => api.get(`/intelligence/trends/longitudinal/${studentId}`),

  // Correlations
  getSubjectCorrelation: (classId: string, termId: string) => api.get(`/intelligence/correlations/subjects/${classId}`, { params: { termId } }),
  getAttendanceCorrelation: (classId: string, termId: string) => api.get(`/intelligence/correlations/attendance/${classId}`, { params: { termId } }),
  getTeacherEffectiveness: (termId: string) => api.get('/intelligence/correlations/teacher-effectiveness', { params: { termId } }),
  getSubjectClusters: (classId: string, termId: string) => api.get(`/intelligence/correlations/subject-clusters/${classId}`, { params: { termId } }),

  // Predictive
  predictStudentRisk: (classId: string) => api.get(`/intelligence/predictive/risk/${classId}`),
  predictSubjectOutcome: (studentId: string, subjectId: string) => api.get(`/intelligence/predictive/subject-outcome/${studentId}`, { params: { subjectId } }),
  getAtRiskStudents: (classId?: string) => api.get('/intelligence/predictive/at-risk', { params: classId ? { classId } : undefined }),
  getDropoutPrediction: (classId?: string) => api.get('/intelligence/predictive/dropout-risk', { params: classId ? { classId } : undefined }),

  // Diagnostic
  getCompetencyDiagnosis: (studentId: string, termId: string) => api.get(`/intelligence/diagnostic/competency/${studentId}`, { params: { termId } }),
  getClassCompetencyOverview: (classId: string, termId: string) => api.get(`/intelligence/diagnostic/class-competency/${classId}`, { params: { termId } }),
  getStudentWeaknesses: (studentId: string) => api.get(`/intelligence/diagnostic/weaknesses/${studentId}`),
  getCrossSubjectDiagnosis: (studentId: string) => api.get(`/intelligence/diagnostic/cross-subject/${studentId}`),

  // Narrative
  generateStudentNarrative: (studentId: string, termId: string) => api.get(`/intelligence/narrative/student/${studentId}`, { params: { termId } }),
  generateClassNarrative: (classId: string, termId: string) => api.get(`/intelligence/narrative/class/${classId}`, { params: { termId } }),
  generateLongitudinalNarrative: (studentId: string) => api.get(`/intelligence/narrative/longitudinal/${studentId}`),

  // Recommendations
  getStudentRecommendations: (studentId: string, termId: string) => api.get(`/intelligence/recommendations/student/${studentId}`, { params: { termId } }),
  getClassInterventionNeeds: (classId: string, termId: string) => api.get(`/intelligence/recommendations/class/${classId}`, { params: { termId } }),
  suggestInterventions: (studentId: string) => api.get(`/intelligence/recommendations/suggest/${studentId}`),

  // Benchmarking
  compareWithNational: (subjectId: string, termId: string) => api.get(`/intelligence/benchmarking/compare/${subjectId}`, { params: { termId } }),
  getMultiSubjectBenchmark: (classId: string, termId: string) => api.get(`/intelligence/benchmarking/multi-subject/${classId}`, { params: { termId } }),
  addBenchmark: (data: { subjectId: string; year: number; average: number; stdDev?: number; passRate?: number; region?: string; source?: string; termName?: string }) => api.post('/intelligence/benchmarking/add', data),
  getBenchmarkTrends: (subjectId: string) => api.get(`/intelligence/benchmarking/trends/${subjectId}`),
  getSchoolBenchmarkDashboard: (termId: string) => api.get('/intelligence/benchmarking/dashboard', { params: { termId } }),

  // Psychometric
  getItemAnalysis: (examId: string) => api.get(`/intelligence/psychometric/item-analysis/${examId}`),
  getExamReliability: (examId: string) => api.get(`/intelligence/psychometric/reliability/${examId}`),
  getDifficultyDistribution: (examId: string) => api.get(`/intelligence/psychometric/difficulty-distribution/${examId}`),
  getScoreDistribution: (examId: string) => api.get(`/intelligence/psychometric/score-distribution/${examId}`),

  // Adaptive Testing
  startAdaptiveSession: (studentId: string, subjectId: string) => api.post('/intelligence/adaptive-testing/start', { studentId, subjectId }),
  getNextAdaptiveQuestion: (sessionId: string) => api.get(`/intelligence/adaptive-testing/next-question/${sessionId}`),
  submitAdaptiveAnswer: (sessionId: string, questionId: string, studentAnswer: string, responseTimeMs: number) => api.post('/intelligence/adaptive-testing/submit-answer', { sessionId, questionId, studentAnswer, responseTimeMs }),
  getAdaptiveResult: (sessionId: string) => api.get(`/intelligence/adaptive-testing/result/${sessionId}`),

  // Learning Style
  assessLearningStyle: (studentId: string, visual: number, aural: number, readWrite: number, kinesthetic: number) => api.post('/intelligence/learning-style/assess', { studentId, visual, aural, readWrite, kinesthetic }),
  getLearningStyleProfile: (studentId: string) => api.get(`/intelligence/learning-style/profile/${studentId}`),
  getClassStyleDistribution: (classId: string) => api.get(`/intelligence/learning-style/class-distribution/${classId}`),
  getSubjectStyleFit: (subjectId: string) => api.get(`/intelligence/learning-style/subject-fit/${subjectId}`),

  // Exam Quality
  analyzeExamQuality: (examId: string) => api.get(`/intelligence/exam-quality/analyze/${examId}`),
  compareExamsBySubject: (subjectId: string) => api.get(`/intelligence/exam-quality/compare/${subjectId}`),
  detectGradeInflation: (subjectId: string) => api.get(`/intelligence/exam-quality/grade-inflation/${subjectId}`),
  getExamBlueprint: (examId: string) => api.get(`/intelligence/exam-quality/blueprint/${examId}`),

  // AI Tutor
  startTutorSession: (studentId: string, subjectId?: string, topic?: string, context?: Record<string, any>) => api.post('/intelligence/ai-tutor/start', { studentId, subjectId, topic, context }, { timeout: 30000 }),
  sendTutorMessage: (sessionId: string, studentId: string, message: string, fileUrls?: string[], context?: Record<string, any>) => api.post('/intelligence/ai-tutor/message', { sessionId, studentId, message, fileUrls, context }, { timeout: 120000 }),
  getTutorSessionHistory: (sessionId: string) => api.get(`/intelligence/ai-tutor/history/${sessionId}`),
  getStudentTutorSessions: (studentId: string) => api.get(`/intelligence/ai-tutor/sessions/${studentId}`),
  endTutorSession: (sessionId: string, rating?: number, helpful?: boolean, comment?: string) => api.post(`/intelligence/ai-tutor/end/${sessionId}`, { rating, helpful, comment }),
  askTutor: (studentId: string, question: string, subjectId?: string, fileUrls?: string[], context?: Record<string, any>) => api.post('/intelligence/ai-tutor/ask', { studentId, question, subjectId, fileUrls, context }, { timeout: 120000 }),
  uploadTutorFile: (file: File, sessionId?: string, studentId?: string, onProgress?: (pct: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    if (sessionId) formData.append('sessionId', sessionId);
    if (studentId) formData.append('studentId', studentId);
    return api.post('/intelligence/ai-tutor/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress ? (e) => { if (e.total) onProgress(Math.round((e.loaded * 100) / e.total)); } : undefined,
      timeout: 120000,
    });
  },
  getTutorInsights: (studentId: string) => api.get(`/intelligence/ai-tutor/insights/${studentId}`),
};

export const digitalStampApi = {
  getStamps: (params?: { type?: string }) =>
    api.get('/stamps', { params }),

  getStampedDocuments: (params?: { status?: string }) =>
    api.get('/stamps/documents', { params }),

  getApprovalRequests: (params?: { status?: string }) =>
    api.get('/stamps/approvals', { params }),

  applyStamp: (data: { documentId: string; stampId: string; note?: string }) =>
    api.post('/stamps/apply', data),

  approveDocument: (requestId: string, data: { approved: boolean; note?: string }) =>
    api.post(`/stamps/approvals/${requestId}`, data),

  requestApproval: (data: { documentId: string; note?: string }) =>
    api.post('/stamps/request-approval', data),

  verifyDocument: (hash: string) =>
    api.get(`/stamps/verify/${hash}`),

  getDocumentPDF: (documentId: string) =>
    api.get(`/stamps/documents/${documentId}/pdf`),

  getApprovalWorkflows: (params?: { status?: string }) =>
    api.get('/stamps/workflows', { params }),

  createApprovalWorkflow: (data: { documentId: string; documentName: string; documentType: string }) =>
    api.post('/stamps/workflows', data),

  processApprovalStep: (workflowId: string, stepId: string, data: { approved: boolean; note?: string }) =>
    api.post(`/stamps/workflows/${workflowId}/steps/${stepId}`, data),

  uploadStamp: (data: { name: string; type: string; svgContent?: string; imageUrl?: string }) =>
    api.post('/stamps/upload', data),

  deleteStamp: (id: string) =>
    api.delete(`/stamps/${id}`),

  getStampVerificationStatus: (documentId: string) =>
    api.get(`/stamps/verify/document/${documentId}`),
};

export const assessmentEngineApi = {
  definitions: {
    create: (data: any) => api.post('/assessment-engine/definitions', data),
    list: (activeOnly = true) => api.get(`/assessment-engine/definitions?activeOnly=${activeOnly}`),
    update: (id: string, data: any) => api.put(`/assessment-engine/definitions/${id}`, data),
    delete: (id: string) => api.delete(`/assessment-engine/definitions/${id}`),
  },
  configurations: {
    configure: (data: any) => api.post('/assessment-engine/configure', data),
    get: (classId: string, subjectId: string, termId: string) =>
      api.get(`/assessment-engine/configurations?classId=${classId}&subjectId=${subjectId}&termId=${termId}`),
  },
  scores: {
    bulk: (data: any) => api.post('/assessment-engine/scores/bulk', data),
    single: (data: any) => api.post('/assessment-engine/scores', data),
  },
  results: {
    student: (studentId: string, termId?: string) =>
      api.get(`/assessment-engine/results/student/${studentId}${termId ? `?termId=${termId}` : ''}`),
    class: (classId: string, subjectId: string, termId: string, assessmentDefId?: string) =>
      api.get(`/assessment-engine/results/class?classId=${classId}&subjectId=${subjectId}&termId=${termId}${assessmentDefId ? `&assessmentDefId=${assessmentDefId}` : ''}`),
  },
  batches: {
    get: (batchId: string) => api.get(`/assessment-engine/batches/${batchId}`),
    verify: (batchId: string) => api.post(`/assessment-engine/batches/${batchId}/verify`),
    lock: (batchId: string) => api.post(`/assessment-engine/batches/${batchId}/lock`),
  },
  teacher: {
    pending: () => api.get('/assessment-engine/teacher/pending'),
  },
  completionStats: (classId: string, subjectId: string, termId: string) =>
    api.get(`/assessment-engine/completion-stats?classId=${classId}&subjectId=${subjectId}&termId=${termId}`),
};

export const gradingEngineApi = {
  policies: {
    list: () => api.get('/grading-engine/policies'),
    create: (data: any) => api.post('/grading-engine/policies', data),
    update: (id: string, data: any) => api.put(`/grading-engine/policies/${id}`, data),
    delete: (id: string) => api.delete(`/grading-engine/policies/${id}`),
  },
  scales: {
    list: (policyId: string) => api.get(`/grading-engine/policies/${policyId}/scales`),
    create: (policyId: string, data: any) => api.post(`/grading-engine/policies/${policyId}/scales`, data),
  },
  assignment: {
    assign: (data: any) => api.post('/grading-engine/assign', data),
    get: (classId: string, subjectId?: string, termId?: string) =>
      api.get(`/grading-engine/active-policy?classId=${classId}${subjectId ? `&subjectId=${subjectId}` : ''}${termId ? `&termId=${termId}` : ''}`),
  },
  compute: {
    class: (data: any) => api.post('/grading-engine/compute/class', data),
    student: (studentId: string, subjectId: string, termId: string, classId: string) =>
      api.get(`/grading-engine/compute/student?studentId=${studentId}&subjectId=${subjectId}&termId=${termId}&classId=${classId}`),
  },
  seed: {
    ecz: () => api.post('/grading-engine/seed/ecz'),
    gpa: () => api.post('/grading-engine/seed/gpa'),
    standard: () => api.post('/grading-engine/seed/standard'),
  },
};

export const resultAnalyticsApi = {
  class: (classId: string, termId: string) =>
    api.get(`/result-analytics/class?classId=${classId}&termId=${termId}`),
  teacher: (termId?: string) =>
    api.get(`/result-analytics/teacher${termId ? `?termId=${termId}` : ''}`),
  studentTrend: (studentId: string) =>
    api.get(`/result-analytics/student/trend?studentId=${studentId}`),
  atRisk: (classId: string, termId: string) =>
    api.get(`/result-analytics/at-risk?classId=${classId}&termId=${termId}`),
  school: (termId?: string) =>
    api.get(`/result-analytics/school${termId ? `?termId=${termId}` : ''}`),
};

export const rankingApi = {
  class: (classId: string, termId: string) =>
    api.post(`/ranking/class?classId=${classId}&termId=${termId}`),
  subject: (subjectId: string, termId: string, classId: string) =>
    api.post(`/ranking/subject?subjectId=${subjectId}&termId=${termId}&classId=${classId}`),
  student: (studentId: string, termId: string) =>
    api.get(`/ranking/student/${studentId}?termId=${termId}`),
  topPerformers: (classId: string, termId: string, limit = 10) =>
    api.get(`/ranking/top-performers?classId=${classId}&termId=${termId}&limit=${limit}`),
  percentiles: (classId: string, termId: string) =>
    api.post(`/ranking/percentiles?classId=${classId}&termId=${termId}`),
};

export const reportCardEngineApi = {
  student: (studentId: string, termId: string) =>
    api.get(`/report-card-engine/student/${studentId}?termId=${termId}`),
  bulk: (classId: string, termId: string) =>
    api.get(`/report-card-engine/bulk?classId=${classId}&termId=${termId}`),
  remarks: (type?: string) =>
    api.get(`/report-card-engine/remarks${type ? `?type=${type}` : ''}`),
  createRemark: (data: any) => api.post('/report-card-engine/remarks', data),
  status: (classId: string, termId: string) =>
    api.get(`/report-card-engine/status?classId=${classId}&termId=${termId}`),
};

export const syncEngineApi = {
  enqueue: (data: any) => api.post('/sync-engine/enqueue', data),
  enqueueBatch: (data: any) => api.post('/sync-engine/enqueue-batch', data),
  pending: (limit = 50) => api.get(`/sync-engine/pending?limit=${limit}`),
  status: () => api.get('/sync-engine/status'),
  clearCompleted: (olderThanDays = 7) => api.delete(`/sync-engine/clear-completed?olderThanDays=${olderThanDays}`),
  processQueue: () => api.post('/sync-engine/process-queue'),
};

// ==========================================
// IDENTITY & SECURITY API
// ==========================================

export const identityApi = {
  // Password Hub
  getPasswordHub: (params?: { role?: string; search?: string; accountStatus?: string; schoolId?: string }) =>
    api.get('/identity/password-hub', { params }),

  // Credential Management
  generateCredentials: (userId: string, channel: 'SMS' | 'EMAIL' | 'WHATSAPP' = 'EMAIL') =>
    api.post(`/identity/credentials/generate/${userId}`, { channel }),

  bulkGenerateCredentials: (userIds: string[], channel: 'SMS' | 'EMAIL' | 'WHATSAPP' = 'EMAIL') =>
    api.post('/identity/credentials/bulk-generate', { userIds, channel }),

  resendCredentials: (userId: string, channel: 'SMS' | 'EMAIL' | 'WHATSAPP' = 'EMAIL') =>
    api.post(`/identity/credentials/resend/${userId}`, { channel }),

  getDeliveryHistory: (userId: string) =>
    api.get(`/identity/credentials/delivery-history/${userId}`),

  // Password Management
  generatePassword: (role?: string, length?: number) =>
    api.post('/identity/password/generate', { role, length }),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/identity/password/change', { currentPassword, newPassword }),

  resetPassword: (userId: string) =>
    api.post(`/identity/password/reset/${userId}`),

  forcePasswordChange: (userId: string) =>
    api.post(`/identity/password/force-change/${userId}`),

  setPassword: (userId: string, password: string) =>
    api.post(`/identity/password/set/${userId}`, { password }),

  // Account Management
  lockAccount: (userId: string, reason?: string) =>
    api.post(`/identity/account/lock/${userId}`, { reason }),

  unlockAccount: (userId: string, reason?: string) =>
    api.post(`/identity/account/unlock/${userId}`, { reason }),

  toggleMfa: (userId: string, enable: boolean) =>
    api.post(`/identity/account/toggle-mfa/${userId}`, { enable }),

  // Session Management
  getActiveSessions: () => api.get('/identity/sessions'),
  logoutAllDevices: () => api.post('/identity/sessions/logout-all'),
  forceLogoutUser: (userId: string) => api.post(`/identity/sessions/force-logout/${userId}`),

  // Device Management
  getDevices: () => api.get('/identity/devices'),
  registerDevice: (data: { deviceId: string; deviceName?: string; deviceType?: string; platform?: string; os?: string; browser?: string; pushToken?: string }) =>
    api.post('/identity/devices/register', data),
  removeDevice: (deviceId: string) => api.delete(`/identity/devices/${deviceId}`),

  // Account Center
  getAccountCenter: () => api.get('/identity/account-center'),
  updateProfile: (data: { email?: string; phone?: string; firstName?: string; lastName?: string }) =>
    api.patch('/identity/profile', data),

  // Security Logs
  getMySecurityLogs: () => api.get('/identity/security-logs'),
  getUserSecurityLogs: (userId: string) => api.get(`/identity/security-logs/${userId}`),
  getAuditLogs: (params?: { userId?: string; action?: string; startDate?: string; endDate?: string; schoolId?: string; page?: number; limit?: number }) =>
    api.get('/identity/audit-logs', { params }),

  // OTP
  sendOtp: (purpose: string, channel: 'EMAIL' | 'SMS' | 'WHATSAPP', recipient: string) =>
    api.post('/identity/otp/send', { purpose, channel, recipient }),
  verifyOtp: (otpCode: string, purpose: string) =>
    api.post('/identity/otp/verify', { otpCode, purpose }),

  // Recovery (Public)
  forgotPassword: (email: string) => api.post('/identity/recovery/forgot-password', { email }),
  forgotUsername: (email: string) => api.post('/identity/recovery/forgot-username', { email }),
  resetPasswordWithToken: (token: string, newPassword: string) =>
    api.post('/identity/recovery/reset-password', { token, newPassword }),
};

// ==========================================
// CURRICULUM API
// ==========================================

export const curriculumApi = {
  // Education Levels
  createEducationLevel: (data: any) => api.post('/curriculum/education-levels', data),
  getEducationLevels: (schoolId?: string) => api.get('/curriculum/education-levels', { params: { schoolId } }),
  getEducationLevel: (id: string) => api.get(`/curriculum/education-levels/${id}`),
  updateEducationLevel: (id: string, data: any) => api.patch(`/curriculum/education-levels/${id}`, data),
  deleteEducationLevel: (id: string) => api.delete(`/curriculum/education-levels/${id}`),

  // Curriculum Versions
  createVersion: (data: any) => api.post('/curriculum/versions', data),
  getVersions: (educationLevelId?: string, schoolId?: string) =>
    api.get('/curriculum/versions', { params: { educationLevelId, schoolId } }),
  getVersion: (id: string) => api.get(`/curriculum/versions/${id}`),
  updateVersion: (id: string, data: any) => api.patch(`/curriculum/versions/${id}`, data),
  deleteVersion: (id: string) => api.delete(`/curriculum/versions/${id}`),

  // Academic Stages
  createStage: (data: any) => api.post('/curriculum/stages', data),
  getStages: (educationLevelId?: string, curriculumVersionId?: string) =>
    api.get('/curriculum/stages', { params: { educationLevelId, curriculumVersionId } }),
  getStage: (id: string) => api.get(`/curriculum/stages/${id}`),
  updateStage: (id: string, data: any) => api.patch(`/curriculum/stages/${id}`, data),
  deleteStage: (id: string) => api.delete(`/curriculum/stages/${id}`),

  // Subject Groups
  createSubjectGroup: (data: any) => api.post('/curriculum/subject-groups', data),
  getSubjectGroups: (curriculumVersionId?: string, schoolId?: string) =>
    api.get('/curriculum/subject-groups', { params: { curriculumVersionId, schoolId } }),
  assignSubjectToGroup: (groupId: string, subjectId: string, data?: any) =>
    api.post(`/curriculum/subject-groups/${groupId}/subjects/${subjectId}`, data || {}),
  removeSubjectFromGroup: (groupId: string, subjectId: string) =>
    api.delete(`/curriculum/subject-groups/${groupId}/subjects/${subjectId}`),

  // Composite Subjects
  createCompositeSubject: (data: any) => api.post('/composite-subjects', data),
  getCompositeSubjects: (params?: { curriculumId?: string; schoolId?: string; isActive?: boolean }) =>
    api.get('/composite-subjects', { params }),
  getCompositeSubject: (id: string) => api.get(`/composite-subjects/${id}`),
  updateCompositeSubject: (id: string, data: any) => api.put(`/composite-subjects/${id}`, data),
  deleteCompositeSubject: (id: string) => api.delete(`/composite-subjects/${id}`),
  recomputeCompositeSubject: (id: string, data: { classId: string; termId: string; schoolId: string; studentIds?: string[] }) =>
    api.post(`/composite-subjects/${id}/recompute`, data),

  // Subject Combination Rules
  createCombinationRule: (data: any) => api.post('/curriculum/subject-combination-rules', data),
  getCombinationRules: (subjectGroupId?: string) =>
    api.get('/curriculum/subject-combination-rules', { params: { subjectGroupId } }),

  // Conversion Rules
  createConversionRule: (data: any) => api.post('/curriculum/conversion-rules', data),
  getConversionRules: (subjectId?: string, curriculumVersionId?: string) =>
    api.get('/curriculum/conversion-rules', { params: { subjectId, curriculumVersionId } }),
  updateConversionRule: (id: string, data: any) => api.patch(`/curriculum/conversion-rules/${id}`, data),
  deleteConversionRule: (id: string) => api.delete(`/curriculum/conversion-rules/${id}`),

  // Division Rules
  createDivisionRule: (data: any) => api.post('/curriculum/division-rules', data),
  getDivisionRules: (curriculumVersionId?: string, examStructureId?: string) =>
    api.get('/curriculum/division-rules', { params: { curriculumVersionId, examStructureId } }),
  updateDivisionRule: (id: string, data: any) => api.patch(`/curriculum/division-rules/${id}`, data),

  // Performance Categories
  createPerformanceCategory: (data: any) => api.post('/curriculum/performance-categories', data),
  getPerformanceCategories: (curriculumVersionId?: string) =>
    api.get('/curriculum/performance-categories', { params: { curriculumVersionId } }),

  // Exam Structures
  createExamStructure: (data: any) => api.post('/curriculum/exam-structures', data),
  getExamStructures: (academicStageId?: string, curriculumVersionId?: string) =>
    api.get('/curriculum/exam-structures', { params: { academicStageId, curriculumVersionId } }),
  getExamStructure: (id: string) => api.get(`/curriculum/exam-structures/${id}`),
  updateExamStructure: (id: string, data: any) => api.patch(`/curriculum/exam-structures/${id}`, data),
  deleteExamStructure: (id: string) => api.delete(`/curriculum/exam-structures/${id}`),

  // Exam Components
  createExamComponent: (data: any) => api.post('/curriculum/exam-components', data),
  getExamComponents: (examStructureId: string) =>
    api.get(`/curriculum/exam-structures/${examStructureId}/components`),
  updateExamComponent: (id: string, data: any) => api.patch(`/curriculum/exam-components/${id}`, data),
  deleteExamComponent: (id: string) => api.delete(`/curriculum/exam-components/${id}`),

  // Best Subject Rules
  createBestSubjectRule: (data: any) => api.post('/curriculum/best-subject-rules', data),
  getBestSubjectRules: (curriculumVersionId?: string) =>
    api.get('/curriculum/best-subject-rules', { params: { curriculumVersionId } }),

  // Certification Rules
  createCertificationRule: (data: any) => api.post('/curriculum/certification-rules', data),
  getCertificationRules: (curriculumVersionId?: string) =>
    api.get('/curriculum/certification-rules', { params: { curriculumVersionId } }),

  // Promotion Rules
  createPromotionRule: (data: any) => api.post('/curriculum/promotion-rules', data),
  getPromotionRules: (curriculumVersionId?: string) =>
    api.get('/curriculum/promotion-rules', { params: { curriculumVersionId } }),

  // Pathway Rules
  createPathwayRule: (data: any) => api.post('/curriculum/pathway-rules', data),
  getPathwayRules: (curriculumVersionId?: string) =>
    api.get('/curriculum/pathway-rules', { params: { curriculumVersionId } }),

  // School Curriculum Mapping
  setSchoolLevels: (schoolId: string, levelIds: string[]) =>
    api.post(`/curriculum/schools/${schoolId}/education-levels`, { levelIds }),
  getSchoolLevels: (schoolId: string) => api.get(`/curriculum/schools/${schoolId}/education-levels`),
  setSchoolCurriculum: (schoolId: string, curriculumVersionId: string) =>
    api.post(`/curriculum/schools/${schoolId}/curricula`, { curriculumVersionId }),
  getSchoolCurricula: (schoolId: string) => api.get(`/curriculum/schools/${schoolId}/curricula`),

  // Full Tree
  getCurriculumTree: (schoolId?: string) =>
    api.get('/curriculum/tree', { params: { schoolId } }),

  // Grade 7 Engine
  computeGrade7: (studentId: string, termId: string, curriculumVersionId?: string, examStructureId?: string) =>
    api.post(`/curriculum/grade7/compute/${studentId}/${termId}`, {}, { params: { curriculumVersionId, examStructureId } }),
  batchComputeGrade7: (classId: string, termId: string, curriculumVersionId?: string, examStructureId?: string) =>
    api.post(`/curriculum/grade7/batch/${classId}/${termId}`, {}, { params: { curriculumVersionId, examStructureId } }),
  saveGrade7: (studentId: string, termId: string, data: any) =>
    api.post(`/curriculum/grade7/save/${studentId}/${termId}`, data),
  getGrade7Results: (params?: { studentId?: string; termId?: string; schoolId?: string }) =>
    api.get('/curriculum/grade7/results', { params }),
  rankGrade7: (schoolId: string, termId: string) =>
    api.post(`/curriculum/grade7/rank/${schoolId}/${termId}`),

  // Selection Analytics
  analyzeStudentSelection: (studentId: string, termId: string) =>
    api.get(`/curriculum/selection/student/${studentId}/${termId}`),
  analyzeClassSelection: (classId: string, termId: string) =>
    api.get(`/curriculum/selection/class/${classId}/${termId}`),
  getSchoolProfile: (schoolId: string) => api.get(`/curriculum/selection/school-profile/${schoolId}`),
  getDistrictRankings: (district: string, termId: string) =>
    api.get(`/curriculum/selection/district-rankings/${district}/${termId}`),
  getProvinceRankings: (province: string, termId: string) =>
    api.get(`/curriculum/selection/province-rankings/${province}/${termId}`),
};

// ==========================================
// PARENT API
// ==========================================

export const parentApi = {
  register: (data: { firstName: string; lastName: string; email: string; phone?: string; password?: string; children?: { studentId: string }[] }) =>
    api.post('/parent/register', data),

  getAll: (params?: { search?: string }) =>
    api.get('/parent', { params }),

  getById: (id: string) => api.get(`/parent/${id}`),

  getStats: () => api.get('/parent/stats'),

  update: (id: string, data: any) => api.put(`/parent/${id}`, data),

  getChildren: () => api.get('/parent/children'),

  getAllChildrenResults: () => api.get('/parent/children/results'),

  getChildAttendance: (studentId: string) =>
    api.get(`/parent/children/${studentId}/attendance`),

  getChildHomework: (studentId: string) =>
    api.get(`/parent/children/${studentId}/homework`),

  getResults: (studentId: string) =>
    api.get('/parent/results', { params: { studentId } }),

  downloadReportCard: (studentId: string, termId: string) =>
    api.get('/parent/report-card', { params: { studentId, termId }, responseType: 'blob' }),

  linkChild: (parentId: string, studentId: string) =>
    api.post('/parent/link-child', { parentId, studentId }),

  unlinkChild: (parentId: string, studentId: string) =>
    api.post('/parent/unlink-child', { parentId, studentId }),
};

// ==========================================
// PREMIUM STAFF RECORDS API (Staff Returns Hub)
// ==========================================

export const premiumStaffRecordsApi = {
  // Profiles
  getProfiles: () => api.get('/premium/staff-records/profiles'),
  getProfileById: (id: string) => api.get(`/premium/staff-records/profiles/${id}`),
  getProfileByStaffId: (staffId: string) => api.get(`/premium/staff-records/profiles/staff/${staffId}`),
  createProfile: (data: any) => api.post('/premium/staff-records/profiles', data),
  updateProfile: (id: string, data: any) => api.put(`/premium/staff-records/profiles/${id}`, data),
  deleteProfile: (id: string) => api.delete(`/premium/staff-records/profiles/${id}`),
  searchProfiles: (q: string) => api.get('/premium/staff-records/profiles/search/query', { params: { q } }),

  // Employment Records
  getEmploymentRecords: (profileId: string) => api.get(`/premium/staff-records/profiles/${profileId}/employment`),
  addEmploymentRecord: (profileId: string, data: any) => api.post(`/premium/staff-records/profiles/${profileId}/employment`, data),
  deleteEmploymentRecord: (id: string) => api.delete(`/premium/staff-records/employment/${id}`),

  // Positions
  getPositions: (profileId: string) => api.get(`/premium/staff-records/profiles/${profileId}/positions`),
  addPosition: (profileId: string, data: any) => api.post(`/premium/staff-records/profiles/${profileId}/positions`, data),

  // Allowances
  getAllowances: (profileId: string) => api.get(`/premium/staff-records/profiles/${profileId}/allowances`),
  addAllowance: (profileId: string, data: any) => api.post(`/premium/staff-records/profiles/${profileId}/allowances`, data),
  toggleAllowance: (id: string) => api.post(`/premium/staff-records/allowances/${id}/toggle`),

  // Contracts
  getContracts: (profileId: string) => api.get(`/premium/staff-records/profiles/${profileId}/contracts`),
  addContract: (profileId: string, data: any) => api.post(`/premium/staff-records/profiles/${profileId}/contracts`, data),

  // Sync
  syncProfile: (id: string) => api.post(`/premium/staff-records/sync/${id}`),
  syncAll: () => api.post('/premium/staff-records/sync-all'),
  getSyncStatus: () => api.get('/premium/staff-records/sync/status'),
  getSyncHistory: () => api.get('/premium/staff-records/sync/history'),

  // Templates (Dynamic Column Engine)
  getTemplates: () => api.get('/premium/staff-records/templates'),
  getTemplateById: (id: string) => api.get(`/premium/staff-records/templates/${id}`),
  createTemplate: (data: any) => api.post('/premium/staff-records/templates', data),
  updateTemplate: (id: string, data: any) => api.put(`/premium/staff-records/templates/${id}`, data),
  deleteTemplate: (id: string) => api.delete(`/premium/staff-records/templates/${id}`),
  duplicateTemplate: (id: string, name?: string) => api.post(`/premium/staff-records/templates/${id}/duplicate`, { name }),

  // Template Columns
  addColumn: (templateId: string, data: any) => api.post(`/premium/staff-records/templates/${templateId}/columns`, data),
  updateColumn: (id: string, data: any) => api.put(`/premium/staff-records/columns/${id}`, data),
  deleteColumn: (id: string) => api.delete(`/premium/staff-records/columns/${id}`),
  reorderColumns: (templateId: string, columns: { id: string; order: number }[]) =>
    api.post(`/premium/staff-records/templates/${templateId}/columns/reorder`, { columns }),

  // Submissions (Staff Returns)
  getReturns: (templateId?: string) =>
    api.get('/premium/staff-records/submissions', { params: { templateId } }),
  getSubmissions: (templateId?: string) =>
    api.get('/premium/staff-records/submissions', { params: { templateId } }),
  getSubmissionById: (id: string) => api.get(`/premium/staff-records/submissions/${id}`),
  createSubmission: (data: any) => api.post('/premium/staff-records/submissions', data),
  updateSubmissionData: (id: string, data: any[]) =>
    api.put(`/premium/staff-records/submissions/${id}/data`, { data }),
  submitSubmission: (id: string) => api.post(`/premium/staff-records/submissions/${id}/submit`),
  approveSubmission: (id: string) => api.post(`/premium/staff-records/submissions/${id}/approve`),
  deleteSubmission: (id: string) => api.delete(`/premium/staff-records/submissions/${id}`),

  // Excel Exports
  exportSubmissionExcel: (id: string) =>
    api.get(`/premium/staff-records/exports/submission/${id}`, { responseType: 'blob' }),
  exportTemplateExcel: (id: string) =>
    api.get(`/premium/staff-records/exports/template/${id}`, { responseType: 'blob' }),
  exportProfilesExcel: () =>
    api.get('/premium/staff-records/exports/profiles', { responseType: 'blob' }),

  // Transfers
  getTransfers: () => api.get('/premium/staff-records/transfers'),
  getTransferById: (id: string) => api.get(`/premium/staff-records/transfers/${id}`),
  createTransfer: (data: any) => api.post('/premium/staff-records/transfers', data),
  approveTransfer: (id: string) => api.post(`/premium/staff-records/transfers/${id}/approve`),
  completeTransfer: (id: string) => api.post(`/premium/staff-records/transfers/${id}/complete`),
  deleteTransfer: (id: string) => api.delete(`/premium/staff-records/transfers/${id}`),

  // Qualifications
  getQualifications: (profileId: string) => api.get(`/premium/staff-records/qualifications/${profileId}`),
  addQualification: (data: any) => api.post('/premium/staff-records/qualifications', data),
  verifyQualification: (id: string) => api.post(`/premium/staff-records/qualifications/${id}/verify`),
  deleteQualification: (id: string) => api.delete(`/premium/staff-records/qualifications/${id}`),

  // Audit Logs
  getAuditLogs: () => api.get('/premium/staff-records/audit-logs'),

  // Analytics
  getStaffAnalytics: () => api.get('/premium/staff-records/analytics'),
  getDistrictStaffSummary: (district: string) =>
    api.get(`/premium/staff-records/analytics/district/${district}`),
};

// ==========================================
// STAFF POSITIONS & DEPARTMENT HIERARCHY
// ==========================================

export const staffPositionApi = {
  // Departments
  getDepartments: () => api.get('/staff-positions/departments'),
  getDepartmentById: (id: string) => api.get(`/staff-positions/departments/${id}`),
  createDepartment: (data: { name: string; code?: string; category: string; description?: string }) =>
    api.post('/staff-positions/departments', data),
  updateDepartment: (id: string, data: any) => api.put(`/staff-positions/departments/${id}`, data),
  deleteDepartment: (id: string) => api.delete(`/staff-positions/departments/${id}`),
  getDepartmentTeachers: (departmentId: string) =>
    api.get(`/staff-positions/departments/${departmentId}/teachers`),

  // Acting Positions
  getPositions: (params?: { positionType?: string }) =>
    api.get('/staff-positions/positions', { params }),
  getTeacherPositions: (teacherId: string) =>
    api.get(`/staff-positions/positions/teacher/${teacherId}`),
  createPosition: (data: { teacherId: string; positionType: string; departmentId?: string; classId?: string; isPrimary?: boolean; startDate?: string }) =>
    api.post('/staff-positions/positions', data),
  updatePosition: (id: string, data: any) => api.put(`/staff-positions/positions/${id}`, data),
  deletePosition: (id: string) => api.delete(`/staff-positions/positions/${id}`),

  // Hierarchy & Monitoring
  getHierarchy: () => api.get('/staff-positions/hierarchy'),
  getMonitoringChain: (teacherId: string) =>
    api.get(`/staff-positions/monitoring-chain/${teacherId}`),
  getPositionTypes: () => api.get('/staff-positions/position-types'),

  // Sync
  forceSync: () => api.post('/staff-positions/sync'),
};

// ==========================================
// SYSTEM COMMUNICATIONS API (SuperAdmin)
// ==========================================

export const systemCommunicationApi = {
  // Dashboard
  getDashboard: () => api.get('/system-communications/dashboard'),
  getStats: (params?: { from?: string; to?: string }) =>
    api.get('/system-communications/stats', { params }),

  // Providers
  getProviders: () => api.get('/system-communications/providers'),
  getProvider: (id: string) => api.get(`/system-communications/providers/${id}`),
  createProvider: (data: any) => api.post('/system-communications/providers', data),
  updateProvider: (id: string, data: any) => api.put(`/system-communications/providers/${id}`, data),
  deleteProvider: (id: string) => api.delete(`/system-communications/providers/${id}`),
  setDefaultProvider: (id: string) => api.post(`/system-communications/providers/${id}/set-default`),
  testProvider: (id: string) => api.post(`/system-communications/providers/${id}/test`),

  // Broadcasts
  getBroadcasts: () => api.get('/system-communications/broadcasts'),
  getBroadcast: (id: string) => api.get(`/system-communications/broadcasts/${id}`),
  createBroadcast: (data: any) => api.post('/system-communications/broadcasts', data),
  deleteBroadcast: (id: string) => api.delete(`/system-communications/broadcasts/${id}`),

  // Campaigns
  getCampaigns: () => api.get('/system-communications/campaigns'),
  getCampaign: (id: string) => api.get(`/system-communications/campaigns/${id}`),
  createCampaign: (data: any) => api.post('/system-communications/campaigns', data),
  updateCampaign: (id: string, data: any) => api.patch(`/system-communications/campaigns/${id}`, data),
  deleteCampaign: (id: string) => api.delete(`/system-communications/campaigns/${id}`),
  launchCampaign: (id: string) => api.post(`/system-communications/campaigns/${id}/launch`),
  pauseCampaign: (id: string) => api.post(`/system-communications/campaigns/${id}/pause`),

  // Templates
  getTemplates: () => api.get('/system-communications/templates'),
  getTemplate: (id: string) => api.get(`/system-communications/templates/${id}`),
  createTemplate: (data: any) => api.post('/system-communications/templates', data),
  updateTemplate: (id: string, data: any) => api.patch(`/system-communications/templates/${id}`, data),
  deleteTemplate: (id: string) => api.delete(`/system-communications/templates/${id}`),

  // Notifications
  getNotifications: () => api.get('/system-communications/notifications'),
  createNotification: (data: any) => api.post('/system-communications/notifications', data),
  updateNotification: (id: string, data: any) => api.patch(`/system-communications/notifications/${id}`, data),
  deleteNotification: (id: string) => api.delete(`/system-communications/notifications/${id}`),
  triggerNotification: (data: any) => api.post('/system-communications/notifications/trigger', data),

  // Analytics
  getAnalytics: (params?: { from?: string; to?: string }) =>
    api.get('/system-communications/analytics', { params }),

  // Delivery Logs
  getDeliveryLogs: (params?: { type?: string; status?: string; search?: string; page?: number; limit?: number }) =>
    api.get('/system-communications/delivery-logs', { params }),

  // YouTube
  getYouTube: (signal?: AbortSignal) => api.get('/system-communications/youtube', { signal }),
  saveYouTube: (data: any) => api.post('/system-communications/youtube', data),
  syncYouTube: () => api.post('/system-communications/youtube/sync'),
  disconnectYouTube: () => api.delete('/system-communications/youtube'),

  // Scheduled
  getScheduled: () => api.get('/system-communications/scheduled'),
  cancelScheduled: (id: string) => api.post(`/system-communications/scheduled/${id}/cancel`),
  sendTestSms: (data: { to: string; message?: string }) => api.post('/system-communications/test-sms', data),
};

export const communicationsCloudApi = {
  // Unified Send APIs
  sendSms: (data: any) => api.post('/communications-cloud/send/sms', data),
  sendEmail: (data: any) => api.post('/communications-cloud/send/email', data),
  sendWhatsApp: (data: any) => api.post('/communications-cloud/send/whatsapp', data),
  sendPush: (data: any) => api.post('/communications-cloud/send/push', data),
  sendInApp: (data: any) => api.post('/communications-cloud/send/in-app', data),
  broadcast: (data: any) => api.post('/communications-cloud/broadcast', data),
  schedule: (data: any) => api.post('/communications-cloud/schedule', data),
  cancel: (id: string) => api.post(`/communications-cloud/${id}/cancel`),
  retry: (id: string) => api.post(`/communications-cloud/${id}/retry`),
  sendOtp: (data: { phone: string; message?: string }) => api.post('/communications-cloud/send/otp', data),

  // Messages
  getMessages: (params?: any) => api.get('/communications-cloud/messages', { params }),
  getMessage: (id: string) => api.get(`/communications-cloud/messages/${id}`),

  // Providers
  getProviders: (params?: { channel?: string }) => api.get('/communications-cloud/providers', { params }),
  getProvider: (id: string) => api.get(`/communications-cloud/providers/${id}`),
  createProvider: (data: any) => api.post('/communications-cloud/providers', data),
  updateProvider: (id: string, data: any) => api.put(`/communications-cloud/providers/${id}`, data),
  deleteProvider: (id: string) => api.delete(`/communications-cloud/providers/${id}`),
  testProvider: (id: string) => api.post(`/communications-cloud/providers/${id}/test`),
  toggleProvider: (id: string, isActive: boolean) => api.patch(`/communications-cloud/providers/${id}/toggle`, { isActive }),
  getProviderHealth: () => api.get('/communications-cloud/providers/health'),

  // Routing Rules
  getRoutingRules: (params?: { channel?: string }) => api.get('/communications-cloud/routing/rules', { params }),
  getRoutingRule: (id: string) => api.get(`/communications-cloud/routing/rules/${id}`),
  createRoutingRule: (data: any) => api.post('/communications-cloud/routing/rules', data),
  updateRoutingRule: (id: string, data: any) => api.put(`/communications-cloud/routing/rules/${id}`, data),
  deleteRoutingRule: (id: string) => api.delete(`/communications-cloud/routing/rules/${id}`),
  toggleRoutingRule: (id: string, isActive: boolean) => api.patch(`/communications-cloud/routing/rules/${id}`, { isActive }),

  // Templates
  getTemplates: (params?: any) => api.get('/communications-cloud/templates', { params }),
  getTemplate: (id: string) => api.get(`/communications-cloud/templates/${id}`),
  createTemplate: (data: any) => api.post('/communications-cloud/templates', data),
  updateTemplate: (id: string, data: any) => api.put(`/communications-cloud/templates/${id}`, data),
  deleteTemplate: (id: string) => api.delete(`/communications-cloud/templates/${id}`),
  renderTemplate: (id: string, variables: any) => api.post(`/communications-cloud/templates/${id}/render`, { variables }),
  seedDefaultTemplates: () => api.post('/communications-cloud/templates/seed-defaults'),

  // Sender Identities
  getSenderIdentities: (params?: any) => api.get('/communications-cloud/sender-identities', { params }),
  getSenderIdentity: (id: string) => api.get(`/communications-cloud/sender-identities/${id}`),
  createSenderIdentity: (data: any) => api.post('/communications-cloud/sender-identities', data),
  updateSenderIdentity: (id: string, data: any) => api.put(`/communications-cloud/sender-identities/${id}`, data),
  deleteSenderIdentity: (id: string) => api.delete(`/communications-cloud/sender-identities/${id}`),
  setDefaultSenderIdentity: (id: string) => api.post(`/communications-cloud/sender-identities/${id}/default`),
  verifySenderIdentity: (id: string) => api.post(`/communications-cloud/sender-identities/${id}/verify`),

  // Delivery
  getDeliveryLogs: (messageId: string) => api.get(`/communications-cloud/delivery/${messageId}`),
  getDeliveryStats: (params?: any) => api.get('/communications-cloud/delivery/stats', { params }),
  getFailedDeliveries: (params?: any) => api.get('/communications-cloud/delivery/failed', { params }),

  // Wallet / Credits
  getWallet: (ownerType: string, ownerId: string) => api.get(`/communications-cloud/billing/wallet/${ownerType}/${ownerId}`),
  getWalletBalance: (walletId: string) => api.get(`/communications-cloud/billing/wallet/${walletId}/balance`),
  rechargeWallet: (walletId: string, data: any) => api.post(`/communications-cloud/billing/wallet/${walletId}/recharge`, data),
  getTransactions: (walletId: string) => api.get(`/communications-cloud/billing/transactions/${walletId}`),
  getPricing: () => api.get('/communications-cloud/billing/pricing'),

  // Analytics
  getDashboardStats: () => api.get('/communications-cloud/analytics/dashboard'),
  getDailyMessages: (days?: number) => api.get(`/communications-cloud/analytics/daily?days=${days || 30}`),
  getMonthlyMessages: (months?: number) => api.get(`/communications-cloud/analytics/monthly?months=${months || 12}`),
  getCountryUsage: (channel?: string) => api.get(`/communications-cloud/analytics/country${channel ? `?channel=${channel}` : ''}`),
  getSchoolUsage: (schoolId: string) => api.get(`/communications-cloud/analytics/school/${schoolId}`),
  getProviderComparison: (channel?: string) => api.get(`/communications-cloud/analytics/providers${channel ? `?channel=${channel}` : ''}`),
  getRevenue: () => api.get('/communications-cloud/analytics/revenue'),

  // Webhook management
  getWebhookEvents: (params?: any) => api.get('/communications-cloud/webhooks/events', { params }),

  // Queue management
  getQueueStatus: () => api.get('/communications-cloud/queue/status'),
  getFailedJobs: () => api.get('/communications-cloud/queue/failed'),
  retryJob: (jobId: string) => api.post(`/communications-cloud/queue/retry/${jobId}`),

  // School-level convenience endpoints (for school admin dashboard)
  getSchoolWallet: () => api.get('/communications-cloud/school/wallet'),
  getSchoolTransactions: () => api.get('/communications-cloud/school/wallet/transactions'),
  rechargeSchoolWallet: (data: { amount: number; channel?: string; description?: string }) =>
    api.post('/communications-cloud/school/wallet/recharge', data),
  getSchoolBalance: (provider?: string) => api.get('/communications-cloud/school/balance', { params: { provider } }),
  getSchoolSettings: () => api.get('/communications-cloud/school/settings'),
  updateSchoolSettings: (data: any) => api.post('/communications-cloud/school/settings', data),
  sendSchoolSms: (data: { recipient: string; message: string; senderId?: string; scheduledAt?: string }) =>
    api.post('/communications-cloud/school/send-sms', data),
  getSchoolStats: () => api.get('/communications-cloud/school/stats'),
  getSchoolMessages: (params?: any) => api.get('/communications-cloud/school/messages', { params }),

  // Additional analytics endpoints
  getDeliveryRate: (params?: { channel?: string; from?: string; to?: string }) =>
    api.get('/communications-cloud/analytics/delivery-rate', { params }),
  getFailureRate: (params?: { channel?: string; from?: string; to?: string }) =>
    api.get('/communications-cloud/analytics/failure-rate', { params }),

  // Billing convenience
  generateInvoice: (walletId: string) => api.get(`/communications-cloud/billing/invoice/${walletId}`),
  getUsageReport: (walletId: string) => api.get(`/communications-cloud/billing/usage/${walletId}`),
  calculateCost: (data: { channel: string; units: number; providerType?: string }) =>
    api.post('/communications-cloud/billing/calculate-cost', data),
};

export const primaryGradingApi = {
  getPolicies: () => api.get('/primary/grading/policies'),
  getPolicy: (id: string) => api.get(`/primary/grading/policies/${id}`),
  assignPolicy: (data: { classId: string; subjectId?: string; termId?: string; policyId: string }) =>
    api.post('/primary/grading/assign', data),
  getClassReport: (classId: string, termId: string) =>
    api.get(`/primary/grading/report/${classId}/${termId}`),
};

export const grade7EczApi = {
  getClasses: () => api.get('/grade7-ecz/classes'),
  createMockExam: (data: { classId: string; termId: string; subjectId: string; title: string; paperType: 'SP1' | 'SP2' | 'MOCK'; duration: number; totalScore: number; instructions?: string; questions?: any[] }) =>
    api.post('/grade7-ecz/mock-exam', data),
  getMockExams: (classId?: string) => api.get('/grade7-ecz/mock-exams', { params: { classId } }),
  getMockExamResults: (id: string) => api.get(`/grade7-ecz/mock-exams/${id}/results`),
  enterScore: (data: { examId: string; studentId: string; score: number; totalScore?: number }) =>
    api.post('/grade7-ecz/enter-score', data),
  enterBulkScores: (data: { examId: string; scores: Array<{ studentId: string; score: number }> }) =>
    api.post('/grade7-ecz/enter-bulk-scores', data),
  computeGrade7: (classId: string, termId: string) =>
    api.post(`/grade7-ecz/compute/${classId}/${termId}`),
  getResults: (classId: string, termId: string) =>
    api.get(`/grade7-ecz/results/${classId}/${termId}`),
  rankResults: (schoolId: string, termId: string) =>
    api.post(`/grade7-ecz/rank/${schoolId}/${termId}`),
  getPrediction: (classId: string, termId: string) =>
    api.get(`/grade7-ecz/prediction/${classId}/${termId}`),
};

export const resultsManagementApi = {
  // Result Sheets
  getSheets: (params?: { status?: string; classId?: string; termId?: string; examType?: string }) =>
    api.get('/results-management/sheets', { params }),
  getSheet: (id: string) => api.get(`/results-management/sheets/${id}`),
  createSheet: (data: { classId: string; termId: string; academicYearId: string; examType?: string; title?: string; description?: string }) =>
    api.post('/results-management/sheets', data),
  getSheetStudents: (id: string) => api.get(`/results-management/sheets/${id}/students`),
  getSheetSubjects: (id: string) => api.get(`/results-management/sheets/${id}/subjects`),

  // Workflow Actions
  submitSheet: (id: string) => api.post(`/results-management/sheets/${id}/submit`),
  verifySheet: (id: string) => api.post(`/results-management/sheets/${id}/verify`),
  publishSheet: (id: string) => api.post(`/results-management/sheets/${id}/publish`),
  lockSheet: (id: string) => api.post(`/results-management/sheets/${id}/lock`),
  unlockSheet: (id: string) => api.post(`/results-management/sheets/${id}/unlock`),

  // Rankings & Analysis
  getRankings: (id: string, type?: string) =>
    api.get(`/results-management/sheets/${id}/rankings`, { params: { type } }),
  getAnalysis: (id: string) => api.get(`/results-management/sheets/${id}/analysis`),
  getMarkSchedule: (id: string) => api.get(`/results-management/sheets/${id}/mark-schedule`),

  // Audit
  getAuditLogs: (params?: { schoolId?: string; entityType?: string; entityId?: string; action?: string; classId?: string; termId?: string }) =>
    api.get('/results-management/audit-logs', { params }),
};

// ===================== CURRICULUM INTELLIGENCE ENGINE (CIE) =====================

export const curriculumIntelligenceApi = {
  // Elements of Construct
  getEocs: (subjectId: string) => api.get(`/curriculum-intelligence/subjects/${subjectId}/elements-of-construct`),
  createEoc: (data: { name: string; code?: string; description?: string; sortOrder?: number; subjectId: string; construct?: string; schoolId?: string }) =>
    api.post('/curriculum-intelligence/elements-of-construct', data),
  updateEoc: (id: string, data: any) => api.patch(`/curriculum-intelligence/elements-of-construct/${id}`, data),
  deleteEoc: (id: string) => api.delete(`/curriculum-intelligence/elements-of-construct/${id}`),

  // Topics
  getTopics: (subjectId?: string) => api.get('/curriculum-intelligence/topics', { params: { subjectId } }),
  createTopic: (data: any) => api.post('/curriculum-intelligence/topics', data),
  updateTopic: (id: string, data: any) => api.patch(`/curriculum-intelligence/topics/${id}`, data),
  deleteTopic: (id: string) => api.delete(`/curriculum-intelligence/topics/${id}`),

  // Subtopics
  getSubtopics: (topicId: string) => api.get(`/curriculum-intelligence/topics/${topicId}/subtopics`),
  createSubtopic: (data: { name: string; code?: string; description?: string; sortOrder?: number; topicId: string; schoolId?: string }) =>
    api.post('/curriculum-intelligence/subtopics', data),
  updateSubtopic: (id: string, data: any) => api.patch(`/curriculum-intelligence/subtopics/${id}`, data),
  deleteSubtopic: (id: string) => api.delete(`/curriculum-intelligence/subtopics/${id}`),

  // Competencies
  getCompetencies: (params?: { subjectId?: string; topicId?: string; eocId?: string }) =>
    api.get('/curriculum-intelligence/competencies', { params }),
  createCompetency: (data: { name: string; code?: string; description?: string; category?: string; bloomLevel?: string; topicId?: string; subtopicId?: string; subjectId?: string; eocId?: string; schoolId?: string }) =>
    api.post('/curriculum-intelligence/competencies', data),
  updateCompetency: (id: string, data: any) => api.patch(`/curriculum-intelligence/competencies/${id}`, data),
  deleteCompetency: (id: string) => api.delete(`/curriculum-intelligence/competencies/${id}`),

  // Subjects tree
  getSubjectTree: (subjectId: string) => api.get(`/curriculum-intelligence/subjects/${subjectId}/tree`),

  // Assessment Objectives
  getAssessmentObjectives: (subjectId: string) => api.get(`/curriculum-intelligence/subjects/${subjectId}/assessment-objectives`),

  // Syllabus Documents
  getSyllabusDocuments: (schoolId?: string) => api.get('/curriculum-intelligence/syllabus-documents', { params: { schoolId } }),

  // SBA Tasks
  getSbaTasks: (subjectId?: string) => api.get('/curriculum-intelligence/sba/tasks', { params: { subjectId } }),
  createSbaTask: (data: { title: string; description?: string; taskNumber: number; subjectId: string; academicStageId?: string; termId?: string; maxMarks?: number; weight?: number; competencyId?: string; eocId?: string; dueDate?: string; schoolId?: string }) =>
    api.post('/curriculum-intelligence/sba/tasks', data),
  updateSbaTask: (id: string, data: any) => api.patch(`/curriculum-intelligence/sba/tasks/${id}`, data),
  deleteSbaTask: (id: string) => api.delete(`/curriculum-intelligence/sba/tasks/${id}`),
  generateSbaTemplate: (subjectId: string) => api.get(`/curriculum-intelligence/sba/templates/${subjectId}`),

  // Lesson Plans
  getLessonPlans: (subjectId?: string) => api.get('/curriculum-intelligence/lesson-plans', { params: { subjectId } }),

  // Curriculum Coverage
  getCoverage: (params?: { classId?: string; subjectId?: string }) =>
    api.get('/curriculum-intelligence/coverage', { params }),

  // Analytics
  getComplianceAnalytics: (params?: { schoolId?: string; subjectId?: string; classId?: string }) =>
    api.get('/curriculum-intelligence/analytics/compliance', { params }),
};

export const landingMockupApi = {
  getAll: () => api.get('/landing-mockups'),
  getActive: () => api.get('/landing-mockups/active'),
  getOne: (id: string) => api.get(`/landing-mockups/${id}`),
  create: (data: { label: string; role?: string; category?: string; imageUrl: string; order?: number; isActive?: boolean }) =>
    api.post('/landing-mockups', data),
  update: (id: string, data: any) => api.patch(`/landing-mockups/${id}`, data),
  delete: (id: string) => api.delete(`/landing-mockups/${id}`),
  upload: (formData: FormData) =>
    api.post('/landing-mockups/upload', formData, {
      timeout: 180000,
    }),
};

export const schoolMembershipApi = {
  getMembers: () => api.get('/school-membership/members'),
  getTeachingStaff: () => api.get('/school-membership/teaching-staff'),
  getMembersByRole: (role: string) => api.get(`/school-membership/members/role/${role}`),
  addMember: (userId: string, isPrimary?: boolean) => api.post('/school-membership/members', { userId, isPrimary }),
  removeMember: (userId: string) => api.delete(`/school-membership/members/${userId}`),
  assignRole: (userId: string, role: string) => api.post('/school-membership/roles', { userId, role }),
  removeRole: (userId: string, role: string) => api.delete('/school-membership/roles', { data: { userId, role } }),
  getUserRoles: (userId: string) => api.get(`/school-membership/user/${userId}/roles`),
};

export const platformRoleApi = {
  getAll: () => api.get('/platform-roles'),
  assign: (userId: string, role: string) => api.post('/platform-roles/assign', { userId, role }),
  remove: (userId: string, role: string) => api.delete('/platform-roles/remove', { data: { userId, role } }),
  getUserRoles: (userId: string) => api.get(`/platform-roles/user/${userId}`),
  getUsersByRole: (role: string) => api.get(`/platform-roles/role/${role}/users`),
};

export const classTeacherAssignmentApi = {
  assign: (data: { teacherId: string; classId: string; academicYearId: string; isPrimary?: boolean }) =>
    api.post('/class-teacher-assignments', data),
  remove: (id: string) => api.delete(`/class-teacher-assignments/${id}`),
  findByClass: (classId: string, academicYearId?: string) =>
    api.get(`/class-teacher-assignments/class/${classId}`, { params: { academicYearId } }),
  findByTeacher: (teacherId: string) => api.get(`/class-teacher-assignments/teacher/${teacherId}`),
  findBySchool: (academicYearId?: string) =>
    api.get('/class-teacher-assignments/school', { params: { academicYearId } }),
  getMyClasses: () => api.get('/class-teacher-assignments/my-classes'),
};

export const holidayApi = {
  getAll: (params?: { type?: string; year?: number }) =>
    api.get('/holiday', { params }),
  getById: (id: string) => api.get(`/holiday/${id}`),
  checkDate: (date: string) => api.get(`/holiday/check/${date}`),
  getInRange: (startDate: string, endDate: string) =>
    api.get('/holiday/range', { params: { startDate, endDate } }),
  create: (data: { name: string; description?: string; startDate: string; endDate: string; type?: string; isRecurring?: boolean }) =>
    api.post('/holiday', data),
  update: (id: string, data: Partial<{ name: string; description: string; startDate: string; endDate: string; type: string; isRecurring: boolean }>) =>
    api.put(`/holiday/${id}`, data),
  delete: (id: string) => api.delete(`/holiday/${id}`),
  seedNationalHolidays: (year: number) => api.post(`/holiday/seed/${year}`),
};

export const reportEngineApi = {
  getTypes: () => api.get('/report-engine/types'),
  validate: (data: { type: string; studentId?: string; classId?: string; termId?: string; examType?: string; templateId?: string }) =>
    api.post('/report-engine/validate', data),
  generate: (data: { type: string; studentId?: string; classId?: string; termId?: string; examType?: string; templateId?: string; options?: any }) =>
    api.post('/report-engine/generate', data),
  generatePdf: (data: { type: string; studentId?: string; classId?: string; termId?: string; examType?: string; templateId?: string }) =>
    api.post('/report-engine/generate-pdf', data, { responseType: 'blob', timeout: 300000 }),
  previewReportCard: (data: { studentId: string; termId: string; examType?: string; templateId?: string }) =>
    api.post('/report-engine/report-card-html', data, { timeout: 120000 }),
  generateBulk: (data: { type: string; classId?: string; termId?: string; examType?: string; templateId?: string; studentIds?: string[] }) =>
    api.post('/report-engine/generate-bulk', data, { timeout: 600000 }),
  listReports: (params?: { reportType?: string; classId?: string; termId?: string; page?: number; limit?: number }) =>
    api.get('/report-engine/reports', { params }),
  getReport: (id: string) => api.get(`/report-engine/reports/${id}`),
  deleteReport: (id: string) => api.delete(`/report-engine/reports/${id}`),
  downloadReport: (id: string) => api.get(`/report-engine/download/${id}`, { responseType: 'blob' }),
};
