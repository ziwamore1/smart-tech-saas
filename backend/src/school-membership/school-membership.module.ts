import { Module } from '@nestjs/common';
import { SchoolMembershipService } from './school-membership.service';
import { SchoolMembershipController } from './school-membership.controller';
import { PrismaService } from '../prisma/prisma.service';
import { StaffPositionModule } from '../staff-position/staff-position.module';

@Module({
  controllers: [SchoolMembershipController],
  imports: [StaffPositionModule],
  providers: [SchoolMembershipService, PrismaService],
  exports: [SchoolMembershipService],
})
export class SchoolMembershipModule {}
