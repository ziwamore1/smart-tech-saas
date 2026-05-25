import { Injectable, BadRequestException, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp');
import * as path from 'path';
import * as fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  async optimize(inputPath: string, options?: { width?: number; height?: number; quality?: number }): Promise<string> {
    const ext = '.webp';
    const filename = `${uuidv4()}${ext}`;
    const dir = path.dirname(inputPath);
    const outputPath = path.join(dir, filename);

    await sharp(inputPath)
      .resize(options?.width || 400, options?.height || 400, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: options?.quality || 80 })
      .toFile(outputPath);

    await fs.remove(inputPath);
    return outputPath;
  }

  async createThumbnail(inputPath: string, size = 80): Promise<string> {
    const ext = '.webp';
    const filename = `thumb-${uuidv4()}${ext}`;
    const dir = path.dirname(inputPath);
    const outputPath = path.join(dir, filename);

    await sharp(inputPath)
      .resize(size, size, { fit: 'cover' })
      .webp({ quality: 60 })
      .toFile(outputPath);

    return outputPath;
  }

  async cropToPassport(inputPath: string): Promise<string> {
    const metadata = await sharp(inputPath).metadata();
    const size = Math.min(metadata.width || 300, metadata.height || 300);
    const left = Math.floor(((metadata.width || 300) - size) / 2);
    const top = Math.floor(((metadata.height || 300) - size) / 2);

    const filename = `${uuidv4()}.webp`;
    const dir = path.dirname(inputPath);
    const outputPath = path.join(dir, filename);

    await sharp(inputPath)
      .extract({ left, top, width: size, height: size })
      .resize(300, 300, { fit: 'cover' })
      .webp({ quality: 85 })
      .toFile(outputPath);

    await fs.remove(inputPath);
    return outputPath;
  }

  validateMimeType(mimeType: string): boolean {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    return allowed.includes(mimeType);
  }

  getPhotoUrl(relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, '/');
    const uploadsIndex = normalized.indexOf('uploads');
    if (uploadsIndex >= 0) {
      return '/' + normalized.slice(uploadsIndex);
    }
    return '/' + normalized;
  }
}
