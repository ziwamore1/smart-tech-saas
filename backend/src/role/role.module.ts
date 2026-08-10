import { Module } from '@nestjs/common';
import { RoleController } from './role.controller';
import { StaffPositionModule } from '../staff-position/staff-position.module';

@Module({
  imports: [StaffPositionModule],
  controllers: [RoleController],
})
export class RoleModule {}
