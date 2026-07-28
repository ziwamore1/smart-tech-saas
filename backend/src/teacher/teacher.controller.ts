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
  @Roles('Director', 'Deputy Director', 'SuperAdmin', 'Head Teacher')
  findAll(@Query('schoolId') schoolId?: string, @Req() req?: any) {
    const targetSchoolId = schoolId || req?.user?.schoolId;
    return this.teacherService.findAll(targetSchoolId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.teacherService.findOne(id);
  }

  @Post()
  @Roles('Director', 'Deputy Director')
  create(@Body() body: any, @Req() req: any) {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      console.error('Teacher creation failed: No schoolId found for user', req.user);
      throw new Error('Cannot create teacher: User is not associated with a school. Please log out and log back in.');
    }
    return this.teacherService.create(body, schoolId);
  }

  @Put(':id')
  @Roles('Director', 'Deputy Director')
  update(@Param('id') id: string, @Body() body: any) {
    return this.teacherService.update(id, body);
  }

  @Delete(':id')
  @Roles('Director', 'Deputy Director')
  delete(@Param('id') id: string) {
    return this.teacherService.delete(id);
  }

  @Get('subjects')
  getAssignedSubjects(@Req() req: any) {
    return this.teacherService.getAssignedSubjects(req.user.id);
  }

  @Get('classes')
  @Roles('Teacher')
  getClasses(@Req() req: any) {
    return this.teacherService.getTeacherClasses(req.user.id, req.user.schoolId);
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
