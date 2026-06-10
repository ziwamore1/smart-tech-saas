import { Controller, Get, Put, Post, Delete, Body, UseGuards, Req, UseInterceptors, UploadedFile, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProfileService } from './profile.service';
import { CloudinaryService, FOLDERS } from '../cloudinary/cloudinary.service';
import { cloudinaryMemoryStorage, CLOUDINARY_FILE_FILTER } from '../cloudinary/multer-cloudinary';
import { UpdateProfileDto, ChangePasswordDto } from './dto/profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  private readonly logger = new Logger(ProfileController.name);

  constructor(
    private profileService: ProfileService,
    private readonly cloudinary: CloudinaryService,
  ) {}

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
      storage: cloudinaryMemoryStorage(),
      fileFilter: CLOUDINARY_FILE_FILTER,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadPhoto(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    const result = await this.cloudinary.upload(file, FOLDERS.users.students);
    const oldPublicId = await this.profileService.uploadPhoto(req.user.id, result.secureUrl, result.publicId);
    if (oldPublicId) {
      await this.cloudinary.delete(oldPublicId).catch(() => {});
    }
    return { photoUrl: result.secureUrl, photoPublicId: result.publicId };
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
