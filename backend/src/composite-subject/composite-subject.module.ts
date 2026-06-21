import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CompositeSubjectController } from './composite-subject.controller';
import { CompositeSubjectService } from './composite-subject.service';

@Module({
  imports: [PrismaModule],
  controllers: [CompositeSubjectController],
  providers: [CompositeSubjectService],
  exports: [CompositeSubjectService],
})
export class CompositeSubjectModule {}
