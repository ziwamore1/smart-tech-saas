import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import * as crypto from 'crypto';
import sharp from 'sharp';

export interface SignatureProcessingOptions {
  threshold?: number | 'auto';
  contrast?: number;
  rotation?: number;
  crop?: { left: number; top: number; width: number; height: number };
  feather?: number;
}

@Injectable()
export class DigitalSignatureService {
  constructor(private prisma: PrismaService, private cloudinary: CloudinaryService) {}

  async getSignatures(schoolId: string | null, options: { scope?: string; status?: string; search?: string; limit?: number } = {}) {
    const clauses: any[] = [];
    if (schoolId) {
      // Schools see their own signatures plus published platform signatures.
      clauses.push({ OR: [{ schoolId }, { scope: 'PLATFORM', status: 'ACTIVE' }] });
    } else if (options.scope) {
      clauses.push({ scope: options.scope });
    }
    if (options.status) clauses.push({ status: options.status });
    if (options.search?.trim()) {
      clauses.push({
        OR: [
          { name: { contains: options.search.trim(), mode: 'insensitive' } },
          { title: { contains: options.search.trim(), mode: 'insensitive' } },
        ],
      });
    }
    const where: any = clauses.length === 1 ? clauses[0] : clauses.length ? { AND: clauses } : {};
    return this.prisma.digitalSignature.findMany({
      where,
      include: { school: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
      ...(options.limit ? { take: options.limit } : {}),
    });
  }

  async getTemplateSignatories(templateId: string, schoolId: string | null) {
    const template = await this.prisma.reportTemplate.findFirst({
      where: { id: templateId, ...(schoolId ? { schoolId } : {}) },
    });
    if (!template) throw new NotFoundException('Report template not found');
    return this.prisma.templateSignatory.findMany({
      where: { templateId },
      include: { signature: { select: { id: true, name: true, title: true, thumbnailUrl: true } } },
      orderBy: { position: 'asc' },
    });
  }

  async saveTemplateSignatories(
    actor: { id?: string; isSuperAdmin?: boolean },
    schoolId: string | null,
    templateId: string,
    signatories: Array<{
      id?: string;
      label: string;
      role?: string | null;
      position?: number;
      isRequired?: boolean;
      signatureId?: string | null;
    }>,
  ) {
    const template = await this.prisma.reportTemplate.findFirst({
      where: { id: templateId, ...(schoolId ? { schoolId } : {}) },
    });
    if (!template) throw new NotFoundException('Report template not found');

    const list = Array.isArray(signatories) ? signatories : [];
    if (list.length > 10) {
      throw new BadRequestException('A template may declare at most 10 signature positions');
    }

    // Validate that every bound signature exists and is active in the same scope.
    const boundIds = list.map((s) => s.signatureId).filter((id): id is string => !!id);
    if (boundIds.length) {
      const signatures = await this.prisma.digitalSignature.findMany({
        where: { id: { in: boundIds }, status: 'ACTIVE' },
        select: { id: true, scope: true, schoolId: true },
      });
      const found = new Set(signatures.map((s) => s.id));
      for (const id of boundIds) {
        if (!found.has(id)) throw new BadRequestException(`Bound signature no longer exists or is not active: ${id}`);
      }
      for (const s of signatures) {
        if (schoolId && s.scope === 'SCHOOL' && s.schoolId && s.schoolId !== schoolId) {
          throw new BadRequestException(`Signature does not belong to this school: ${s.id}`);
        }
      }
    }

    const existing = await this.prisma.templateSignatory.findMany({ where: { templateId } });
    const existingMap = new Map(existing.map((e) => [e.id, e]));
    const incoming = new Set(list.map((s) => s.id).filter((id): id is string => !!id));
    const toDelete = existing.filter((e) => !incoming.has(e.id)).map((e) => e.id);

    if (toDelete.length) {
      await this.prisma.templateSignatory.deleteMany({ where: { id: { in: toDelete } } });
    }

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const data = {
        label: String(item.label || `Signatory ${i + 1}`).trim().slice(0, 120),
        role: item.role?.trim() || null,
        position: item.position ?? i,
        isRequired: item.isRequired !== false,
        signatureId: item.signatureId || null,
      };
      if (item.id && existingMap.has(item.id)) {
        await this.prisma.templateSignatory.update({ where: { id: item.id }, data });
      } else {
        await this.prisma.templateSignatory.create({ data: { templateId, ...data } });
      }
    }

    return this.getTemplateSignatories(templateId, schoolId);
  }

