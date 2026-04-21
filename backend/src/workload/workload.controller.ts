import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { WorkloadService } from './workload.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('workload')
@UseGuards(JwtAuthGuard)
export class WorkloadController {
  constructor(private readonly workloadService: WorkloadService) {}

  @Get('teacher/:teacherId')
  async getTeacherLoad(
    @Param('teacherId') teacherId: string,
    @Query('termId') termId?: string,
  ) {
    return this.workloadService.getTeacherLoad(teacherId, termId);
  }

  @Get('teachers')
  async getAllTeachers(@Query('termId') termId?: string) {
    return this.workloadService.getAllTeachers(termId);
  }

  @Get('class/:classId')
  async getClassLoad(
    @Param('classId') classId: string,
    @Query('termId') termId?: string,
  ) {
    return this.workloadService.getClassLoad(classId, termId);
  }

  @Get('balancing-suggestions')
  async getBalancingSuggestions(@Query('termId') termId?: string) {
    return this.workloadService.getBalancingSuggestions(termId);
  }

  @Get('conflicts')
  async getConflicts(@Query('termId') termId?: string) {
    return this.workloadService.getConflicts(termId);
  }

  @Get('utilization')
  async getUtilization(@Query('termId') termId?: string) {
    return this.workloadService.getUtilization(termId);
  }
}
