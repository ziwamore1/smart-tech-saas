import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class CloudAssetService {
  constructor(private prisma: PrismaService) {}

  async getAssets(schoolId: string, type?: string, search?: string) {
    const where: any = { schoolId };
    if (type) where.type = type;
    if (search) where.name = { contains: search, mode: 'insensitive' };
    return this.prisma.templateAsset.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async uploadAsset(schoolId: string, file: Express.Multer.File, metadata?: {
    name?: string; type?: string; alt?: string; tags?: string[];
  }): Promise<any> {
    const ext = path.extname(file.originalname).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext);
    let optimizedBuffer: Buffer | undefined;
    let thumbnailUrl: string | undefined;

    if (isImage && ext !== '.svg') {
      optimizedBuffer = await sharp(file.buffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      const thumbBuffer = await sharp(file.buffer)
        .resize(200, 200, { fit: 'cover' })
        .jpeg({ quality: 60 })
        .toBuffer();
      const thumbPath = path.join('uploads', 'assets', 'thumbs', `thumb-${Date.now()}-${file.originalname}`);
      fs.mkdirSync(path.dirname(thumbPath), { recursive: true });
      fs.writeFileSync(thumbPath, thumbBuffer);
      thumbnailUrl = `/${thumbPath.replace(/\\/g, '/')}`;
    }

    const assetPath = path.join('uploads', 'assets', `${Date.now()}-${file.originalname}`);
    fs.mkdirSync(path.dirname(assetPath), { recursive: true });
    fs.writeFileSync(assetPath, optimizedBuffer || file.buffer);

    return this.prisma.templateAsset.create({
      data: {
        schoolId,
        name: metadata?.name || file.originalname,
        type: metadata?.type || (isImage ? 'image' : 'document'),
        url: `/${assetPath.replace(/\\/g, '/')}`,
        size: file.size,
        metadata: {
          originalName: file.originalname,
          mimeType: file.mimetype,
          thumbnailUrl,
          alt: metadata?.alt,
          tags: metadata?.tags || [],
          dimensions: isImage ? { width: 800 } : undefined,
        } as any,
      },
    });
  }

  async deleteAsset(schoolId: string, id: string) {
    const asset = await this.prisma.templateAsset.findFirst({ where: { id, schoolId } });
    if (!asset) throw new NotFoundException('Asset not found');

    const filePath = asset.url.startsWith('/') ? asset.url.substring(1) : asset.url;
    try { fs.unlinkSync(filePath); } catch {}

    const meta = asset.metadata as any;
    if (meta?.thumbnailUrl) {
      try {
        const thumbPath = meta.thumbnailUrl.startsWith('/') ? meta.thumbnailUrl.substring(1) : meta.thumbnailUrl;
        fs.unlinkSync(thumbPath);
      } catch {}
    }

    return this.prisma.templateAsset.delete({ where: { id } });
  }

  async getAssetUsage(schoolId: string, assetId: string) {
    const asset = await this.prisma.templateAsset.findFirst({ where: { id: assetId, schoolId } });
    if (!asset) throw new NotFoundException('Asset not found');

    const templatesUsingAsset = await this.prisma.reportTemplate.findMany({
      where: {
        schoolId,
        OR: [
          { logoUrl: { contains: asset.url } },
          { layoutJson: { path: '$..url', string_contains: asset.url } },
        ],
      },
      select: { id: true, name: true },
    });

    return {
      asset,
      usedInTemplates: templatesUsingAsset,
      totalUsage: templatesUsingAsset.length,
    };
  }

  async getAssetCategories() {
    return [
      { id: 'logo', label: 'Logos', icon: '🏫' },
      { id: 'background', label: 'Backgrounds', icon: '🖼' },
      { id: 'border', label: 'Borders & Frames', icon: '⊞' },
      { id: 'stamp', label: 'Stamps & Seals', icon: '🔏' },
      { id: 'signature', label: 'Signatures', icon: '✍' },
      { id: 'icon', label: 'Icons', icon: '⭐' },
      { id: 'photo', label: 'Photos', icon: '📷' },
      { id: 'font', label: 'Font Files', icon: 'Aa' },
      { id: 'badge', label: 'Badges & Ribbons', icon: '🎖' },
      { id: 'other', label: 'Other Assets', icon: '📎' },
    ];
  }
}
