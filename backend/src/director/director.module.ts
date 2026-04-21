import { Module } from '@nestjs/common';
import { DirectorController } from './director.controller';
import { DirectorService } from './director.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DirectorController],
  providers: [DirectorService],
})
export class DirectorModule {}
