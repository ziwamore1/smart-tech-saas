import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname, join } from 'path';
import * as fs from 'fs';
import { LibraryService } from './library.service';
import { CloudinaryService, FOLDERS } from '../cloudinary/cloudinary.service';
import { cloudinaryMemoryStorage, CLOUDINARY_FILE_FILTER } from '../cloudinary/multer-cloudinary';
import { Roles } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('library')
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(
    private libraryService: LibraryService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @Get()
  async findAll(@Req() req: any) {
    const schoolId = req.user?.schoolId;
    console.log('[Library] findAll - user:', JSON.stringify(req.user));
    console.log('[Library] findAll - schoolId:', schoolId);
    return this.libraryService.findAll(schoolId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const schoolId = req.user?.schoolId;
    console.log('[Library] findOne - user:', JSON.stringify(req.user));
    console.log('[Library] findOne - schoolId:', schoolId);
    return this.libraryService.findOne(id, schoolId);
  }

  @Post()
  @Roles('Director', 'Teacher')
  async create(@Body() body: any, @Req() req: any) {
    const schoolId = req.user?.schoolId;
    console.log('[Library] POST create - user:', JSON.stringify(req.user));
    console.log('[Library] POST create - schoolId:', schoolId);
    console.log('[Library] POST create - body:', JSON.stringify(body));
    return this.libraryService.create(body, schoolId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const schoolId = req.user?.schoolId;
    return this.libraryService.update(id, body, schoolId);
  }

  @Delete(':id')
  @Roles('Director')
  async delete(@Param('id') id: string, @Req() req: any) {
    const schoolId = req.user?.schoolId;
    return this.libraryService.delete(id, schoolId);
  }

  @Post(':id/upload')
  @Roles('Director')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: cloudinaryMemoryStorage(),
      fileFilter: CLOUDINARY_FILE_FILTER,
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async uploadFile(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const schoolId = req.user?.schoolId;
    const result = await this.cloudinary.upload(file, `${FOLDERS.system}/library`);
    return this.libraryService.uploadFile(id, result.secureUrl, result.size, schoolId);
  }

  @Get(':id/download')
  async downloadFile(@Param('id') id: string, @Req() req: any, @Res() res: any) {
    const schoolId = req.user?.schoolId;
    const document = await this.libraryService.findOne(id, schoolId);
    
    if (!document || !document.fileUrl) {
      return res.status(404).json({ message: 'File not found' });
    }

    const filePath = join(process.cwd(), document.fileUrl);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on disk' });
    }

    const ext = extname(document.fileUrl);
    const filename = `${document.title}${ext}`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }

  @Post(':id/reading-session')
  async logReadingSession(
    @Param('id') id: string,
    @Body() body: { durationSeconds: number; pagesViewed: string[]; completedAt: string },
    @Req() req: any,
  ) {
    const schoolId = req.user?.schoolId;
    const userId = req.user?.id;
    console.log('[ReadingSession] schoolId:', schoolId, 'userId:', userId);
    if (!schoolId || !userId) {
      return { message: 'Session not logged - user not authenticated properly' };
    }
    return this.libraryService.logReadingSession(id, body, schoolId, userId);
  }
}