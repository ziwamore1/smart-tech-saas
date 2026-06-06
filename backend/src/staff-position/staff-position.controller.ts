import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards, Logger,
} from '@nestjs/common';
import { StaffPositionService } from './staff-position.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CreateActingPositionDto } from './dto/create-acting-position.dto';
import { UpdateActingPositionDto } from './dto/update-acting-position.dto';

const ADMIN_ROLES = ['Director', 'Deputy Director', 'SuperAdmin', 'Head Teacher', 'Deputy'];

@Controller('staff-positions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffPositionController {
  private readonly logger = new Logger(StaffPositionController.name);

  constructor(private readonly service: StaffPositionService) {}

  // ==================== DEPARTMENTS ====================

  @Post('departments')
  @Roles(...ADMIN_ROLES)
  async createDepartment(@Body() dto: CreateDepartmentDto, @Req() req: any) {
    return this.service.createDepartment(req.user.schoolId, dto);
  }

  @Get('departments')
  async getDepartments(@Req() req: any) {
    return this.service.getDepartments(req.user.schoolId);
  }

  @Get('departments/:id')
  async getDepartmentById(@Param('id') id: string) {
    return this.service.getDepartmentById(id);
  }

  @Put('departments/:id')
  @Roles(...ADMIN_ROLES)
  async updateDepartment(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.service.updateDepartment(id, dto);
  }

  @Delete('departments/:id')
  @Roles('Director', 'SuperAdmin')
  async deleteDepartment(@Param('id') id: string) {
    return this.service.deleteDepartment(id);
  }

  // ==================== ACTING POSITIONS ====================

  @Post('positions')
  @Roles(...ADMIN_ROLES)
  async createActingPosition(@Body() dto: CreateActingPositionDto, @Req() req: any) {
    return this.service.createActingPosition(req.user.schoolId, dto);
  }

  @Get('positions/teacher/:teacherId')
  async getTeacherPositions(@Param('teacherId') teacherId: string) {
    return this.service.getTeacherPositions(teacherId);
  }

  @Get('positions')
  async getSchoolPositions(
    @Req() req: any,
    @Query('positionType') positionType?: string,
  ) {
    return this.service.getSchoolPositions(req.user.schoolId, positionType);
  }

  @Put('positions/:id')
  @Roles(...ADMIN_ROLES)
  async updateActingPosition(@Param('id') id: string, @Body() dto: UpdateActingPositionDto) {
    return this.service.updateActingPosition(id, dto);
  }

  @Delete('positions/:id')
  @Roles('Director', 'SuperAdmin')
  async deleteActingPosition(@Param('id') id: string) {
    return this.service.deleteActingPosition(id);
  }

  // ==================== HIERARCHY & MONITORING ====================

  @Get('hierarchy')
  async getHierarchy(@Req() req: any) {
    return this.service.getHierarchy(req.user.schoolId);
  }

  @Get('departments/:departmentId/teachers')
  async getDepartmentTeachers(@Req() req: any, @Param('departmentId') departmentId: string) {
    return this.service.getDepartmentTeachers(req.user.schoolId, departmentId);
  }

  @Get('monitoring-chain/:teacherId')
  async getMonitoringChain(@Req() req: any, @Param('teacherId') teacherId: string) {
    return this.service.getMonitoringChain(req.user.schoolId, teacherId);
  }

  @Get('position-types')
  async getPositionTypes() {
    return this.service.getPositionTypes();
  }
}
