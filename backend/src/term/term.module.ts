import { Module } from '@nestjs/common';
import { TermController } from './term.controller';
import { TermService } from './term.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [TermController],
  providers: [TermService, PrismaService],
})
export class TermModule {}
