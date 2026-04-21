import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LessonPlanService } from './lesson-plan.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('lesson-plans')
@UseGuards(JwtAuthGuard)
export class LessonPlanController {
  constructor(private lessonPlanService: LessonPlanService) {}

  @Get()
  async findAll(@Req() req: any, @Query('classId') classId?: string, @Query('subjectId') subjectId?: string, @Query('status') status?: string) {
    const schoolId = req.user?.schoolId;
    return this.lessonPlanService.findAll(schoolId, { classId, subjectId, status });
  }

  @Get('weekly')
  async getWeeklyPlans(@Req() req: any, @Query('weekStart') weekStart?: string) {
    const schoolId = req.user?.schoolId;
    const startDate = weekStart ? new Date(weekStart) : new Date();
    return this.lessonPlanService.getWeeklyPlans(schoolId, startDate);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const schoolId = req.user?.schoolId;
    return this.lessonPlanService.findOne(id, schoolId);
  }

  @Post()
  @Roles('Director', 'Teacher')
  async create(@Body() body: any, @Req() req: any) {
    const schoolId = req.user?.schoolId;
    const userId = req.user?.id;
    return this.lessonPlanService.create(body, schoolId, userId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const schoolId = req.user?.schoolId;
    return this.lessonPlanService.update(id, body, schoolId);
  }

  @Delete(':id')
  @Roles('Director')
  async delete(@Param('id') id: string, @Req() req: any) {
    const schoolId = req.user?.schoolId;
    return this.lessonPlanService.delete(id, schoolId);
  }
}