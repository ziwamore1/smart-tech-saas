import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

const ALLOWED_MIME = new Set(['image/png', 'image/svg+xml', 'image/webp']);
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Institution-uploaded graphics for stamps (logos, emblems, coats of arms).
 * The platform never bundles government insignia — institutions upload only
 * assets they are legally entitled to use. Transparency is preserved
 * (no flattening transformations applied to SVG/PNG uploads).
 */
@Injectable()
export class StampAssetService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  async list(schoolId: string) {
    return this.prisma.stampAsset.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(schoolId: string, id: string) {
    const asset = await this.prisma.stampAsset.findFirst({ where: { id, schoolId } });
    if (!asset) throw new NotFoundException('Stamp asset not found');
    return asset;
  }

  async upload(
    schoolId: string,
    userId: string,
    file: Express.Multer.File,
    meta: { name: string; kind?: string },
  ) {
    this.validate(file);

    const result = await this.cloudinary.uploadBuffer(file.buffer, {
      folder: `smarttech/stamp-assets/${schoolId}`,
      publicId: `${meta.kind || 'LOGO'}_${Date.now()}`,
      fileName: file.originalname,
      resourceType: file.mimetype === 'image/svg+xml' ? 'image' : 'image',
    });

    return this.prisma.stampAsset.create({
      data: {
        schoolId,
        name: meta.name,
        kind: (meta.kind as any) || 'LOGO',
        url: result.secureUrl || result.url,
        publicId: result.publicId,
        format: result.format || file.mimetype.split('/')[1],
        width: result.width ?? null,
        height: result.height ?? null,
        sizeBytes: file.size,
        uploadedById: userId,
        metadata: { originalName: file.originalname, mimetype: file.mimetype } as any,
      },
    });
  }

  async delete(schoolId: string, id: string) {
    const asset = await this.getById(schoolId, id);
    try {
      if (asset.publicId) await this.cloudinary.delete(asset.publicId);
    } catch {
      // storage cleanup is best-effort; DB record removal is authoritative
    }
    await this.prisma.stampAsset.delete({ where: { id } });
    return { success: true };
  }

  /** Resolve asset ids → URLs for the renderer context (tenant-scoped). */
  async resolveAssetMap(schoolId: string, assetIds: string[]): Promise<Record<string, string>> {
    if (!assetIds.length) return {};
    const unique = [...new Set(assetIds)];
    const assets = await this.prisma.stampAsset.findMany({
      where: { schoolId, id: { in: unique } },
      select: { id: true, url: true },
    });
    const map: Record<string, string> = {};
    for (const a of assets) map[a.id] = a.url;
    return map;
  }

  private validate(file: Express.Multer.File) {
    if (!file?.buffer) throw new BadRequestException('File is required');
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Only PNG, SVG and WebP images are supported');
    }
    if (file.size > MAX_SIZE) throw new BadRequestException('Image exceeds 5MB limit');
  }
}
