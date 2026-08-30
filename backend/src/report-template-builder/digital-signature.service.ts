import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import * as crypto from 'crypto';
import sharp from 'sharp';

export interface SignatureProcessingOptions {
  threshold?: number;
  contrast?: number;
  rotation?: number;
  crop?: { left: number; top: number; width: number; height: number };
}

@Injectable()
export class DigitalSignatureService {
  constructor(private prisma: PrismaService, private cloudinary: CloudinaryService) {}

  async getSignatures(schoolId: string | null) {
    if (!schoolId) return [];
    return this.prisma.digitalSignature.findMany({ where: { schoolId }, orderBy: { updatedAt: 'desc' } });
  }

  async createSignature(schoolId: string, data: {
    name: string; title?: string; email?: string; imageUrl?: string; signatureData?: string; isDefault?: boolean; userId?: string; processing?: SignatureProcessingOptions;
  }) {
    if (!schoolId) throw new NotFoundException('School ID required');
    if (!data.name?.trim()) throw new BadRequestException('Signature name is required');
    if (!data.imageUrl && !data.signatureData) {
      throw new BadRequestException('A drawn or uploaded signature image is required');
    }

    // Store a bounded, cropped PNG with the paper background removed. This
    // keeps the handwriting intact while making it usable on any document.
    const visual = data.signatureData || data.imageUrl;
    const normalized = await this.normalizeVisual(visual, data.processing);
    const assets = await this.persistAssets(schoolId, visual, normalized);
    if (data.isDefault) {
      await this.prisma.digitalSignature.updateMany({ where: { schoolId, isDefault: true }, data: { isDefault: false } });
    }
    return this.prisma.digitalSignature.create({
      data: {
        schoolId, userId: data.userId, name: data.name.trim(), title: data.title, email: data.email,
        imageUrl: assets.processedImageUrl || (data.signatureData ? undefined : normalized),
        signatureData: data.signatureData ? normalized : undefined,
        originalImageUrl: assets.originalImageUrl,
        processedImageUrl: assets.processedImageUrl,
        transparentImageUrl: assets.transparentImageUrl,
        thumbnailUrl: assets.thumbnailUrl,
        originalAssetId: assets.originalAssetId,
        processedAssetId: assets.processedAssetId,
        thumbnailAssetId: assets.thumbnailAssetId,
        width: assets.width, height: assets.height, aspectRatio: assets.aspectRatio,
        processingVersion: 'v2',
        processingMetadata: { background: 'near-white', threshold: data.processing?.threshold ?? 245, contrast: data.processing?.contrast ?? 1, rotation: data.processing?.rotation ?? 0, crop: data.processing?.crop || null, sourceMime: assets.sourceMime },
        isDefault: data.isDefault || false,
        certificate: crypto.randomBytes(32).toString('hex'),
      },
    });
  }

  private async persistAssets(schoolId: string, original: string, processed: string) {
    const originalMatch = original.match(/^data:image\/[^;]+;base64,([\s\S]+)$/i);
    const processedMatch = processed.match(/^data:image\/[^;]+;base64,([\s\S]+)$/i);
    if (!processedMatch) return { originalImageUrl: original, processedImageUrl: original, transparentImageUrl: original, thumbnailUrl: original, originalAssetId: null, processedAssetId: null, thumbnailAssetId: null, width: null, height: null, aspectRatio: null, sourceMime: 'remote' };
    const processedBuffer = Buffer.from(processedMatch[1], 'base64');
    const meta = await sharp(processedBuffer).metadata();
    const thumb = await sharp(processedBuffer).resize({ width: 320, height: 160, fit: 'inside' }).png().toBuffer();
    const folder = `smarttech/signatures/${schoolId}`;
    const [originalAsset, processedAsset, thumbAsset] = await Promise.all([
      originalMatch ? this.cloudinary.uploadBuffer(Buffer.from(originalMatch[1], 'base64'), { folder, publicId: `original-${crypto.randomUUID()}`, resourceType: 'image' }) : null,
      this.cloudinary.uploadBuffer(processedBuffer, { folder, publicId: `transparent-${crypto.randomUUID()}`, resourceType: 'image' }),
      this.cloudinary.uploadBuffer(thumb, { folder, publicId: `thumbnail-${crypto.randomUUID()}`, resourceType: 'image' }),
    ]);
    return {
      originalImageUrl: originalAsset?.secureUrl || original,
      processedImageUrl: processedAsset.secureUrl || processed,
      transparentImageUrl: processedAsset.secureUrl || processed,
      thumbnailUrl: thumbAsset.secureUrl || processed,
      originalAssetId: originalAsset?.publicId || null,
      processedAssetId: processedAsset.publicId || null,
      thumbnailAssetId: thumbAsset.publicId || null,
      width: meta.width || null, height: meta.height || null,
      aspectRatio: meta.width && meta.height ? meta.width / meta.height : null,
      sourceMime: original.match(/^data:(image\/[^;]+)/i)?.[1] || 'image/unknown',
    };
  }

