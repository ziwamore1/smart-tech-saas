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
}

export const apiService = new ApiService();
