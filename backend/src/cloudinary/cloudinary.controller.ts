import {
  Controller, Post, Delete, Get, Param, Query, UseInterceptors,
  UploadedFile, UploadedFiles, Body, ParseUUIDPipe, UseGuards,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { CloudinaryService, FOLDERS } from './cloudinary.service';
import { DeleteMediaDto, MediaFilterDto, UploadOptionsDto } from './dto/upload.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class CloudinaryController {
  constructor(
    private readonly cloudinary: CloudinaryService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() options: UploadOptionsDto,
  ) {
    const result = await this.cloudinary.upload(file, options.folder, {
      publicId: options.publicId,
      resourceType: options.resourceType,
    });

    const media = await this.prisma.media.create({
      data: {
        publicId: result.publicId,
        url: result.secureUrl,
        resourceType: result.resourceType,
        mimeType: result.mimeType,
        size: result.size,
        folder: result.folder,
        uploadedBy: 'system',
      },
    });

    return { statusCode: 200, data: media };
  }

  @Post('bulk-upload')
  @UseInterceptors(FilesInterceptor('files', 20))
  async bulkUpload(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() options: UploadOptionsDto,
  ) {
    const results = await Promise.all(
      files.map(file => this.cloudinary.upload(file, options.folder)),
    );

    const mediaRecords = await this.prisma.$transaction(
      results.map(result =>
        this.prisma.media.create({
          data: {
            publicId: result.publicId,
            url: result.secureUrl,
            resourceType: result.resourceType,
            mimeType: result.mimeType,
            size: result.size,
            folder: result.folder,
            uploadedBy: 'system',
          },
        }),
      ),
    );

    return { statusCode: 200, data: mediaRecords };
  }

  @Post('signed-url')
  generateSignedUrl(@Body() body: { folder?: string; publicId?: string }) {
    const params: Record<string, any> = {
      folder: body.folder || FOLDERS.system,
      timestamp: Math.floor(Date.now() / 1000),
    };
    if (body.publicId) params.public_id = body.publicId;
    return { statusCode: 200, data: this.cloudinary.generateSignature(params) };
  }

  @Delete()
  async deleteFile(@Body() dto: DeleteMediaDto) {
    const deleted = await this.cloudinary.delete(dto.publicId);
    if (deleted) {
      await this.prisma.media.deleteMany({ where: { publicId: dto.publicId } });
    }
    return { statusCode: 200, data: { deleted } };
  }

  @Get()
  async listMedia(@Query() filter: MediaFilterDto) {
    const where: any = {};
    if (filter.folder) where.folder = { contains: filter.folder };
    if (filter.uploadedBy) where.uploadedBy = filter.uploadedBy;
    if (filter.resourceType) where.resourceType = filter.resourceType;

    const [items, total] = await Promise.all([
      this.prisma.media.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: ((filter.page || 1) - 1) * (filter.limit || 20),
        take: filter.limit || 20,
      }),
      this.prisma.media.count({ where }),
    ]);

    return {
      statusCode: 200,
      data: { items, total, page: filter.page || 1, limit: filter.limit || 20, totalPages: Math.ceil(total / (filter.limit || 20)) },
    };
  }

  @Get('stats')
  async getStats() {
    const usage = await this.cloudinary.getUsage();
    const total = await this.prisma.media.count();
    const byFolder = await this.prisma.media.groupBy({ by: ['folder'], _count: true });

    return { statusCode: 200, data: { ...usage, totalRecords: total, byFolder } };
  }

  @Get('user/:userId')
  async getUserMedia(@Param('userId', ParseUUIDPipe) userId: string) {
    const items = await this.prisma.media.findMany({
      where: { uploadedBy: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { statusCode: 200, data: items };
  }

  @Delete('orphaned')
  async cleanupOrphaned() {
    const allMedia = await this.prisma.media.findMany({ select: { publicId: true, id: true } });
    let cleaned = 0;

    for (const media of allMedia) {
      if (media.publicId && !media.publicId.startsWith('local-')) {
        try {
          const deleted = await this.cloudinary.delete(media.publicId);
          if (deleted) {
            await this.prisma.media.delete({ where: { id: media.id } });
            cleaned++;
          }
        } catch {
          await this.prisma.media.delete({ where: { id: media.id } });
          cleaned++;
        }
      }
    }

    return { statusCode: 200, data: { cleaned } };
  }
}