  private async normalizeVisual(value?: string, options: SignatureProcessingOptions = {}): Promise<string> {
    if (!value) throw new BadRequestException('Signature image is required');
    if (!value.startsWith('data:image/')) {
      if (/^https:\/\//i.test(value)) return value;
      throw new BadRequestException('Signature image must be a PNG, JPEG, or WebP data URL');
    }

    const match = value.match(/^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/=\s]+)$/i);
    if (!match) throw new BadRequestException('Signature image must be a base64 PNG, JPEG, or WebP image');
    const input = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    if (!input.length || input.length > 5 * 1024 * 1024) {
      throw new BadRequestException('Signature image must be between 1 byte and 5 MB');
    }

    try {
      // Camera images can be very large. Bound the working raster before
      // converting to raw RGBA so one preview cannot exhaust Railway memory.
      const image = sharp(input, { limitInputPixels: 16_000_000 });
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height || metadata.width > 4000 || metadata.height > 4000) {
        throw new BadRequestException('Signature image dimensions must not exceed 4000 by 4000 pixels');
      }

      const threshold = Math.max(180, Math.min(254, Math.round(options.threshold ?? 245)));
      const rotation = Math.max(-180, Math.min(180, Number(options.rotation || 0)));
      if (options.crop) {
        const crop = options.crop;
        if (crop.left < 0 || crop.top < 0 || crop.width < 1 || crop.height < 1 ||
            crop.left + crop.width > metadata.width || crop.top + crop.height > metadata.height) {
          throw new BadRequestException('Crop rectangle is outside the uploaded image');
        }
        image.extract(crop);
      }
      const contrast = Math.max(0.5, Math.min(2, Number(options.contrast ?? 1)));
      const { data: pixels, info } = await image
        .rotate(rotation)
        .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
        .greyscale()
        .linear(contrast, 128 * (1 - contrast))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      for (let i = 0; i < pixels.length; i += info.channels) {
        // Remove only near-white paper; coloured or anti-aliased ink remains.
        if (pixels[i] > threshold && pixels[i + 1] > threshold && pixels[i + 2] > threshold) pixels[i + 3] = 0;
      }
      const output = await sharp(pixels, { raw: info })
        .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      return `data:image/png;base64,${output.toString('base64')}`;
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Unable to process signature image');
    }
  }

  async previewSignature(value: string, options?: SignatureProcessingOptions) {
    const processed = await this.normalizeVisual(value, options);
    const metadata = await this.getImageMetadata(processed);
    return { processedImage: processed, transparentImage: processed, ...metadata, processingVersion: 'v2', options: options || {} };
  }

  private async getImageMetadata(value: string) {
    const match = value.match(/^data:image\/[^;]+;base64,([\s\S]+)$/i);
    if (!match) return { width: null, height: null, aspectRatio: null };
    const metadata = await sharp(Buffer.from(match[1], 'base64')).metadata();
    return {
      width: metadata.width || null,
      height: metadata.height || null,
      aspectRatio: metadata.width && metadata.height ? metadata.width / metadata.height : null,
    };
  }

  async updateSignature(schoolId: string, id: string, data: any) {
    const s = await this.prisma.digitalSignature.findFirst({ where: { id, schoolId } });
    if (!s) throw new NotFoundException('Signature not found');
    const update: any = {};
    for (const field of ['name', 'title', 'email', 'isDefault']) {
      if (data[field] !== undefined) update[field] = data[field];
    }
    const visual = data.signatureData || data.imageUrl;
    if (visual) {
      const normalized = await this.normalizeVisual(visual);
      update.imageUrl = data.signatureData ? null : normalized;
      update.signatureData = data.signatureData ? normalized : null;
    }
    if (update.name !== undefined && !String(update.name).trim()) {
      throw new BadRequestException('Signature name is required');
    }
    if (data.isDefault && !s.isDefault) {
      await this.prisma.digitalSignature.updateMany({ where: { schoolId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
    }
    return this.prisma.digitalSignature.update({ where: { id }, data: update });
  }

  async deleteSignature(schoolId: string, id: string) {
    const s = await this.prisma.digitalSignature.findFirst({ where: { id, schoolId } });
    if (!s) throw new NotFoundException('Signature not found');
    await Promise.all([s.originalAssetId, s.processedAssetId, s.thumbnailAssetId].filter(Boolean).map(assetId => this.cloudinary.delete(assetId as string).catch(() => false)));
    return this.prisma.digitalSignature.delete({ where: { id } });
  }

  async revokeSignature(schoolId: string, id: string, reason?: string) {
    const signature = await this.prisma.digitalSignature.findFirst({ where: { id, schoolId, status: 'ACTIVE' } });
    if (!signature) throw new NotFoundException('Active signature not found');
    return this.prisma.digitalSignature.update({
      where: { id },
      data: { status: 'REVOKED', processingMetadata: { ...(signature.processingMetadata as any || {}), revokedReason: reason || 'Revoked by institution', revokedAt: new Date().toISOString() } },
    });
  }

  async signDocument(schoolId: string, signatureId: string, documentHash: string): Promise<string> {
    const sig = await this.prisma.digitalSignature.findFirst({ where: { id: signatureId, schoolId } });
    if (!sig) throw new NotFoundException('Signature not found');
    const hash = crypto.createHash('sha256').update(documentHash + sig.certificate).digest('hex');
    return `${sig.id}:${hash.substring(0, 16)}:${Date.now()}`;
  }

  async verifySignature(signatureToken: string): Promise<boolean> {
    const [sigId] = signatureToken.split(':');
    const sig = await this.prisma.digitalSignature.findUnique({ where: { id: sigId } });
    return !!sig;
  }
}
