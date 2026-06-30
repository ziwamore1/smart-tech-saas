import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, UseInterceptors,
  UploadedFile, Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { cloudinaryMemoryStorage, CLOUDINARY_FILE_FILTER } from '../cloudinary/multer-cloudinary';
import { LandingMockupService } from './landing-mockup.service';
import { CreateMockupDto } from './dto/create-mockup.dto';
import { UpdateMockupDto } from './dto/update-mockup.dto';

@Controller('landing-mockups')
export class LandingMockupController {
  constructor(private readonly service: LandingMockupService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
  async create(@Body() dto: CreateMockupDto) {
    return this.service.create(dto);
  }

  @Get()
  async findAll() {
    return this.service.findAll();
  }

  @Get('active')
  async findActive() {
    return this.service.findActive();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateMockupDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('upload')
  @UseGuards(AuthGuard('jwt'), SuperAdminGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: cloudinaryMemoryStorage(),
      fileFilter: CLOUDINARY_FILE_FILTER,
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateMockupDto,
    @Req() req: any,
  ) {
    if (!file) throw new Error('No file uploaded');
    return this.service.uploadAndCreate(file, dto);
  }
}
