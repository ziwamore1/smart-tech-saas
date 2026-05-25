import { Controller, Get, Put, Post, Delete, Body, UseGuards, Req, UseInterceptors, UploadedFile, Logger, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ProfileService } from './profile.service';
import { UpdateProfileDto, ChangePasswordDto } from './dto/profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  private readonly logger = new Logger(ProfileController.name);

  constructor(private profileService: ProfileService) {}

  @Get()
  async getProfile(@Req() req: any) {
    return this.profileService.getProfile(req.user.id);
  }

  @Put()
  async updateProfile(@Req() req: any, @Body() data: UpdateProfileDto) {
    return this.profileService.updateProfile(req.user.id, data);
  }

  @Post('photo')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: join(__dirname, '../../uploads/profiles'),
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `profile-${uuidv4()}${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only JPG, PNG, and WebP files are allowed'), false);
        }
      },
    }),
  )
  async uploadPhoto(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    return this.profileService.uploadPhoto(req.user.id, file);
  }

  @Delete('photo')
  async deletePhoto(@Req() req: any) {
    return this.profileService.deletePhoto(req.user.id);
  }

  @Post('change-password')
  async changePassword(@Req() req: any, @Body() data: ChangePasswordDto) {
    return this.profileService.changePassword(req.user.id, data);
  }
}
