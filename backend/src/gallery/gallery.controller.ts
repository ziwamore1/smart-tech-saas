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
import { GalleryService } from './gallery.service';
import { CloudinaryService, FOLDERS } from '../cloudinary/cloudinary.service';
import { cloudinaryMemoryStorage, CLOUDINARY_FILE_FILTER } from '../cloudinary/multer-cloudinary';
import { Roles } from '../auth/roles.decorator';

@Controller('gallery')
export class GalleryController {
  constructor(
    private galleryService: GalleryService,
    private readonly cloudinary: CloudinaryService,
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
      storage: cloudinaryMemoryStorage(),
      fileFilter: CLOUDINARY_FILE_FILTER,
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const schoolId = req.user?.schoolId;
    const result = await this.cloudinary.upload(file, `${FOLDERS.system}/gallery`);
    return this.galleryService.uploadPhoto(id, result.secureUrl, undefined, schoolId);
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