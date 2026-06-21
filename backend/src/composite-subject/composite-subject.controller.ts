import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CompositeSubjectService } from './composite-subject.service';

@Controller('composite-subjects')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CompositeSubjectController {
  constructor(private readonly service: CompositeSubjectService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'Director')
  create(@Body() body: {
    name: string;
    code: string;
    curriculumId: string;
    calculationMethod?: string;
    schoolId?: string;
    components: { subjectId: string; weight: number }[];
  }) {
    return this.service.create(body);
  }

  @Get()
  findAll(
    @Query('curriculumId') curriculumId?: string,
    @Query('schoolId') schoolId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.service.findAll({
      curriculumId,
      schoolId,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'Director')
  update(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      code?: string;
      calculationMethod?: string;
      isActive?: boolean;
      components?: { subjectId: string; weight: number }[];
    },
  ) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'Director')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/recompute')
  @Roles('SUPER_ADMIN', 'Director')
  async recompute(
    @Param('id') id: string,
    @Body() body: { classId: string; termId: string; schoolId: string; studentIds?: string[] },
  ) {
    const enrollments = body.studentIds
      ? body.studentIds.map(sid => ({ studentId: sid }))
      : await this.service.findEnrollments(body.classId, body.termId);

    let count = 0;
    for (const enrollment of enrollments) {
      const result = await this.service.computeCompositeForStudent(
        id,
        enrollment.studentId,
        body.termId,
        body.classId,
        body.schoolId,
      );
      if (result) count++;
    }
    return { recomputed: count };
  }

  @Get('student/:studentId/:termId')
  async getStudentCompositeResults(
    @Param('studentId') studentId: string,
    @Param('termId') termId: string,
    @Query('schoolId') schoolId: string,
    @Query('classId') classId: string,
  ) {
    return this.service.getCompositeResultsForStudent(studentId, termId, classId, schoolId);
  }
}
