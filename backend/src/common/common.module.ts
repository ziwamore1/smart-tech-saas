import { Module, Global } from '@nestjs/common';
import { ImageService } from './services/image.service';

@Global()
@Module({
  providers: [ImageService],
  exports: [ImageService],
})
export class CommonModule {}