  async getStampTemplateSignatories(templateId: string, schoolId: string | null) {
    const template = await this.prisma.stampTemplate.findFirst({
      where: { id: templateId, ...(schoolId ? { schoolId } : {}) },
    });
    if (!template) throw new NotFoundException('Stamp template not found');
    return this.prisma.stampTemplateSignatory.findMany({
      where: { templateId },
      include: { signature: { select: { id: true, name: true, title: true, thumbnailUrl: true } } },
      orderBy: { position: 'asc' },
    });
  }

  async saveStampTemplateSignatories(
    actor: { id?: string; isSuperAdmin?: boolean },
    schoolId: string | null,
    templateId: string,
    signatories: Array<{
      id?: string;
      label: string;
      role?: string | null;
      position?: number;
      isRequired?: boolean;
      signatureId?: string | null;
    }>,
  ) {
    const template = await this.prisma.stampTemplate.findFirst({
      where: { id: templateId, ...(schoolId ? { schoolId } : {}) },
    });
    if (!template) throw new NotFoundException('Stamp template not found');

    const list = Array.isArray(signatories) ? signatories : [];
    if (list.length > 10) {
      throw new BadRequestException('A template may declare at most 10 signature positions');
    }

    const boundIds = list.map((s) => s.signatureId).filter((id): id is string => !!id);
    if (boundIds.length) {
      const signatures = await this.prisma.digitalSignature.findMany({
        where: { id: { in: boundIds }, status: 'ACTIVE' },
        select: { id: true, scope: true, schoolId: true },
      });
      const found = new Set(signatures.map((s) => s.id));
      for (const id of boundIds) {
        if (!found.has(id)) throw new BadRequestException(`Bound signature no longer exists or is not active: ${id}`);
      }
      for (const s of signatures) {
        if (schoolId && s.scope === 'SCHOOL' && s.schoolId && s.schoolId !== schoolId) {
          throw new BadRequestException(`Signature does not belong to this school: ${s.id}`);
        }
      }
    }

    const existing = await this.prisma.stampTemplateSignatory.findMany({ where: { templateId } });
    const existingMap = new Map(existing.map((e) => [e.id, e]));
    const incoming = new Set(list.map((s) => s.id).filter((id): id is string => !!id));
    const toDelete = existing.filter((e) => !incoming.has(e.id)).map((e) => e.id);

    if (toDelete.length) {
      await this.prisma.stampTemplateSignatory.deleteMany({ where: { id: { in: toDelete } } });
    }

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const data = {
        label: String(item.label || `Signatory ${i + 1}`).trim().slice(0, 120),
        role: item.role?.trim() || null,
        position: item.position ?? i,
        isRequired: item.isRequired !== false,
        signatureId: item.signatureId || null,
      };
      if (item.id && existingMap.has(item.id)) {
        await this.prisma.stampTemplateSignatory.update({ where: { id: item.id }, data });
      } else {
        await this.prisma.stampTemplateSignatory.create({ data: { templateId, ...data } });
      }
    }

