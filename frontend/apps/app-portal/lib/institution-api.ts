import { api } from './api';

export const institutionApi = {
  getTypes: () => api.get('/institution/types'),
  getTypeByCode: (code: string) => api.get(`/institution/types/${code}`),
  getTypeModules: (code: string) => api.get(`/institution/types/${code}/modules`),
  getTypeRoles: (code: string) => api.get(`/institution/types/${code}/roles`),
  getTypeDashboards: (code: string) => api.get(`/institution/types/${code}/dashboards`),
  getTypeFeatures: (code: string) => api.get(`/institution/types/${code}/features`),
  getTypeSettings: (code: string) => api.get(`/institution/types/${code}/settings`),
  registerInstitution: (data: {
    institutionName: string;
    institutionType: string;
    directorFirstName: string;
    directorLastName: string;
    email: string;
    password: string;
    phone?: string;
    address?: string;
  }) => api.post('/institution/register', data),
  getSchoolModules: (schoolId: string) => api.get(`/institution/${schoolId}/modules`),
  getSchoolFeatures: (schoolId: string) => api.get(`/institution/${schoolId}/features`),
  getSchoolRoles: (schoolId: string) => api.get(`/institution/${schoolId}/roles`),
  getSchoolType: (schoolId: string) => api.get(`/institution/${schoolId}/type`),
  getSuperAdminTypes: () => api.get('/super-admin/institution-types'),
};
