import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ReportTemplateService } from './report-template.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('report-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportTemplateController {
  constructor(private readonly reportTemplateService: ReportTemplateService) {}

  @Get()
  @Roles('Director', 'Teacher')
  async getTemplates(@Req() req) {
    return this.reportTemplateService.getTemplates(req.user.schoolId);
  }

  @Get(':id')
  @Roles('Director', 'Teacher')
  async getTemplate(@Req() req, @Param('id') id: string) {
    return this.reportTemplateService.getTemplate(req.user.schoolId, id);
  }

  @Get('default')
  @Roles('Director', 'Teacher')
  async getDefaultTemplate(@Req() req) {
    return this.reportTemplateService.getDefaultTemplate(req.user.schoolId);
  }

  @Post()
  @Roles('Director')
  async createTemplate(@Req() req, @Body() data: any) {
    return this.reportTemplateService.createTemplate(req.user.schoolId, data);
  }

  @Patch(':id')
  @Roles('Director')
  async updateTemplate(
    @Req() req,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.reportTemplateService.updateTemplate(req.user.schoolId, id, data);
  }

  @Delete(':id')
  @Roles('Director')
  async deleteTemplate(@Req() req, @Param('id') id: string) {
    return this.reportTemplateService.deleteTemplate(req.user.schoolId, id);
  }

  @Post(':id/upload-stamp')
  @Roles('Director')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/report-templates',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `stamp-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          return callback(new Error('Only image files are allowed'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadStamp(@Req() req, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.reportTemplateService.uploadStamp(req.user.schoolId, id, file);
  }

  @Post(':id/upload-signature')
  @Roles('Director')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/report-templates',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `signature-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          return callback(new Error('Only image files are allowed'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async uploadSignature(@Req() req, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.reportTemplateService.uploadSignature(req.user.schoolId, id, file);
  }

  @Post(':id/upload-logo')
  @Roles('Director')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/report-templates',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `logo-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          return callback(new Error('Only image files are allowed'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async uploadLogo(@Req() req, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.reportTemplateService.uploadLogo(req.user.schoolId, id, file);
  }
}