    return this.getStampTemplateSignatories(templateId, schoolId);
  }

  async createSignature(schoolId: string | null, data: {
    name: string; title?: string; email?: string; imageUrl?: string; signatureData?: string; isDefault?: boolean; userId?: string; scope?: string; processing?: SignatureProcessingOptions;
  }) {
    const scope = (data.scope || (schoolId ? 'SCHOOL' : 'PLATFORM')).toUpperCase();
    if (!schoolId && scope !== 'PLATFORM') throw new NotFoundException('School ID required');
    if (!data.name?.trim()) throw new BadRequestException('Signature name is required');
    if (!data.imageUrl && !data.signatureData) {
      throw new BadRequestException('A drawn or uploaded signature image is required');
    }

    // Store a bounded, cropped PNG with the paper background removed. This
    // keeps the handwriting intact while making it usable on any document.
    const visual = data.signatureData || data.imageUrl;
    const normalized = await this.normalizeVisual(visual, data.processing);
    const assets = await this.persistAssets(schoolId, visual, normalized, scope);
    if (data.isDefault) {
      await this.prisma.digitalSignature.updateMany({ where: { schoolId, scope, isDefault: true }, data: { isDefault: false } });
    }
    return this.prisma.digitalSignature.create({
      data: {
        schoolId, userId: data.userId, name: data.name.trim(), title: data.title, email: data.email,
        scope,
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
        processingVersion: 'v3',
        processingMetadata: { background: 'auto-soft', threshold: data.processing?.threshold ?? 'auto', feather: data.processing?.feather ?? null, contrast: data.processing?.contrast ?? 1, rotation: data.processing?.rotation ?? 0, crop: data.processing?.crop || null, sourceMime: assets.sourceMime },
        isDefault: data.isDefault || false,
        certificate: crypto.randomBytes(32).toString('hex'),
      },
    });
  }

  private async persistAssets(schoolId: string | null, original: string, processed: string, scope = 'SCHOOL') {
    const originalMatch = original.match(/^data:image\/[^;]+;base64,([\s\S]+)$/i);
    const processedMatch = processed.match(/^data:image\/[^;]+;base64,([\s\S]+)$/i);
    if (!processedMatch) return { originalImageUrl: original, processedImageUrl: original, transparentImageUrl: original, thumbnailUrl: original, originalAssetId: null, processedAssetId: null, thumbnailAssetId: null, width: null, height: null, aspectRatio: null, sourceMime: 'remote' };
    const processedBuffer = Buffer.from(processedMatch[1], 'base64');
    const meta = await sharp(processedBuffer).metadata();
    const thumb = await sharp(processedBuffer).resize({ width: 320, height: 160, fit: 'inside' }).png().toBuffer();
    const folder = scope === 'PLATFORM'
      ? 'smarttech/signatures/platform'
      : `smarttech/signatures/${schoolId}`;
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

      const rotation = Math.max(-180, Math.min(180, Number(options.rotation || 0)));
      if (options.crop) {
        const crop = options.crop;
        if (crop.left < 0 || crop.top < 0 || crop.width < 1 || crop.height < 1 ||
            crop.left + crop.width > metadata.width || crop.top + crop.height > metadata.height) {
          throw new BadRequestException('Crop rectangle is outside the uploaded image');
        }
      }
      const contrast = Math.max(0.5, Math.min(2, Number(options.contrast ?? 1)));
      const buildBase = () => {
        let base = sharp(input, { limitInputPixels: 16_000_000 });
        if (options.crop) base = base.extract(options.crop);
        return base
          .rotate(rotation)
          .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
          .toColourspace('srgb')
          .linear(contrast, 128 * (1 - contrast));
      };
      const { data: pixels, info } = await buildBase().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      if (info.channels !== 4) throw new BadRequestException('Unable to normalise signature image channels');
      const channels = info.channels;
      const fullOpaque = this.isFullyOpaque(pixels, channels);
      const manual = options.threshold !== undefined && options.threshold !== 'auto';

      // Local adaptive background removal for fully opaque scans: compare each
      // pixel to a heavily blurred copy (the local "paper" colour), so smooth
      // edge shadows and shading are removed while ink (darker than its
      // surroundings) is kept. Drawn/transparent signatures keep the global
      // luminance ramp, and a manual threshold keeps the old explicit cut.
      let background: Buffer | null = null;
      if (!manual && fullOpaque) {
        const bg = await buildBase()
          .blur(Math.max(20, Math.round(Math.max(info.width, info.height) * 0.04)))
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        background = bg.data;
      }
      const params = this.autoRemoveParams(pixels, channels, options.threshold);
      if (background) {
        const margin = 30;
        const band = 46;
        for (let i = 0; i < pixels.length; i += channels) {
          const grey = this.luma(pixels, i);
          const alphaIn = pixels[i + 3];
          const diff = Math.max(0, this.luma(background, i) - grey);
          let alpha: number;
          if (diff <= margin) alpha = 0;
          else if (diff >= margin + band) alpha = 255;
          else alpha = Math.round(((diff - margin) / band) * 255);
          const out = Math.round((alpha * alphaIn) / 255);
          pixels[i + 3] = out < 10 ? 0 : out;
          if (out > 0) {
            pixels[i] = 0;
            pixels[i + 1] = 0;
            pixels[i + 2] = 0;
          }
        }
      } else {
        for (let i = 0; i < pixels.length; i += channels) {
          const grey = this.luma(pixels, i);
          const alphaIn = pixels[i + 3];
          let alpha: number;
          if (grey <= params.cut) alpha = 255;
          else if (grey >= params.cut + params.band) alpha = 0;
          else alpha = Math.round(255 - ((grey - params.cut) / params.band) * 255);
          const out = Math.round((alpha * alphaIn) / 255);
          pixels[i + 3] = out < 10 ? 0 : out;
          if (fullOpaque && out > 0) {
            pixels[i] = 0;
            pixels[i + 1] = 0;
            pixels[i + 2] = 0;
          }
        }
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

  private autoRemoveParams(pixels: Buffer, channels: number, requested?: number | 'auto'): { cut: number; band: number } {
    if (requested !== undefined && requested !== 'auto') {
      const cut = Math.max(180, Math.min(254, Math.round(Number(requested))));
      return { cut, band: Math.max(8, Math.min(48, Math.round((255 - cut) * 0.2))) };
    }
    const hist = new Int32Array(256);
    let total = 0;
    for (let i = 0; i < pixels.length; i += channels) {
      if (pixels[i + 3] > 0) {
        hist[this.luma(pixels, i)]++;
        total++;
      }
    }
    if (total <= 0) return { cut: 200, band: 48 };
    // Paper colour is the weighted mean of the bright half of the histogram —
    // robust to pale-grey scans, light creases, shadows and single bright specks.
    let half = 0;
    let mid = 255;
    for (let v = 0; v < 256; v++) {
      half += hist[v];
      if (half * 2 >= total) {
        mid = v;
        break;
      }
    }
    let brightCount = 0;
    let brightSum = 0;
    for (let v = mid; v < 256; v++) {
      brightCount += hist[v];
      brightSum += v * hist[v];
    }
    const paper = brightCount > 0 ? Math.round(brightSum / brightCount) : 255;
    const cut = Math.max(150, Math.min(235, paper - 96));
    return { cut, band: Math.max(8, paper - cut) };
  }

  private isFullyOpaque(pixels: Buffer, channels: number): boolean {
    for (let i = 0; i < pixels.length; i += channels) {
      if (pixels[i + 3] !== 255) return false;
    }
    return true;
  }

  private luma(pixels: Buffer, i: number) {
    return Math.round((pixels[i] * 299 + pixels[i + 1] * 587 + pixels[i + 2] * 114) / 1000);
  }

  async previewSignature(value: string, options?: SignatureProcessingOptions) {
    const processed = await this.normalizeVisual(value, options);
    const metadata = await this.getImageMetadata(processed);
    return { processedImage: processed, transparentImage: processed, ...metadata, processingVersion: 'v3', options: options || {} };
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

  async updateSignature(schoolId: string | null, id: string, data: any, actor?: { isSuperAdmin?: boolean }) {
    const s = (actor?.isSuperAdmin && !schoolId)
      ? await this.prisma.digitalSignature.findUnique({ where: { id } })
      : await this.prisma.digitalSignature.findFirst({ where: { id, schoolId } });
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
      const scope = s.scope || 'SCHOOL';
      const where: any = { scope, isDefault: true, id: { not: id } };
      if (s.schoolId) where.schoolId = s.schoolId;
      await this.prisma.digitalSignature.updateMany({ where, data: { isDefault: false } });
    }
    return this.prisma.digitalSignature.update({ where: { id }, data: update });
  }

  async deleteSignature(schoolId: string | null, id: string, actor?: { isSuperAdmin?: boolean }) {
    const s = (actor?.isSuperAdmin && !schoolId)
      ? await this.prisma.digitalSignature.findUnique({ where: { id } })
      : await this.prisma.digitalSignature.findFirst({ where: { id, schoolId } });
    if (!s) throw new NotFoundException('Signature not found');
    await Promise.all([s.originalAssetId, s.processedAssetId, s.thumbnailAssetId].filter(Boolean).map(assetId => this.cloudinary.delete(assetId as string).catch(() => false)));
    return this.prisma.digitalSignature.delete({ where: { id } });
  }

  async setSignatureStatus(params: { actor: { id?: string; isSuperAdmin?: boolean }; schoolId: string | null; id: string; status: string; reason?: string }) {
    const where: any = { id: params.id };
    if (!params.actor?.isSuperAdmin || params.schoolId) where.schoolId = params.schoolId;
    const signature = await this.prisma.digitalSignature.findFirst({ where });
    if (!signature) throw new NotFoundException('Signature not found');

    const status = String(params.status || 'ACTIVE').toUpperCase();
    if (!['ACTIVE', 'REVOKED', 'SUSPENDED', 'ARCHIVED'].includes(status)) {
      throw new BadRequestException(`Invalid signature status: ${status}`);
    }
    const data: any = { status };
    if (status !== 'ACTIVE') {
      data.revokedReason = params.reason?.trim() || `Revoked as ${status}`;
      data.revokedAt = new Date();
      data.revokedBy = params.actor?.id;
    } else {
      data.revokedReason = null;
      data.revokedAt = null;
      data.revokedBy = null;
    }
    return this.prisma.digitalSignature.update({ where: { id: params.id }, data });
  }

  async revokeSignature(schoolId: string | null, id: string, reason?: string, actor?: { id?: string; isSuperAdmin?: boolean }) {
    return this.setSignatureStatus({ actor, schoolId, id, status: 'REVOKED', reason });
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
