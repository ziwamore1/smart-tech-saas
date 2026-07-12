import { Module } from '@nestjs/common';
import { SchoolMembershipService } from './school-membership.service';
import { SchoolMembershipController } from './school-membership.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [SchoolMembershipController],
  providers: [SchoolMembershipService, PrismaService],
  exports: [SchoolMembershipService],
})
export class SchoolMembershipModule {}
