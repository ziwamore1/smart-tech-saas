import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { GalleryService } from './gallery.service';
import { ConfigService } from '@nestjs/config';
import { Roles } from '../auth/roles.decorator';

@Controller('gallery')
export class GalleryController {
  constructor(
    private galleryService: GalleryService,
    private configService: ConfigService,
  ) {}

  @Get('public/recent')
  async findPublicRecent(@Query('limit') limit?: string) {
    return this.galleryService.findPublicRecent(limit ? parseInt(limit, 10) : 6);
  }

  @Get()
  async findAll(@Req() req: any) {
    const schoolId = req.user?.schoolId;
    return this.galleryService.findAll(schoolId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const schoolId = req.user?.schoolId;
    return this.galleryService.findOne(id, schoolId);
  }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const schoolId = req.user?.schoolId;
    return this.galleryService.create(body, schoolId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const schoolId = req.user?.schoolId;
    return this.galleryService.update(id, body, schoolId);
  }

  @Delete(':id')
  @Roles('Director')
  async delete(@Param('id') id: string, @Req() req: any) {
    const schoolId = req.user?.schoolId;
    return this.galleryService.delete(id, schoolId);
  }

  @Post(':id/upload')
  @Roles('Director')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: './uploads/gallery',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `photo-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/^image\//)) {
          return callback(new Error('Only image files are allowed'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    }),
  )
  async uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const schoolId = req.user?.schoolId;
    const baseUrl = this.configService.get('UPLOAD_BASE_URL') || '';
    const photoUrl = `${baseUrl}/uploads/gallery/${file.filename}`;
    return this.galleryService.uploadPhoto(id, photoUrl, undefined, schoolId);
  }

  @Delete(':galleryId/photo/:photoId')
  @Roles('Director')
  async deletePhoto(
    @Param('galleryId') galleryId: string,
    @Param('photoId') photoId: string,
    @Req() req: any,
  ) {
    const schoolId = req.user?.schoolId;
    return this.galleryService.deletePhoto(galleryId, photoId, schoolId);
  }
}