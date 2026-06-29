import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { LandingMockupController } from './landing-mockup.controller';
import { PublicMockupController } from './public-mockup.controller';
import { LandingMockupService } from './landing-mockup.service';

@Module({
  controllers: [LandingMockupController, PublicMockupController],
  providers: [LandingMockupService, PrismaService, CloudinaryService],
  exports: [LandingMockupService],
})
export class LandingMockupModule {}
