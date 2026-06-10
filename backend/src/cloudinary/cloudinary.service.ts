import { Inject, Injectable, Logger } from '@nestjs/common';
import type { UploadApiOptions, UploadApiResponse, DeleteApiResponse } from 'cloudinary';
import { CLOUDINARY_TOKEN } from './cloudinary.provider';
import type { CloudinaryUploadResult } from './interfaces';
import { Readable } from 'stream';

const BASE_FOLDER = 'smarttech';

export const FOLDERS = {
  schools: { logos: `${BASE_FOLDER}/schools/logos`, banners: `${BASE_FOLDER}/schools/banners`, documents: `${BASE_FOLDER}/schools/documents` },
  users: { students: `${BASE_FOLDER}/users/students`, teachers: `${BASE_FOLDER}/users/teachers`, parents: `${BASE_FOLDER}/users/parents`, directors: `${BASE_FOLDER}/users/directors`, superadmins: `${BASE_FOLDER}/users/superadmins` },
  assignments: `${BASE_FOLDER}/assignments`,
  homework: `${BASE_FOLDER}/homework`,
  projects: `${BASE_FOLDER}/projects`,
  examinations: `${BASE_FOLDER}/examinations`,
  reportCards: `${BASE_FOLDER}/report-cards`,
  certificates: `${BASE_FOLDER}/certificates`,
  signatures: `${BASE_FOLDER}/signatures`,
  qrCodes: `${BASE_FOLDER}/qr-codes`,
  aiContent: `${BASE_FOLDER}/ai-content`,
  system: `${BASE_FOLDER}/system`,
};

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
];

