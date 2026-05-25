import { Module } from '@nestjs/common';
import { StudentPhotoController } from './student-photo.controller';
import { StudentPhotoService } from './student-photo.service';

@Module({
  controllers: [StudentPhotoController],
  providers: [StudentPhotoService],
  exports: [StudentPhotoService],
})
export class StudentPhotoModule {}
