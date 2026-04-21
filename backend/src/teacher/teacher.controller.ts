import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  Req,
  Logger,
} from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('teacher')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeacherController {
  private readonly logger = new Logger(TeacherController.name);

  constructor(private teacherService: TeacherService) {}

  @Get('dashboard')
  @Roles('Teacher')
  getDashboard(
    @Req() req,
    @Query('academicYearId') academicYearId?: string,
    @Query('termId') termId?: string,
  ) {
    return this.teacherService.getDashboard(
      req.user.sub,
      req.user.schoolId,
      academicYearId,
      termId,
    );
  }

  @Get()
  @Roles('Director')
  findAll(@Req() req: any) {
    this.logger.log(`findAll called: userId=${req.user.id}, schoolId=${req.user.schoolId}`);
    return this.teacherService.findAll(req.user.schoolId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.teacherService.findOne(id);
  }

  @Post()
  @Roles('Director')
  create(@Body() body: any, @Req() req: any) {
    return this.teacherService.create(body, req.user.schoolId);
  }

  @Put(':id')
  @Roles('Director')
  update(@Param('id') id: string, @Body() body: any) {
    return this.teacherService.update(id, body);
  }

  @Delete(':id')
  @Roles('Director')
  delete(@Param('id') id: string) {
    return this.teacherService.delete(id);
  }

  @Get('subjects')
  getAssignedSubjects(@Req() req: any) {
    return this.teacherService.getAssignedSubjects(req.user.id);
  }

  @Get('class-students')
  getClassStudents(@Query('classId') classId: string) {
    return this.teacherService.getClassStudents(classId);
  }

  @Post('enter-marks')
  enterMarks(@Req() req: any, @Body() body) {
    return this.teacherService.enterMarks({
      ...body,
      teacherId: req.user.id,
      schoolId: req.user.schoolId,
    });
  }
}
