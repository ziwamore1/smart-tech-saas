import { Module } from '@nestjs/common';
import { PlatformRoleService } from './platform-role.service';
import { PlatformRoleController } from './platform-role.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [PlatformRoleController],
  providers: [PlatformRoleService, PrismaService],
  exports: [PlatformRoleService],
})
export class PlatformRoleModule {}