const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.js', '.sh', '.php', '.cmd', '.vbs', '.ps1'];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(
    @Inject(CLOUDINARY_TOKEN) private readonly cloudinary: any,
  ) {}

  get isConfigured(): boolean {
    return !!this.cloudinary;
  }

  private validate(file: Express.Multer.File): void {
    const ext = '.' + file.originalname.split('.').pop()?.toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      throw new Error(`File type ${ext} is not allowed.`);
    }
    if (file.mimetype && !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new Error(`MIME type ${file.mimetype} is not allowed.`);
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
    }
  }

  private buildTransformations(resourceType: string, folder: string): UploadApiOptions['transformation'] {
    if (resourceType !== 'image') return undefined;

    if (folder.includes('users') || folder.includes('logos') || folder.includes('profile')) {
      return [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }, { quality: 'auto', fetch_format: 'webp' }];
    }
    if (folder.includes('banners')) {
      return [{ width: 1200, height: 400, crop: 'fill' }, { quality: 'auto', fetch_format: 'webp' }];
    }
    return [{ quality: 'auto', fetch_format: 'webp' }];
  }

  async upload(
    file: Express.Multer.File,
    folder?: string,
    options?: { publicId?: string; resourceType?: string },
  ): Promise<CloudinaryUploadResult> {
    if (!this.cloudinary) {
      return this.localFallback(file, folder);
    }

    this.validate(file);
    const targetFolder = folder || FOLDERS.system;
    const resourceType = options?.resourceType || 'auto';

    return new Promise((resolve, reject) => {
      const uploadOptions: UploadApiOptions = {
        folder: targetFolder,
        resource_type: resourceType as any,
        public_id: options?.publicId,
        transformation: this.buildTransformations(resourceType, targetFolder),
        use_filename: true,
        unique_filename: true,
      };

      const uploadStream = this.cloudinary.uploader.upload_stream(
        uploadOptions,
        (error: any, result: UploadApiResponse) => {
          if (error) return reject(new Error(`Cloudinary upload failed: ${error.message}`));
          resolve({
            publicId: result.public_id,
            url: result.url,
            secureUrl: result.secure_url,
            resourceType: result.resource_type,
            mimeType: result.format ? `image/${result.format}` : 'application/octet-stream',
            size: result.bytes,
            width: result.width,
            height: result.height,
            format: result.format,
            folder: targetFolder,
          });
        },
      );

      if (file.buffer) {
        uploadStream.end(file.buffer);
      } else if (file.stream) {
        file.stream.pipe(uploadStream);
      }
    });
  }

  async uploadBuffer(
    buffer: Buffer,
    options: { folder: string; publicId?: string; fileName?: string; resourceType?: string },
  ): Promise<CloudinaryUploadResult> {
    if (!this.cloudinary) {
      return { publicId: '', url: '', secureUrl: '', resourceType: 'raw', mimeType: '', size: buffer.length, folder: options.folder };
    }

    return new Promise((resolve, reject) => {
      const uploadOptions: UploadApiOptions = {
        folder: options.folder,
        resource_type: (options.resourceType || 'raw') as any,
        public_id: options.publicId,
        use_filename: true,
        unique_filename: true,
      };

      const uploadStream = this.cloudinary.uploader.upload_stream(
        uploadOptions,
        (error: any, result: UploadApiResponse) => {
          if (error) return reject(new Error(`Cloudinary upload failed: ${error.message}`));
          resolve({
            publicId: result.public_id,
            url: result.url,
            secureUrl: result.secure_url,
            resourceType: result.resource_type,
            mimeType: result.format ? `image/${result.format}` : 'application/octet-stream',
            size: result.bytes,
            folder: options.folder,
          });
        },
      );

      uploadStream.end(buffer);
    });
  }

  async delete(publicId: string): Promise<boolean> {
    if (!this.cloudinary) return true;

    return new Promise((resolve, reject) => {
      this.cloudinary.uploader.destroy(publicId, (error: any, result: DeleteApiResponse) => {
        if (error) return reject(new Error(`Cloudinary delete failed: ${error.message}`));
        resolve((result as any).result === 'ok');
      });
    });
  }

  async deleteByFolder(folder: string): Promise<number> {
    if (!this.cloudinary) return 0;
    let deleted = 0;
    let nextCursor: string | undefined;

    do {
      const result: any = await this.cloudinary.api.resources({ type: 'upload', prefix: folder, max_results: 500, next_cursor: nextCursor });
      if (result.resources?.length) {
        const publicIds = result.resources.map((r: any) => r.public_id);
        const delResult: any = await this.cloudinary.api.delete_resources(publicIds);
        deleted += Object.values(delResult.deleted).filter(Boolean).length;
      }
      nextCursor = result.next_cursor;
    } while (nextCursor);

    return deleted;
  }

  async getUsage(): Promise<{ storageUsedMB: number; totalFiles: number; creditsUsed: number }> {
    if (!this.cloudinary) return { storageUsedMB: 0, totalFiles: 0, creditsUsed: 0 };
    const usage: any = await this.cloudinary.api.usage();
    return {
      storageUsedMB: Math.round(usage.storage.usage / 1024 / 1024),
      totalFiles: usage.objects?.images || 0,
      creditsUsed: usage.credits?.usage || 0,
    };
  }

  getOptimizedUrl(publicId: string, options?: { width?: number; height?: number; crop?: string; quality?: string; format?: string }): string {
    if (!this.cloudinary) return '';
    const { width, height, crop = 'fill', quality = 'auto', format = 'webp' } = options || {};
    return this.cloudinary.url(publicId, { width, height, crop, quality, fetch_format: format, secure: true });
  }

  getPrivateUrl(publicId: string, options?: { expiresInSeconds?: number }): string {
    if (!this.cloudinary) return '';
    const expiresAt = Math.floor(Date.now() / 1000) + (options?.expiresInSeconds || 3600);
    return this.cloudinary.utils.private_download_url(publicId, '', { expires_at: expiresAt, attachment: false, secure: true });
  }

  getSignedDownloadUrl(publicId: string, resourceType: string = 'raw', expiresInSeconds: number = 3600): string {
    if (!this.cloudinary) return '';
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    return this.cloudinary.utils.private_download_url(publicId, resourceType, { expires_at: expiresAt, attachment: true, secure: true });
  }

  generateSignature(params: Record<string, any>): { signature: string; timestamp: number } {
    const timestamp = Math.floor(Date.now() / 1000);
    const sortedParams = Object.keys(params).sort().reduce((acc, key) => {
      if (params[key] !== undefined) acc[key] = params[key];
      return acc;
    }, {} as Record<string, any>);
    const signature = this.cloudinary.utils.api_sign_request({ ...sortedParams, timestamp }, process.env.CLOUDINARY_API_SECRET!);
    return { signature, timestamp };
  }

  private async localFallback(file: Express.Multer.File, folder?: string): Promise<CloudinaryUploadResult> {
    this.logger.warn('Using local fallback — Cloudinary not configured.');
    return {
      publicId: `local-${Date.now()}`,
      url: `/uploads/${folder || 'system'}/${file.originalname}`,
      secureUrl: `/uploads/${folder || 'system'}/${file.originalname}`,
      resourceType: file.mimetype?.startsWith('image') ? 'image' : 'raw',
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size,
      folder: folder || 'system',
    };
  }
}
