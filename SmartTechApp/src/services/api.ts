import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import {
  LoginResponse,
  MobileLoginRequest,
  DashboardData,
  Notification,
  StudentTimetable,
  TeacherTimetable,
  Exam,
  ExamAttempt,
  ExamQuestion,
  AutoMarkResult,
  ExamStats,
  UploadedExam,
  SuperAdminLoginResponse,
} from '../types';

const extra = Constants.expoConfig?.extra || {};
const API_BASE_URL = extra.apiBaseUrl || 'https://api.smarttechsaas.com/api/v1';
export const BASE_URL = API_BASE_URL.replace('/api/v1', '');

export function resolveImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://') || url.startsWith('data:')) return url;
  if (url.startsWith('/')) return `${BASE_URL}${url}`;
  return url;
}

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(async (config) => {
      if (config.url?.includes('/auth/mobile-login') || config.url?.includes('/auth/login') || config.url?.includes('/auth/register') || config.url?.includes('/auth/forgot-password') || config.url?.includes('/auth/reset-password') || config.url?.includes('/auth/super-admin/login')) {
        return config;
      }
      if (!this.token) {
        try {
          this.token = await AsyncStorage.getItem('access_token');
        } catch (e) {
          console.warn('Failed to load access token:', e);
        }
      }
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => {
        if (response.data && typeof response.data === 'object' && 'statusCode' in response.data && 'timestamp' in response.data) {
          response.data = response.data.data !== undefined ? response.data.data : response.data;
        }
        return response;
      },
      async (error) => {
        if (error.response?.status === 401) {
          await this.logout();
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string | null) {
    this.token = token;
  }

  async superAdminLogin(data: { email: string; password: string }): Promise<SuperAdminLoginResponse> {
    const response = await this.client.post<SuperAdminLoginResponse>('/auth/super-admin/login', data);
    this.token = response.data.access_token;
    AsyncStorage.setItem('access_token', response.data.access_token).catch((e) =>
      console.warn('Failed to persist access token:', e),
    );
    AsyncStorage.setItem('user', JSON.stringify(response.data.user)).catch((e) =>
      console.warn('Failed to persist user:', e),
    );
    return response.data;
  }

  async login(data: MobileLoginRequest): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/auth/mobile-login', data);
    this.token = response.data.access_token;
    if (response.data?.user?.photoUrl) {
      response.data.user.photoUrl = resolveImageUrl(response.data.user.photoUrl) || response.data.user.photoUrl;
    }
    if (response.data?.user?.school?.logo) {
      response.data.user.school.logo = resolveImageUrl(response.data.user.school.logo) || response.data.user.school.logo;
    }
    AsyncStorage.setItem('access_token', response.data.access_token).catch((e) =>
      console.warn('Failed to persist access token:', e),
    );
    AsyncStorage.setItem('user', JSON.stringify(response.data.user)).catch((e) =>
      console.warn('Failed to persist user:', e),
    );
    return response.data;
  }

  async forgotPassword(email: string) {
    const response = await this.client.post('/auth/forgot-password', { email });
    return response.data;
  }

  async resetPassword(token: string, newPassword: string) {
    const response = await this.client.post('/auth/reset-password', { token, newPassword });
    return response.data;
  }

  async logout() {
    this.token = null;
    AsyncStorage.removeItem('access_token').catch(() => {});
    AsyncStorage.removeItem('user').catch(() => {});
  }

  // Institution type API methods
  async getInstitutionTypes() {
    const response = await this.client.get('/auth/institution-types');
    return response.data;
  }

  async getTypeByCode(code: string) {
    const response = await this.client.get(`/institution/types/${code}`);
    return response.data;
  }

  async getTypeModules(code: string) {
    const response = await this.client.get(`/institution/types/${code}/modules`);
    return response.data;
  }

  async getTypeRoles(code: string) {
    const response = await this.client.get(`/institution/types/${code}/roles`);
    return response.data;
  }

  async getTypeDashboards(code: string) {
    const response = await this.client.get(`/institution/types/${code}/dashboards`);
    return response.data;
  }

  async getSchoolType(schoolId: string) {
    const response = await this.client.get(`/institution/${schoolId}/type`);
    return response.data;
  }

  async getSchoolModules(schoolId: string) {
    const response = await this.client.get(`/institution/${schoolId}/modules`);
    return response.data;
  }

  async getSchoolRoles(schoolId: string) {
    const response = await this.client.get(`/institution/${schoolId}/roles`);
    return response.data;
  }

  async getDashboard(): Promise<DashboardData> {
    const response = await this.client.get<DashboardData>('/mobile/dashboard');
    return response.data;
  }

  async getNotifications(page = 1, limit = 20) {
    const response = await this.client.get('/mobile/notifications', {
      params: { page, limit },
    });
    return response.data;
  }

  async getUnreadNotificationCount() {
    const response = await this.client.get('/mobile/notifications/unread-count');
    return response.data;
  }

  async markNotificationAsRead(notificationId: string) {
    const response = await this.client.put(`/mobile/notifications/${notificationId}/read`);
    return response.data;
  }

  async markAllNotificationsAsRead() {
    const response = await this.client.put('/mobile/notifications/read-all');
    return response.data;
  }

  async getStudentTimetable(): Promise<StudentTimetable> {
    const response = await this.client.get<StudentTimetable>('/mobile/timetable/student');
    return response.data;
  }

  async getTeacherTimetable(): Promise<TeacherTimetable> {
    const response = await this.client.get<TeacherTimetable>('/mobile/timetable/teacher');
    return response.data;
  }

  async getStudentResults(studentId: string, termId: string) {
    const response = await this.client.get(`/results/${studentId}/${termId}`);
    return response.data;
  }

  async getStudentAttendance(studentId: string, termId?: string) {
    const params = termId ? { termId } : {};
    const response = await this.client.get(`/attendance/student/${studentId}/summary`, { params });
    return response.data;
  }

  async getReportCard(studentId: string, termId: string) {
    const response = await this.client.get(`/report-card/${studentId}/${termId}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async getParentChildren() {
    const response = await this.client.get('/parent/children');
    return response.data;
  }

  async getParentChildResults(studentId: string, _termId?: string) {
    const response = await this.client.get('/parent/results', { params: { studentId } });
    return response.data;
  }

  async getParentReportCard(studentId: string, termId: string) {
    const response = await this.client.get('/parent/report-card', {
      params: { studentId, termId },
      responseType: 'blob',
    });
    return response.data;
  }

  async getTeacherClasses() {
    const response = await this.client.get('/teacher/class-students');
    return response.data;
  }

  async getTeacherSubjects() {
    const response = await this.client.get('/teacher/subjects');
    return response.data;
  }

  async enterMarks(classId: string, subjectId: string, termId: string, scores: any[]) {
    const response = await this.client.post('/teacher/enter-marks', {
      classId,
      subjectId,
      termId,
      scores,
    });
    return response.data;
  }

  async getClassAttendance(classId: string, date: string) {
    const response = await this.client.get('/attendance/class', {
      params: { classId, date },
    });
    return response.data;
  }

  async submitAttendance(classId: string, date: string, attendances: any[]) {
    const response = await this.client.post('/attendance', {
      classId,
      date,
      attendances,
    });
    return response.data;
  }

  async getAnnouncements() {
    const response = await this.client.get('/notice-board');
    return response.data;
  }

  async logoutDevice(deviceToken: string) {
    const response = await this.client.post('/mobile/logout-device', { deviceToken });
    return response.data;
  }

  async registerPushToken(token: string, platform?: string, role?: string) {
    const response = await this.client.post('/notifications/register-device', { deviceToken: token, platform: platform || 'android', role });
    return response.data;
  }

  async getNotifications(page = 1, limit = 20, category?: string) {
    const params: any = { page, limit };
    if (category) params.category = category;
    const response = await this.client.get('/notifications', { params });
    return response.data;
  }

  async getUnreadNotificationCount() {
    const response = await this.client.get('/notifications/unread-count');
    return response.data;
  }

  async markNotificationAsRead(id: string) {
    const response = await this.client.put(`/notifications/${id}/read`);
    return response.data;
  }

  async markAllNotificationsAsRead() {
    const response = await this.client.put('/notifications/read-all');
    return response.data;
  }

  async getNotificationCategories() {
    const response = await this.client.get('/notifications/categories');
    return response.data;
  }

  // Intelligence endpoints
  async getStudentStats(studentId: string) {
    const response = await this.client.get(`/intelligence/descriptive-stats/student/${studentId}`);
    return response.data;
  }

  async getLearningStyleProfile(studentId: string) {
    const response = await this.client.get(`/intelligence/learning-style/profile/${studentId}`);
    return response.data;
  }

  async assessLearningStyle(studentId: string, visual: number, aural: number, readWrite: number, kinesthetic: number) {
    const response = await this.client.post('/intelligence/learning-style/assess', { studentId, visual, aural, readWrite, kinesthetic });
    return response.data;
  }

  async getStudentRecommendations(studentId: string, termId: string) {
    const response = await this.client.get(`/intelligence/recommendations/student/${studentId}`, { params: { termId } });
    return response.data;
  }

  async askTutor(studentId: string, question: string, subjectId?: string) {
    const response = await this.client.post('/intelligence/ai-tutor/ask', { studentId, question, subjectId });
    return response.data;
  }

  async startTutorSession(studentId: string, subjectId?: string, topic?: string) {
    const response = await this.client.post('/intelligence/ai-tutor/start', { studentId, subjectId, topic });
    return response.data;
  }

  async sendTutorMessage(sessionId: string, studentId: string, message: string) {
    const response = await this.client.post('/intelligence/ai-tutor/message', { sessionId, studentId, message });
    return response.data;
  }

  async getTutorInsights(studentId: string) {
    const response = await this.client.get(`/intelligence/ai-tutor/insights/${studentId}`);
    return response.data;
  }

  async getExamReliability(examId: string) {
    const response = await this.client.get(`/intelligence/psychometric/reliability/${examId}`);
    return response.data;
  }

  async getCompetencyDiagnosis(studentId: string, termId: string) {
    const response = await this.client.get(`/intelligence/diagnostic/competency/${studentId}`, { params: { termId } });
    return response.data;
  }

  async getStudentGrowthTrajectory(studentId: string) {
    const response = await this.client.get(`/intelligence/trends/student/${studentId}`);
    return response.data;
  }

  // Mobile-specific intelligence summary
  async getMobileIntelligenceSummary(studentId: string) {
    const response = await this.client.get(`/mobile/intelligence-summary/${studentId}`);
    return response.data;
  }

  // ===== Mobile AI Tutor =====

  async getAiTutorSessions() {
    const response = await this.client.get('/mobile/ai-tutor/sessions');
    return response.data;
  }

  async startAiTutorSession(data: {
    subjectId?: string;
    topic?: string;
    studentId?: string;
    context?: { role?: string; screen?: string; subject?: string; topic?: string };
  }) {
    const response = await this.client.post('/mobile/ai-tutor/start', data);
    return response.data;
  }

  async sendAiTutorMessage(sessionId: string, message: string, context?: {
    role?: string; screen?: string; subject?: string; topic?: string;
  }) {
    const response = await this.client.post('/mobile/ai-tutor/message', { sessionId, message, context });
    return response.data;
  }

  async getAiTutorHistory(sessionId: string) {
    const response = await this.client.get(`/mobile/ai-tutor/history/${sessionId}`);
    return response.data;
  }

  async endAiTutorSession(sessionId: string, feedback?: { rating?: number; helpful?: boolean; comment?: string }) {
    const response = await this.client.post(`/mobile/ai-tutor/end/${sessionId}`, feedback || {});
    return response.data;
  }

  async askAiTutor(question: string, subjectId?: string, context?: {
    role?: string; screen?: string; subject?: string; topic?: string;
  }) {
    const response = await this.client.post('/mobile/ai-tutor/ask', { question, subjectId, context });
    return response.data;
  }

  // ===== Mobile Director Data =====

  async getDirectorDashboard(): Promise<any> {
    const response = await this.client.get('/director/dashboard');
    return response.data;
  }

  async getClasses() {
    const response = await this.client.get('/mobile/classes');
    return response.data;
  }

  async getStudents(classId?: string) {
    const params = classId ? { classId } : {};
    const response = await this.client.get('/mobile/students', { params });
    return response.data;
  }

  async getStaff() {
    const response = await this.client.get('/mobile/staff');
    return response.data;
  }

  async getSubjects() {
    const response = await this.client.get('/mobile/subjects');
    return response.data;
  }

  async getUsers(role?: string) {
    const params = role ? { role } : {};
    const response = await this.client.get('/mobile/users', { params });
    return response.data;
  }

  async createUser(data: { firstName: string; lastName: string; email: string; password: string; roles: string[] }) {
    const response = await this.client.post('/mobile/users', data);
    return response.data;
  }

  async updateUser(userId: string, data: { firstName?: string; lastName?: string; email?: string; roles?: string[]; isActive?: boolean }) {
    const response = await this.client.patch(`/mobile/users/${userId}`, data);
    return response.data;
  }

  async deleteUser(userId: string) {
    const response = await this.client.delete(`/mobile/users/${userId}`);
    return response.data;
  }

  // ===== Mobile Attendance =====

  async getAttendanceRegister(classId: string, date: string) {
    const response = await this.client.get('/mobile/attendance/register', { params: { classId, date } });
    return response.data;
  }

  async submitBulkAttendance(classId: string, date: string, records: { studentId: string; status: string; remarks?: string }[]) {
    const response = await this.client.post('/mobile/attendance/bulk', { classId, date, records });
    return response.data;
  }

  async markAllAttendance(classId: string, date: string, status: string) {
    const response = await this.client.post('/mobile/attendance/mark-all', { classId, date, status });
    return response.data;
  }

  // ===== Template Builder API =====

  async getAvailableComponents() {
    const response = await this.client.get('/template-builder/components');
    return response.data;
  }

  async getTemplateCategories() {
    const response = await this.client.get('/template-builder/categories');
    return response.data;
  }

  async createTemplateCategory(data: { name: string; slug: string; description?: string; icon?: string }) {
    const response = await this.client.post('/template-builder/categories', data);
    return response.data;
  }

  async deleteTemplateCategory(id: string) {
    const response = await this.client.delete(`/template-builder/categories/${id}`);
    return response.data;
  }

  async getTemplates(type?: string, status?: string, categoryId?: string) {
    const params: any = {};
    if (type) params.type = type;
    if (status) params.status = status;
    if (categoryId) params.categoryId = categoryId;
    const response = await this.client.get('/template-builder', { params });
    return response.data;
  }

  async getTemplate(id: string) {
    const response = await this.client.get(`/template-builder/${id}`);
    return response.data;
  }

  async createTemplate(data: any) {
    const response = await this.client.post('/template-builder', data);
    return response.data;
  }

  async updateTemplate(id: string, data: any) {
    const response = await this.client.patch(`/template-builder/${id}`, data);
    return response.data;
  }

  async deleteTemplate(id: string) {
    const response = await this.client.delete(`/template-builder/${id}`);
    return response.data;
  }

  async duplicateTemplate(id: string) {
    const response = await this.client.post(`/template-builder/${id}/duplicate`);
    return response.data;
  }

  async publishTemplate(id: string) {
    const response = await this.client.post(`/template-builder/${id}/publish`);
    return response.data;
  }

  async archiveTemplate(id: string) {
    const response = await this.client.post(`/template-builder/${id}/archive`);
    return response.data;
  }

  async saveTemplateLayout(id: string, layout: any) {
    const response = await this.client.post(`/template-builder/${id}/layout`, { layout });
    return response.data;
  }

  async addTemplateComponent(templateId: string, data: any) {
    const response = await this.client.post(`/template-builder/${templateId}/components`, data);
    return response.data;
  }

  async updateTemplateComponent(templateId: string, componentId: string, data: any) {
    const response = await this.client.patch(`/template-builder/${templateId}/components/${componentId}`, data);
    return response.data;
  }

  async deleteTemplateComponent(templateId: string, componentId: string) {
    const response = await this.client.delete(`/template-builder/${templateId}/components/${componentId}`);
    return response.data;
  }

  async reorderComponents(templateId: string, order: { id: string; sortOrder: number }[]) {
    const response = await this.client.post(`/template-builder/${templateId}/components/reorder`, { order });
    return response.data;
  }

  async getCertificateSettings(templateId: string) {
    const response = await this.client.get(`/template-builder/${templateId}/certificate`);
    return response.data;
  }

  async updateCertificateSettings(templateId: string, data: any) {
    const response = await this.client.patch(`/template-builder/${templateId}/certificate`, data);
    return response.data;
  }

  async renderTemplatePreview(templateId: string, data?: any) {
    const response = await this.client.post(`/template-builder/${templateId}/preview`, { data });
    return response.data;
  }

  async renderCertificate(templateId: string, data: any) {
    const response = await this.client.post(`/template-builder/${templateId}/certificate/render`, data);
    return response.data;
  }

  // ===== AI Template Generator =====

  async generateAILayout(templateType: string, preferences?: any) {
    const response = await this.client.post('/template-builder/ai/generate-layout', { templateType, preferences });
    return response.data;
  }

  async getAITemplateSuggestions() {
    const response = await this.client.get('/template-builder/ai/suggestions');
    return response.data;
  }

  async suggestTemplateFromStudentData(studentId: string) {
    const response = await this.client.post('/template-builder/ai/suggest-from-student', { studentId });
    return response.data;
  }

  // ===== Branding Presets =====

  async getBrandingPresets() {
    const response = await this.client.get('/template-builder/branding');
    return response.data;
  }

  async getBrandingPreset(id: string) {
    const response = await this.client.get(`/template-builder/branding/${id}`);
    return response.data;
  }

  async createBrandingPreset(data: any) {
    const response = await this.client.post('/template-builder/branding', data);
    return response.data;
  }

  async updateBrandingPreset(id: string, data: any) {
    const response = await this.client.patch(`/template-builder/branding/${id}`, data);
    return response.data;
  }

  async deleteBrandingPreset(id: string) {
    const response = await this.client.delete(`/template-builder/branding/${id}`);
    return response.data;
  }

  async applyBrandingToTemplate(templateId: string, presetId: string) {
    const response = await this.client.post(`/template-builder/branding/apply`, { templateId, presetId });
    return response.data;
  }

  // ===== Template Marketplace =====

  async getMarketplaceTemplates(filters?: { category?: string; featured?: boolean; search?: string }) {
    const params: any = {};
    if (filters?.category) params.category = filters.category;
    if (filters?.featured) params.featured = filters.featured;
    if (filters?.search) params.search = filters.search;
    const response = await this.client.get('/template-builder/marketplace', { params });
    return response.data;
  }

  async publishToMarketplace(templateId: string, data: any) {
    const response = await this.client.post(`/template-builder/marketplace/${templateId}`, data);
    return response.data;
  }

  async downloadFromMarketplace(marketplaceId: string) {
    const response = await this.client.post(`/template-builder/marketplace/download/${marketplaceId}`);
    return response.data;
  }

  async likeMarketplaceItem(marketplaceId: string) {
    const response = await this.client.post(`/template-builder/marketplace/like/${marketplaceId}`);
    return response.data;
  }

  async getMarketplaceCategories() {
    const response = await this.client.get('/template-builder/marketplace/categories');
    return response.data;
  }

  // ===== Cloud Assets =====

  async getAssets(type?: string, search?: string) {
    const params: any = {};
    if (type) params.type = type;
    if (search) params.search = search;
    const response = await this.client.get('/template-builder/cloud-assets', { params });
    return response.data;
  }

  async uploadAsset(formData: FormData) {
    const response = await this.client.post('/template-builder/cloud-assets', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async deleteAsset(id: string) {
    const response = await this.client.delete(`/template-builder/cloud-assets/${id}`);
    return response.data;
  }

  // ===== Cloudinary Media =====

  async uploadMedia(formData: FormData, onProgress?: (progress: number) => void) {
    const response = await this.client.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress ? (e) => {
        if (e.total) onProgress(Math.round((e.loaded * 100) / e.total));
      } : undefined,
    });
    return response.data;
  }

  async getMedia(params?: { folder?: string; page?: number; limit?: number }) {
    const response = await this.client.get('/media', { params });
    return response.data;
  }

  async deleteMedia(publicId: string) {
    const response = await this.client.delete('/media', { data: { publicId } });
    return response.data;
  }

  async getMediaStats() {
    const response = await this.client.get('/media/stats');
    return response.data;
  }

  async getMediaByUser(userId: string) {
    const response = await this.client.get(`/media/user/${userId}`);
    return response.data;
  }

  async getAssetCategories() {
    const response = await this.client.get('/template-builder/cloud-assets/categories');
    return response.data;
  }

  // ===== Digital Signatures =====

  async getSignatures() {
    const response = await this.client.get('/template-builder/signatures');
    return response.data;
  }

  async createSignature(data: any) {
    const response = await this.client.post('/template-builder/signatures', data);
    return response.data;
  }

  async updateSignature(id: string, data: any) {
    const response = await this.client.patch(`/template-builder/signatures/${id}`, data);
    return response.data;
  }

  async deleteSignature(id: string) {
    const response = await this.client.delete(`/template-builder/signatures/${id}`);
    return response.data;
  }

  async signDocument(signatureId: string, documentHash: string) {
    const response = await this.client.post('/template-builder/signatures/sign', { signatureId, documentHash });
    return response.data;
  }

  // ===== Digital Stamps =====

  async getStamps(type?: string) {
    const params: any = {};
    if (type) params.type = type;
    const response = await this.client.get('/template-builder/stamps', { params });
    return response.data;
  }

  async getStamp(id: string) {
    const response = await this.client.get(`/template-builder/stamps/${id}`);
    return response.data;
  }

  async createStamp(data: { name: string; type: string; shape?: string; imageUrl?: string; svgContent?: string; opacity?: number; width?: number; height?: number; isDefault?: boolean }) {
    const response = await this.client.post('/template-builder/stamps', data);
    return response.data;
  }

  async updateStamp(id: string, data: any) {
    const response = await this.client.patch(`/template-builder/stamps/${id}`, data);
    return response.data;
  }

  async deleteStamp(id: string) {
    const response = await this.client.delete(`/template-builder/stamps/${id}`);
    return response.data;
  }

  async duplicateStamp(id: string) {
    const response = await this.client.post(`/template-builder/stamps/${id}/duplicate`);
    return response.data;
  }

  async getDefaultStamps() {
    const response = await this.client.get('/template-builder/stamps/defaults');
    return response.data;
  }

  async getTemplateStamps(templateId: string) {
    const response = await this.client.get(`/template-builder/templates/${templateId}/stamps`);
    return response.data;
  }

  async assignStampToTemplate(templateId: string, stampId: string, position?: { positionX?: number; positionY?: number; width?: number; height?: number; rotation?: number; opacity?: number }) {
    const response = await this.client.post(`/template-builder/templates/${templateId}/stamps`, { stampId, ...position });
    return response.data;
  }

  async updateTemplateStamp(templateStampId: string, data: any) {
    const response = await this.client.patch(`/template-builder/template-stamps/${templateStampId}`, data);
    return response.data;
  }

  async removeTemplateStamp(templateStampId: string) {
    const response = await this.client.delete(`/template-builder/template-stamps/${templateStampId}`);
    return response.data;
  }

  async createStampVerification(data: { documentId: string; documentType: string; stampId?: string; metadata?: any }) {
    const response = await this.client.post('/template-builder/stamps/verify', data);
    return response.data;
  }

  async verifyDocument(hash: string) {
    const response = await this.client.get(`/template-builder/stamps/verify/${hash}`);
    return response.data;
  }

  async getVerificationStatus(documentId: string) {
    const response = await this.client.get(`/template-builder/stamps/verify/document/${documentId}`);
    return response.data;
  }

  // ===== Profile API =====

  async getProfile() {
    const response = await this.client.get('/profile');
    const data = response.data;
    if (data?.photoUrl) data.photoUrl = resolveImageUrl(data.photoUrl) || data.photoUrl;
    return data;
  }

  async updateProfile(data: { firstName?: string; lastName?: string; email?: string; phone?: string }) {
    const response = await this.client.put('/profile', data);
    return response.data;
  }

  async uploadProfilePhoto(formData: FormData) {
    const response = await this.client.post('/profile/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async deleteProfilePhoto() {
    const response = await this.client.delete('/profile/photo');
    return response.data;
  }

  async changePassword(data: { currentPassword: string; newPassword: string }) {
    const response = await this.client.post('/profile/change-password', data);
    return response.data;
  }

  // ===== Security / Identity API =====

  async generatePassword(length?: number) {
    const response = await this.client.post('/identity/password/generate', { length });
    return response.data;
  }

  async forgotUsername(data: { email?: string; phone?: string }) {
    const response = await this.client.post('/identity/recovery/forgot-username', data);
    return response.data;
  }

  async sendOtp(data: { destination: string; channel: string; purpose: string }) {
    const response = await this.client.post('/identity/otp/send', data);
    return response.data;
  }

  async verifyOtp(data: { destination: string; otp: string; purpose: string }) {
    const response = await this.client.post('/identity/otp/verify', data);
    return response.data;
  }

  async getActiveSessions() {
    const response = await this.client.get('/identity/sessions');
    return response.data;
  }

  async getRegisteredDevices() {
    const response = await this.client.get('/identity/devices');
    return response.data;
  }

  async removeDevice(deviceId: string) {
    const response = await this.client.delete(`/identity/devices/${deviceId}`);
    return response.data;
  }

  async getPasswordHistory(_limit?: number) {
    return [];
  }

  async terminateSession(_sessionId: string) {
    return { success: true };
  }

  async toggleTrustDevice(_deviceId: string, _trusted: boolean) {
    return { success: true };
  }

  // ===== Student Photo API =====

  async uploadStudentPhoto(studentId: string, formData: FormData) {
    const response = await this.client.post(`/student-photo/upload/${studentId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async bulkUploadStudentPhotos(formData: FormData) {
    const response = await this.client.post('/student-photo/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async getStudentPhoto(studentId: string) {
    const response = await this.client.get(`/student-photo/${studentId}`);
    return response.data;
  }

  async getBatchStudentPhotos(studentIds: string[]) {
    const response = await this.client.get(`/student-photo/batch/${studentIds.join(',')}`);
    return response.data;
  }

  async deleteStudentPhoto(studentId: string) {
    const response = await this.client.delete(`/student-photo/${studentId}`);
    return response.data;
  }

  // ===== Exam API =====

  async getExams(filters?: Record<string, string>): Promise<Exam[]> {
    const response = await this.client.get('/exam', { params: filters });
    return response.data?.data || response.data || [];
  }

  async getExam(id: string): Promise<Exam> {
    const response = await this.client.get(`/exam/${id}`);
    return response.data?.data || response.data;
  }

  async createExam(data: Partial<Exam>): Promise<Exam> {
    const response = await this.client.post('/exam', data);
    return response.data?.data || response.data;
  }

  async updateExam(id: string, data: Partial<Exam>): Promise<Exam> {
    const response = await this.client.patch(`/exam/${id}`, data);
    return response.data?.data || response.data;
  }

  async deleteExam(id: string): Promise<void> {
    await this.client.delete(`/exam/${id}`);
  }

  async publishExam(id: string): Promise<void> {
    await this.client.post(`/exam/${id}/publish`);
  }

  async unpublishExam(id: string): Promise<void> {
    await this.client.post(`/exam/${id}/unpublish`);
  }

  async archiveExam(id: string): Promise<void> {
    await this.client.post(`/exam/${id}/archive`);
  }

  async getExamPreview(id: string): Promise<any> {
    const response = await this.client.get(`/exam/${id}/preview`);
    return response.data?.data || response.data;
  }

  // Sections
  async addExamSection(examId: string, data: { title: string; instructions?: string; order?: number }): Promise<any> {
    const response = await this.client.post(`/exam/${examId}/sections`, data);
    return response.data?.data || response.data;
  }

  async getExamSections(examId: string): Promise<any[]> {
    const response = await this.client.get(`/exam/${examId}/sections`);
    return response.data?.data || response.data || [];
  }

  async updateExamSection(sectionId: string, data: any): Promise<any> {
    const response = await this.client.patch(`/exam/sections/${sectionId}`, data);
    return response.data?.data || response.data;
  }

  async deleteExamSection(sectionId: string): Promise<void> {
    await this.client.delete(`/exam/sections/${sectionId}`);
  }

  // Questions
  async addQuestion(examId: string, data: Partial<ExamQuestion>): Promise<ExamQuestion> {
    const response = await this.client.post(`/exam/${examId}/questions`, data);
    return response.data?.data || response.data;
  }

  async updateQuestion(questionId: string, data: Partial<ExamQuestion>): Promise<ExamQuestion> {
    const response = await this.client.patch(`/exam/questions/${questionId}`, data);
    return response.data?.data || response.data;
  }

  async deleteQuestion(questionId: string): Promise<void> {
    await this.client.delete(`/exam/questions/${questionId}`);
  }

  async reorderQuestions(examId: string, order: { id: string; order: number }[]): Promise<void> {
    await this.client.post(`/exam/${examId}/questions/reorder`, { order });
  }

  async uploadQuestionFile(examId: string, formData: FormData): Promise<ExamQuestion> {
    const response = await this.client.post(`/exam/${examId}/upload-question`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data?.data || response.data;
  }

  // Attempts
  async startExamAttempt(examId: string, studentId?: string): Promise<ExamAttempt> {
    const response = await this.client.post(`/exam/${examId}/start`, { studentId });
    return response.data?.data || response.data;
  }

  async submitAnswer(attemptId: string, questionId: string, answer: string, timeSpent?: number): Promise<any> {
    const response = await this.client.post(`/exam/attempt/${attemptId}/answer`, { questionId, answer, timeSpent });
    return response.data?.data || response.data;
  }

  async submitExamAttempt(attemptId: string): Promise<ExamAttempt> {
    const response = await this.client.post(`/exam/attempt/${attemptId}/submit`);
    return response.data?.data || response.data;
  }

  async getExamAttempt(attemptId: string): Promise<ExamAttempt> {
    const response = await this.client.get(`/exam/attempt/${attemptId}`);
    return response.data?.data || response.data;
  }

  // Auto-Marking
  async autoMarkExam(examId: string): Promise<AutoMarkResult[]> {
    const response = await this.client.post(`/exam/${examId}/auto-mark`);
    return response.data?.data || response.data || [];
  }

  async autoMarkAttempt(attemptId: string): Promise<AutoMarkResult> {
    const response = await this.client.post(`/exam/attempt/${attemptId}/auto-mark`);
    return response.data?.data || response.data;
  }

  // Results
  async getExamResults(examId: string): Promise<ExamAttempt[]> {
    const response = await this.client.get(`/exam/${examId}/results`);
    return response.data?.data || response.data || [];
  }

  async getStudentExamResults(studentId?: string, filters?: Record<string, string>): Promise<ExamAttempt[]> {
    const response = await this.client.get('/exam/results/student', { params: { studentId, ...filters } });
    return response.data?.data || response.data || [];
  }

  // Stats
  async getExamStats(examId: string): Promise<ExamStats> {
    const response = await this.client.get(`/exam/${examId}/stats`);
    return response.data?.data || response.data;
  }

  // Question Bank
  async getBankQuestions(filters?: Record<string, string>): Promise<any[]> {
    const response = await this.client.get('/exam/bank/questions', { params: filters });
    return response.data?.data || response.data || [];
  }

  async createBankQuestion(data: any): Promise<any> {
    const response = await this.client.post('/exam/bank/questions', data);
    return response.data?.data || response.data;
  }

  async updateBankQuestion(id: string, data: any): Promise<any> {
    const response = await this.client.patch(`/exam/bank/questions/${id}`, data);
    return response.data?.data || response.data;
  }

  async deleteBankQuestion(id: string): Promise<void> {
    await this.client.delete(`/exam/bank/questions/${id}`);
  }

  async importFromBank(examId: string, questionIds: string[]): Promise<void> {
    await this.client.post(`/exam/${examId}/bank/import`, { questionIds });
  }

  async getBankCategories(subjectId?: string): Promise<any[]> {
    const response = await this.client.get('/exam/bank/categories', { params: { subjectId } });
    return response.data?.data || response.data || [];
  }

  async createBankCategory(data: any): Promise<any> {
    const response = await this.client.post('/exam/bank/categories', data);
    return response.data?.data || response.data;
  }

  async deleteBankCategory(id: string): Promise<void> {
    await this.client.delete(`/exam/bank/categories/${id}`);
  }

  // Exam Templates
  async getExamTemplates(subjectId?: string): Promise<any[]> {
    const response = await this.client.get('/exam/templates', { params: { subjectId } });
    return response.data?.data || response.data || [];
  }

  async getExamTemplate(id: string): Promise<any> {
    const response = await this.client.get(`/exam/templates/${id}`);
    return response.data?.data || response.data;
  }

  async createExamTemplate(data: any): Promise<any> {
    const response = await this.client.post('/exam/templates', data);
    return response.data?.data || response.data;
  }

  async updateExamTemplate(id: string, data: any): Promise<any> {
    const response = await this.client.patch(`/exam/templates/${id}`, data);
    return response.data?.data || response.data;
  }

  async deleteExamTemplate(id: string): Promise<void> {
    await this.client.delete(`/exam/templates/${id}`);
  }

  async applyExamTemplate(examId: string, templateId: string): Promise<void> {
    await this.client.post(`/exam/${examId}/apply-template`, { templateId });
  }

  // Uploaded Exams
  async uploadExam(formData: FormData): Promise<UploadedExam> {
    const response = await this.client.post('/exam/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data?.data || response.data;
  }

  async getUploadedExams(): Promise<UploadedExam[]> {
    const response = await this.client.get('/exam/uploaded/list');
    return response.data?.data || response.data || [];
  }

  async getUploadedExam(id: string): Promise<UploadedExam> {
    const response = await this.client.get(`/exam/uploaded/${id}`);
    return response.data?.data || response.data;
  }

  async updateUploadedExam(id: string, data: any): Promise<UploadedExam> {
    const response = await this.client.patch(`/exam/uploaded/${id}`, data);
    return response.data?.data || response.data;
  }

  async deleteUploadedExam(id: string): Promise<void> {
    await this.client.delete(`/exam/uploaded/${id}`);
  }

  async uploadAnswerScript(id: string, formData: FormData): Promise<any> {
    const response = await this.client.post(`/exam/uploaded/${id}/answer-script`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data?.data || response.data;
  }

  async parseExamDoc(id: string): Promise<any> {
    const response = await this.client.post(`/exam/uploaded/${id}/parse`);
    return response.data?.data || response.data;
  }

  async getUploadedExamPreview(id: string): Promise<any> {
    const response = await this.client.get(`/exam/uploaded/${id}/preview`);
    return response.data?.data || response.data;
  }

  // ===== Digital Stamps API =====

  async getStamps() {
    const response = await this.client.get('/stamps');
    return response.data?.stamps ?? response.data;
  }

  async getStampedDocuments() {
    const response = await this.client.get('/stamps/documents');
    return response.data?.documents ?? response.data;
  }

  async getApprovalRequests() {
    const response = await this.client.get('/stamps/approvals');
    return response.data?.requests ?? response.data;
  }

  async applyStamp(data: { documentId: string; stampId: string; note?: string }) {
    const response = await this.client.post('/stamps/apply', data);
    return response.data;
  }

  async approveDocument(requestId: string, data: { approved: boolean; note?: string }) {
    const response = await this.client.post(`/stamps/approvals/${requestId}`, data);
    return response.data;
  }

  async requestApproval(data: { documentId: string; note?: string }) {
    const response = await this.client.post('/stamps/request-approval', data);
    return response.data;
  }

  async verifyDocument(hash: string) {
    const response = await this.client.get(`/stamps/verify/${hash}`);
    return response.data;
  }

  async getDocumentPDF(documentId: string) {
    const response = await this.client.get(`/stamps/documents/${documentId}/pdf`);
    return response.data;
  }

  async getApprovalWorkflows() {
    const response = await this.client.get('/stamps/workflows');
    return response.data?.workflows ?? response.data;
  }

  async createApprovalWorkflow(data: { documentId: string; documentName: string; documentType: string }) {
    const response = await this.client.post('/stamps/workflows', data);
    return response.data;
  }

  async processApprovalStep(workflowId: string, stepId: string, data: { approved: boolean; note?: string }) {
    const response = await this.client.post(`/stamps/workflows/${workflowId}/steps/${stepId}`, data);
    return response.data;
  }

  async uploadStamp(formData: FormData) {
    const response = await this.client.post('/stamps/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async deleteStamp(id: string) {
    const response = await this.client.delete(`/stamps/${id}`);
    return response.data;
  }

  async getStampVerificationStatus(documentId: string) {
    const response = await this.client.get(`/stamps/verify/document/${documentId}`);
    return response.data;
  }

  // ===== Assessment Engine API =====

  async getAssessmentDefinitions() {
    const response = await this.client.get('/assessment-engine/definitions');
    return response.data;
  }

  async getAssessmentConfigurations(classId: string, subjectId: string, termId: string) {
    const response = await this.client.get('/assessment-engine/configurations', {
      params: { classId, subjectId, termId },
    });
    return response.data;
  }

  async updateAssessmentConfiguration(
    classId: string,
    subjectId: string,
    termId: string,
    assessmentDefId: string,
    weight: number
  ) {
    const response = await this.client.put('/assessment-engine/configurations', {
      classId,
      subjectId,
      termId,
      assessmentDefId,
      weightPercentage: weight,
    });
    return response.data;
  }

  async getClassAssessmentResults(classId: string, subjectId: string, termId: string, assessmentDefId?: string) {
    const params: any = { classId, subjectId, termId };
    if (assessmentDefId) params.assessmentDefId = assessmentDefId;
    const response = await this.client.get('/assessment-engine/results/class', { params });
    return response.data;
  }

  async getStudentAssessmentResults(studentId: string, termId?: string) {
    const params: any = {};
    if (termId) params.termId = termId;
    const response = await this.client.get(`/assessment-engine/results/student/${studentId}`, { params });
    return response.data;
  }

  async submitAssessmentScore(data: {
    studentId: string;
    subjectId: string;
    termId: string;
    classId: string;
    assessmentDefId: string;
    rawScore: number | null;
    maxScore?: number;
    remarks?: string;
  }) {
    const response = await this.client.post('/assessment-engine/scores', data);
    return response.data;
  }

  async submitBulkAssessmentScores(data: {
    classId: string;
    subjectId: string;
    termId: string;
    assessmentDefId: string;
    maxScore: number;
    title?: string;
    scores: { studentId: string; rawScore: number | null; remarks?: string }[];
  }) {
    const response = await this.client.post('/assessment-engine/scores/bulk', data);
    return response.data;
  }

  async getPendingAssessments() {
    const response = await this.client.get('/assessment-engine/teacher/pending');
    return response.data;
  }

  async getAssessmentCompletionStats(classId: string, subjectId: string, termId: string) {
    const response = await this.client.get('/assessment-engine/completion-stats', {
      params: { classId, subjectId, termId },
    });
    return response.data;
  }

  async getBatchResults(batchId: string) {
    const response = await this.client.get(`/assessment-engine/batches/${batchId}`);
    return response.data;
  }

  async verifyBatch(batchId: string) {
    const response = await this.client.post(`/assessment-engine/batches/${batchId}/verify`);
    return response.data;
  }

  async lockBatch(batchId: string) {
    const response = await this.client.post(`/assessment-engine/batches/${batchId}/lock`);
    return response.data;
  }

  // ===== Grading Engine API =====

  async getGradingPolicies() {
    const response = await this.client.get('/grading-engine/policies');
    return response.data;
  }

  // ===== Result Analytics API =====

  async getClassAnalytics(classId: string, termId: string) {
    const response = await this.client.get('/result-analytics/class', {
      params: { classId, termId },
    });
    return response.data;
  }

  async getAtRiskStudents(classId: string, termId: string) {
    const response = await this.client.get('/result-analytics/at-risk', {
      params: { classId, termId },
    });
    return response.data;
  }

  async getTopPerformers(classId: string, termId: string, limit = 10) {
    const response = await this.client.get('/ranking/top-performers', {
      params: { classId, termId, limit },
    });
    return response.data;
  }

  // ===== Report Card Engine API =====

  async getReportCardData(studentId: string, termId: string) {
    const response = await this.client.get(`/report-card-engine/student/${studentId}`, {
      params: { termId },
    });
    return response.data;
  }

  async getReportCardStatus(classId: string, termId: string) {
    const response = await this.client.get('/report-card-engine/status', {
      params: { classId, termId },
    });
    return response.data;
  }

  async getRemarks(type?: string) {
    const params: any = {};
    if (type) params.type = type;
    const response = await this.client.get('/report-card-engine/remarks', { params });
    return response.data;
  }

  // ===== Sync Engine API =====

  async enqueueSync(data: {
    operationType: string;
    entityType: string;
    entityId?: string;
    payload: any;
    priority?: number;
  }) {
    const response = await this.client.post('/sync-engine/enqueue', data);
    return response.data;
  }

  async enqueueBatchSync(items: any[]) {
    const response = await this.client.post('/sync-engine/enqueue-batch', { items });
    return response.data;
  }

  async getPendingSyncs(limit = 50) {
    const response = await this.client.get('/sync-engine/pending', { params: { limit } });
    return response.data;
  }

  async getSyncStatus() {
    const response = await this.client.get('/sync-engine/status');
    return response.data;
  }

  // ===== Library API =====

  async getLibraryDocuments() {
    const response = await this.client.get('/library');
    return response.data;
  }

  async getLibraryDocument(id: string) {
    const response = await this.client.get(`/library/${id}`);
    return response.data;
  }

  async createLibraryDocument(data: { title: string; description?: string; category: string; fileType?: string }) {
    const response = await this.client.post('/library', data);
    return response.data;
  }

  async updateLibraryDocument(id: string, data: { title?: string; description?: string; category?: string }) {
    const response = await this.client.patch(`/library/${id}`, data);
    return response.data;
  }

  async deleteLibraryDocument(id: string) {
    const response = await this.client.delete(`/library/${id}`);
    return response.data;
  }

  async uploadLibraryFile(id: string, formData: FormData) {
    const response = await this.client.post(`/library/${id}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async getLibraryDownloadUrl(id: string) {
    const response = await this.client.get(`/library/${id}/download`, { responseType: 'blob' });
    return response.data;
  }

  async logReadingSession(documentId: string, data: { durationSeconds: number; pagesViewed: string[]; completedAt: string }) {
    const response = await this.client.post(`/library/${documentId}/reading-session`, data);
    return response.data;
  }

  // ===== Communication API =====

  async getCommunications(params?: { type?: string; status?: string; limit?: number; offset?: number }) {
    const response = await this.client.get('/communications', { params });
    return response.data;
  }

  async getCommunicationById(id: string) {
    const response = await this.client.get(`/communications/${id}`);
    return response.data;
  }

  async createCommunication(data: { type: string; subject?: string; message: string; recipientType?: string; recipientIds?: string[]; scheduledAt?: Date }) {
    const response = await this.client.post('/communications', data);
    return response.data;
  }

  async sendCommunication(id: string) {
    const response = await this.client.post(`/communications/${id}/send`);
    return response.data;
  }

  async sendBulkCommunication(id: string, recipientIds: string[]) {
    const response = await this.client.post(`/communications/${id}/send-bulk`, { recipientIds });
    return response.data;
  }

  async deleteCommunication(id: string) {
    const response = await this.client.delete(`/communications/${id}`);
    return response.data;
  }

  async getCommunicationStats(startDate?: string, endDate?: string) {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const response = await this.client.get('/communications/stats', { params });
    return response.data;
  }

  async scheduleCommunication(data: { type: string; subject?: string; message: string; recipientType?: string; scheduledAt: Date }) {
    const response = await this.client.post('/communications/schedule', data);
    return response.data;
  }

  async getCommunicationTemplates() {
    const response = await this.client.get('/communications/templates/list');
    return response.data;
  }

  async createCommunicationTemplate(data: { name: string; type: string; subject?: string; message: string }) {
    const response = await this.client.post('/communications/templates', data);
    return response.data;
  }

  // ===== Curriculum API =====

  async getEducationLevels(schoolId?: string) {
    const response = await this.client.get('/curriculum/education-levels', { params: { schoolId } });
    return response.data;
  }

  async getCurriculumVersions(educationLevelId?: string, schoolId?: string) {
    const response = await this.client.get('/curriculum/versions', { params: { educationLevelId, schoolId } });
    return response.data;
  }

  async getAcademicStages(educationLevelId?: string, curriculumVersionId?: string, schoolId?: string) {
    const response = await this.client.get('/curriculum/stages', { params: { educationLevelId, curriculumVersionId, schoolId } });
    return response.data;
  }

  async getGrade7Results(params?: { studentId?: string; termId?: string; schoolId?: string }) {
    const response = await this.client.get('/curriculum/grade7/results', { params });
    return response.data;
  }

  async computeGrade7(studentId: string, termId: string) {
    const response = await this.client.post(`/curriculum/grade7/compute/${studentId}/${termId}`);
    return response.data;
  }

  async batchComputeGrade7(classId: string, termId: string) {
    const response = await this.client.post(`/curriculum/grade7/batch/${classId}/${termId}`);
    return response.data;
  }

  async rankGrade7(schoolId: string, termId: string) {
    const response = await this.client.post(`/curriculum/grade7/rank/${schoolId}/${termId}`);
    return response.data;
  }

  async analyzeClassSelection(classId: string, termId: string) {
    const response = await this.client.get(`/curriculum/selection/class/${classId}/${termId}`);
    return response.data;
  }

  async getSchoolSelectionProfile(schoolId: string) {
    const response = await this.client.get(`/curriculum/selection/school-profile/${schoolId}`);
    return response.data;
  }

  // ===== Grade7 ECZ Engine (new module) =====

  async getGrade7Classes() {
    const response = await this.client.get('/grade7-ecz/classes');
    return response.data;
  }

  async createMockExam(data: {
    classId: string; termId: string; subjectId: string; title: string;
    paperType: 'SP1' | 'SP2' | 'MOCK'; duration: number; totalScore: number;
    instructions?: string; questions?: any[];
  }) {
    const response = await this.client.post('/grade7-ecz/mock-exam', data);
    return response.data;
  }

  async getMockExams(classId?: string) {
    const response = await this.client.get('/grade7-ecz/mock-exams', { params: { classId } });
    return response.data;
  }

  async getMockExamResults(id: string) {
    const response = await this.client.get(`/grade7-ecz/mock-exams/${id}/results`);
    return response.data;
  }

  async enterGrade7Score(data: { examId: string; studentId: string; score: number; totalScore?: number }) {
    const response = await this.client.post('/grade7-ecz/enter-score', data);
    return response.data;
  }

  async enterBulkGrade7Scores(data: { examId: string; scores: Array<{ studentId: string; score: number }> }) {
    const response = await this.client.post('/grade7-ecz/enter-bulk-scores', data);
    return response.data;
  }

  async computeGrade7Results(classId: string, termId: string) {
    const response = await this.client.post(`/grade7-ecz/compute/${classId}/${termId}`);
    return response.data;
  }

  async getGrade7ComputedResults(classId: string, termId: string) {
    const response = await this.client.get(`/grade7-ecz/results/${classId}/${termId}`);
    return response.data;
  }

  async rankGrade7Results(schoolId: string, termId: string) {
    const response = await this.client.post(`/grade7-ecz/rank/${schoolId}/${termId}`);
    return response.data;
  }

  async getGrade7Prediction(classId: string, termId: string) {
    const response = await this.client.get(`/grade7-ecz/prediction/${classId}/${termId}`);
    return response.data;
  }

  async getCurriculumTree(schoolId?: string) {
    const response = await this.client.get('/curriculum/tree', { params: { schoolId } });
    return response.data;
  }

  // ========== STAFF POSITIONS & HIERARCHY ==========

  async getDepartments() {
    const response = await this.client.get('/mobile/staff-positions/departments');
    return response.data;
  }

  async getStaffHierarchy() {
    const response = await this.client.get('/mobile/staff-positions/hierarchy');
    return response.data;
  }

  async getMyMonitoringChain() {
    const response = await this.client.get('/mobile/staff-positions/monitoring-chain');
    return response.data;
  }

  async getDepartmentTeachers(departmentId: string) {
    const response = await this.client.get(`/mobile/staff-positions/department/${departmentId}/teachers`);
    return response.data;
  }

  async getStaffPositions(positionType?: string) {
    const response = await this.client.get('/mobile/staff-positions/positions', {
      params: { positionType },
    });
    return response.data;
  }

  // ===== System Communications API (SuperAdmin) =====

  async getSystemCommunicationsDashboard() {
    const response = await this.client.get('/system-communications/dashboard');
    return response.data;
  }

  async getSystemProviders() {
    const response = await this.client.get('/system-communications/providers');
    return response.data;
  }

  async addSystemProvider(data: {
    name: string; type: string; credentials: string;
    isDefault?: boolean; priority?: number;
  }) {
    const response = await this.client.post('/system-communications/providers', data);
    return response.data;
  }

  async updateSystemProvider(id: string, data: any) {
    const response = await this.client.patch(`/system-communications/providers/${id}`, data);
    return response.data;
  }

  async deleteSystemProvider(id: string) {
    const response = await this.client.delete(`/system-communications/providers/${id}`);
    return response.data;
  }

  async testSystemProviderConnection(id: string) {
    const response = await this.client.post(`/system-communications/providers/${id}/test`);
    return response.data;
  }

  async getSystemTemplates() {
    const response = await this.client.get('/system-communications/templates');
    return response.data;
  }

  async createSystemTemplate(data: {
    name: string; type: string; scope: string;
    category?: string; subject?: string; body: string;
    variables?: string[];
  }) {
    const response = await this.client.post('/system-communications/templates', data);
    return response.data;
  }

  async updateSystemTemplate(id: string, data: any) {
    const response = await this.client.patch(`/system-communications/templates/${id}`, data);
    return response.data;
  }

  async deleteSystemTemplate(id: string) {
    const response = await this.client.delete(`/system-communications/templates/${id}`);
    return response.data;
  }

  async getSystemBroadcasts() {
    const response = await this.client.get('/system-communications/broadcasts');
    return response.data;
  }

  async createSystemBroadcast(data: {
    title: string; message: string; type: string;
    scheduledAt?: string; targetAudience?: string;
  }) {
    const response = await this.client.post('/system-communications/broadcasts', data);
    return response.data;
  }

  async launchSystemBroadcast(id: string) {
    const response = await this.client.post(`/system-communications/broadcasts/${id}/launch`);
    return response.data;
  }

  async getSystemCampaigns() {
    const response = await this.client.get('/system-communications/campaigns');
    return response.data;
  }

  async createSystemCampaign(data: {
    name: string; type: string; templateId?: string;
    scheduledAt?: string; targetFilters?: any;
  }) {
    const response = await this.client.post('/system-communications/campaigns', data);
    return response.data;
  }

  async launchSystemCampaign(id: string) {
    const response = await this.client.post(`/system-communications/campaigns/${id}/launch`);
    return response.data;
  }

  async pauseSystemCampaign(id: string) {
    const response = await this.client.post(`/system-communications/campaigns/${id}/pause`);
    return response.data;
  }

  async deleteSystemCampaign(id: string) {
    const response = await this.client.delete(`/system-communications/campaigns/${id}`);
    return response.data;
  }

  async getSystemNotifications(params?: { status?: string; limit?: number; offset?: number }) {
    const response = await this.client.get('/system-communications/notifications', { params });
    return response.data;
  }

  async getSystemNotificationStats() {
    const response = await this.client.get('/system-communications/notifications/stats');
    return response.data;
  }

  async getSystemAnalytics(params?: { from?: string; to?: string; groupBy?: string }) {
    const response = await this.client.get('/system-communications/analytics', { params });
    return response.data;
  }

  async getSystemDeliveryLogs(params?: { status?: string; provider?: string; limit?: number; offset?: number }) {
    const response = await this.client.get('/system-communications/delivery-logs', { params });
    return response.data;
  }

  async getSystemScheduledMessages() {
    const response = await this.client.get('/system-communications/scheduled');
    return response.data;
  }

  async cancelSystemScheduledMessage(id: string) {
    const response = await this.client.post(`/system-communications/scheduled/${id}/cancel`);
    return response.data;
  }

  async getSystemYouTubeChannels() {
    const response = await this.client.get('/system-communications/youtube');
    return response.data;
  }

  async addSystemYouTubeChannel(data: { name: string; channelId: string; description?: string }) {
    const response = await this.client.post('/system-communications/youtube', data);
    return response.data;
  }

  async updateSystemYouTubeChannel(id: string, data: any) {
    const response = await this.client.patch(`/system-communications/youtube/${id}`, data);
    return response.data;
  }

  async deleteSystemYouTubeChannel(id: string) {
    const response = await this.client.delete(`/system-communications/youtube/${id}`);
    return response.data;
  }

  async getSystemCommunicationStats(params?: { from?: string; to?: string }) {
    const response = await this.client.get('/system-communications/stats', { params });
    return response.data;
  }

  async getSystemProviderStatus() {
    const response = await this.client.get('/system-communications/status');
    return response.data;
  }

  async getSystemBeemDashboard() {
    const response = await this.client.get('/system-communications/beem');
    return response.data;
  }

  // ===== SuperAdmin Schools API =====

  async getSuperAdminSchools(params?: { status?: string; page?: number; limit?: number; search?: string }) {
    const response = await this.client.get('/super-admin/schools', { params });
    return response.data;
  }

  async getSuperAdminSchoolById(id: string) {
    const response = await this.client.get(`/super-admin/schools/${id}`);
    return response.data;
  }

  async createSuperAdminSchool(data: any) {
    const response = await this.client.post('/super-admin/schools', data);
    return response.data;
  }

  async updateSuperAdminSchool(id: string, data: any) {
    const response = await this.client.patch(`/super-admin/schools/${id}`, data);
    return response.data;
  }

  async activateSuperAdminSchool(id: string) {
    const response = await this.client.post(`/super-admin/schools/${id}/activate`);
    return response.data;
  }

  async deactivateSuperAdminSchool(id: string) {
    const response = await this.client.post(`/super-admin/schools/${id}/deactivate`);
    return response.data;
  }

  async deleteSuperAdminSchool(id: string) {
    const response = await this.client.delete(`/super-admin/schools/${id}`);
    return response.data;
  }

  async updateSuperAdminSchoolSubscription(id: string, data: { status?: string; trialEndDate?: string }) {
    const response = await this.client.put(`/super-admin/schools/${id}/subscription`, data);
    return response.data;
  }

  async getSuperAdminSchoolDirectors(schoolId: string) {
    const response = await this.client.get(`/super-admin/schools/${schoolId}/directors`);
    return response.data;
  }

  async createSuperAdminSchoolDirector(schoolId: string, data: any) {
    const response = await this.client.post(`/super-admin/schools/${schoolId}/directors`, data);
    return response.data;
  }

  async sendSchoolDirectorLoginLink(schoolId: string, directorId: string, method?: string) {
    const response = await this.client.post(`/super-admin/schools/${schoolId}/directors/${directorId}/send-link`, { method });
    return response.data;
  }

  async getSuperAdminSchoolUsers(schoolId: string) {
    const response = await this.client.get(`/super-admin/schools/${schoolId}/users`);
    return response.data;
  }

  // ===== SuperAdmin Stats & Settings =====

  async getSuperAdminStats() {
    const response = await this.client.get('/super-admin/stats');
    return response.data;
  }

  async getSuperAdminSettings() {
    const response = await this.client.get('/super-admin/settings');
    return response.data;
  }

  async getSuperAdminPublicSettings() {
    const response = await this.client.get('/super-admin/settings/public');
    return response.data;
  }

  async updateSuperAdminSetting(key: string, value: any, isPublic?: boolean) {
    const response = await this.client.put('/super-admin/settings', { key, value, isPublic });
    return response.data;
  }

  async getSuperAdminAuditLogs(params?: { schoolId?: string; limit?: number }) {
    const response = await this.client.get('/super-admin/audit-logs', { params });
    return response.data;
  }

  // ===== Subscription Plans API =====

  async getSubscriptionPlans() {
    const response = await this.client.get('/subscription/plans');
    return response.data;
  }

  async createSubscriptionPlan(data: any) {
    const response = await this.client.post('/subscription/plans', data);
    return response.data;
  }

  async updateSubscriptionPlan(id: string, data: any) {
    const response = await this.client.patch(`/subscription/plans/${id}`, data);
    return response.data;
  }

  async deleteSubscriptionPlan(id: string) {
    const response = await this.client.delete(`/subscription/plans/${id}`);
    return response.data;
  }

  // ===== SuperAdmin Institution Types API =====

  async getSuperAdminInstitutionTypes() {
    const response = await this.client.get('/super-admin/institution-types');
    return response.data;
  }

  // ===== Curriculum Intelligence Engine API =====

  async getTopics(subjectId?: string, academicStageId?: string) {
    const response = await this.client.get('/curriculum-intelligence/topics', { params: { subjectId, academicStageId } });
    return response.data;
  }

  async getTopic(id: string) {
    const response = await this.client.get(`/curriculum-intelligence/topics/${id}`);
    return response.data;
  }

  async createTopic(data: { name: string; subjectId: string; code?: string; description?: string; academicStageId?: string }) {
    const response = await this.client.post('/curriculum-intelligence/topics', data);
    return response.data;
  }

  async getSubtopics(topicId: string) {
    const response = await this.client.get(`/curriculum-intelligence/topics/${topicId}/subtopics`);
    return response.data;
  }

  async createSubtopic(data: { name: string; topicId: string; code?: string; description?: string }) {
    const response = await this.client.post('/curriculum-intelligence/subtopics', data);
    return response.data;
  }

  async getCompetencies(subjectId?: string, topicId?: string, eocId?: string) {
    const response = await this.client.get('/curriculum-intelligence/competencies', { params: { subjectId, topicId, eocId } });
    return response.data;
  }

  async createCompetency(data: { name: string; subjectId?: string; topicId?: string; bloomLevel?: string; category?: string; eocId?: string }) {
    const response = await this.client.post('/curriculum-intelligence/competencies', data);
    return response.data;
  }

  async getElementsOfConstruct(subjectId: string) {
    const response = await this.client.get(`/curriculum-intelligence/subjects/${subjectId}/elements-of-construct`);
    return response.data;
  }

  async createElementOfConstruct(data: { name: string; subjectId: string; construct?: string; sortOrder?: number }) {
    const response = await this.client.post('/curriculum-intelligence/elements-of-construct', data);
    return response.data;
  }

  async getLearningOutcomes(subjectId?: string, topicId?: string) {
    const response = await this.client.get('/curriculum-intelligence/learning-outcomes', { params: { subjectId, topicId } });
    return response.data;
  }

  async createLearningOutcome(data: { name: string; subjectId?: string; topicId?: string; bloomLevel?: string }) {
    const response = await this.client.post('/curriculum-intelligence/learning-outcomes', data);
    return response.data;
  }

  async getSubjectTree(subjectId: string) {
    const response = await this.client.get(`/curriculum-intelligence/subjects/${subjectId}/tree`);
    return response.data;
  }

  async getCurriculumContext(schoolId: string, subjectId: string, topicId?: string) {
    const response = await this.client.get(`/curriculum-intelligence/ai-context/${schoolId}/${subjectId}/${topicId || ''}`);
    return response.data;
  }

  async generateExamQuestions(data: { subjectId: string; questionType: string; count?: number; topicId?: string; bloomLevel?: string; totalMarks?: number }) {
    const response = await this.client.post('/curriculum-intelligence/generate/questions', data);
    return response.data;
  }

  async generateExamPaper(data: { subjectId: string; academicStageId: string; totalMarks?: number }) {
    const response = await this.client.post('/curriculum-intelligence/generate/exam-paper', data);
    return response.data;
  }

  async getSbaTasks(subjectId?: string) {
    const response = await this.client.get('/curriculum-intelligence/sba/tasks', { params: { subjectId } });
    return response.data;
  }

  async createSbaTask(data: { title: string; taskNumber: number; subjectId: string; maxMarks?: number; weight?: number; termId?: string }) {
    const response = await this.client.post('/curriculum-intelligence/sba/tasks', data);
    return response.data;
  }

  async generateSbaTemplate(subjectId: string) {
    const response = await this.client.get(`/curriculum-intelligence/sba/templates/${subjectId}`);
    return response.data;
  }

  async createLessonPlan(data: { title: string; subjectId: string; topicId?: string; classId?: string; duration?: number; weekNumber?: number }) {
    const response = await this.client.post('/curriculum-intelligence/lesson-plans', data);
    return response.data;
  }

  async generateLessonPlan(data: { subjectId: string; topicId: string; classId?: string; duration?: number }) {
    const response = await this.client.post('/curriculum-intelligence/lesson-plans/generate', data);
    return response.data;
  }

  async getLessonPlans(teacherId?: string, subjectId?: string, classId?: string) {
    const response = await this.client.get('/curriculum-intelligence/lesson-plans', { params: { teacherId, subjectId, classId } });
    return response.data;
  }

  async markCurriculumCoverage(data: { classId: string; subjectId: string; topicId: string; percentage?: number; notes?: string }) {
    const response = await this.client.post('/curriculum-intelligence/coverage', data);
    return response.data;
  }

  async getCoverageReport(classId: string, subjectId: string, termId?: string) {
    const response = await this.client.get(`/curriculum-intelligence/coverage/report/${classId}/${subjectId}`, { params: { termId } });
    return response.data;
  }

  async getCurriculumCompliance(schoolId: string) {
    const response = await this.client.get(`/curriculum-intelligence/analytics/curriculum-compliance/${schoolId}`);
    return response.data;
  }

  async getSubjectAnalytics(subjectId: string, schoolId?: string, classId?: string) {
    const response = await this.client.get(`/curriculum-intelligence/analytics/subject/${subjectId}`, { params: { schoolId, classId } });
    return response.data;
  }

  // Composite Subject API
  async getCompositeSubjects(params?: { curriculumId?: string; schoolId?: string; isActive?: boolean }) {
    const response = await this.client.get('/composite-subjects', { params });
    return response.data;
  }

  async getCompositeSubject(id: string) {
    const response = await this.client.get(`/composite-subjects/${id}`);
    return response.data;
  }

  async createCompositeSubject(data: {
    name: string;
    code: string;
    curriculumId: string;
    calculationMethod?: string;
    schoolId?: string;
    components: { subjectId: string; weight: number }[];
  }) {
    const response = await this.client.post('/composite-subjects', data);
    return response.data;
  }

  async updateCompositeSubject(id: string, data: {
    name?: string;
    code?: string;
    calculationMethod?: string;
    isActive?: boolean;
    components?: { subjectId: string; weight: number }[];
  }) {
    const response = await this.client.put(`/composite-subjects/${id}`, data);
    return response.data;
  }

  async deleteCompositeSubject(id: string) {
    const response = await this.client.delete(`/composite-subjects/${id}`);
    return response.data;
  }

  async recomputeCompositeSubject(id: string, data: { classId: string; termId: string; schoolId: string; studentIds?: string[] }) {
    const response = await this.client.post(`/composite-subjects/${id}/recompute`, data);
    return response.data;
  }

  async getCompositeForStudent(studentId: string, termId: string, schoolId: string, classId: string) {
    const response = await this.client.get(`/composite-subjects/student/${studentId}/${termId}`, {
      params: { schoolId, classId },
    });
    return response.data;
  }

  // ===== Parent-specific data endpoints =====

  async getParentHomework(studentId: string) {
    const response = await this.client.get(`/parent/children/${studentId}/homework`);
    return response.data;
  }

  async getParentAttendance(studentId: string) {
    const response = await this.client.get(`/parent/children/${studentId}/attendance`);
    return response.data;
  }

  async getParentAssessmentResults(studentId: string, termId?: string) {
    const params = termId ? { termId } : {};
    const response = await this.client.get(`/assessment-engine/results/student/${studentId}`, { params });
    return response.data;
  }

  async getParentAnalytics(studentId: string) {
    const response = await this.client.get(`/intelligence/trends/student/${studentId}`);
    return response.data;
  }

  async getParentStudentStats(studentId: string) {
    const response = await this.client.get(`/intelligence/descriptive-stats/student/${studentId}`);
    return response.data;
  }

  async getParentCompetencyDiagnosis(studentId: string, termId: string) {
    const response = await this.client.get(`/intelligence/diagnostic/competency/${studentId}`, { params: { termId } });
    return response.data;
  }

  async getParentRecommendations(studentId: string, termId: string) {
    const response = await this.client.get(`/intelligence/recommendations/student/${studentId}`, { params: { termId } });
    return response.data;
  }
}

export const apiService = new ApiService();
