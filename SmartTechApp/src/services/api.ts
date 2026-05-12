import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LoginResponse,
  MobileLoginRequest,
  DashboardData,
  Notification,
  StudentTimetable,
  TeacherTimetable,
} from '../types';

const API_BASE_URL = 'http://localhost:3000/api/v1';

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
      if (!this.token) {
        this.token = await AsyncStorage.getItem('access_token');
      }
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
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

  async login(data: MobileLoginRequest): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/auth/mobile-login', data);
    await AsyncStorage.setItem('access_token', response.data.access_token);
    await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
    this.token = response.data.access_token;
    return response.data;
  }

  async logout() {
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('user');
    this.token = null;
  }

  async getDashboard(): Promise<DashboardData> {
    const response = await this.client.get<DashboardData>('/mobile/dashboard');
    return response.data;
  }

  async getProfile() {
    const response = await this.client.get('/mobile/profile');
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

  async getParentChildResults(studentId: string, termId: string) {
    const response = await this.client.get(`/parent/results/${studentId}/${termId}`);
    return response.data;
  }

  async getParentReportCard(studentId: string, termId: string) {
    const response = await this.client.get(`/parent/report-card/${studentId}/${termId}/pdf`, {
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
}

export const apiService = new ApiService();
