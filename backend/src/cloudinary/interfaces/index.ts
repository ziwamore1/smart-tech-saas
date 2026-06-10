export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  resourceType: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  format?: string;
  folder: string;
}

export interface CloudinaryFolderMap {
  schools: {
    logos: string;
    banners: string;
    documents: string;
  };
  users: {
    students: string;
    teachers: string;
    parents: string;
    directors: string;
    superadmins: string;
  };
  assignments: string;
  homework: string;
  projects: string;
  examinations: string;
  reportCards: string;
  certificates: string;
  signatures: string;
  qrCodes: string;
  aiContent: string;
  system: string;
}

export interface MediaResponse {
  id: string;
  publicId: string;
  url: string;
  resourceType: string;
  mimeType: string;
  size: number;
  folder: string;
  uploadedBy: string;
  createdAt: Date;
}

export interface SignedUploadPayload {
  signature: string;
  timestamp: number;
  publicId?: string;
  folder?: string;
  transformation?: string;
}
