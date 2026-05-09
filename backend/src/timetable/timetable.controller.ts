import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  Delete,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { TimetableService } from './timetable.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TimetableQueueService } from './solver/timetable-queue.service';

interface AuthenticatedRequest {
  user: {
    sub: string;
    schoolId: string;
    roles: string[];
  };
}

@Controller('timetable')
export class TimetableController {
  constructor(
    private readonly timetableService: TimetableService,
    private readonly queueService: TimetableQueueService,
  ) {}

  // ==================== PUBLIC VIEWING ENDPOINTS ====================

  // Get current term for school
  @UseGuards(JwtAuthGuard)
  @Get('current-term')
  async getCurrentTerm(@Request() req: AuthenticatedRequest) {
    return this.timetableService.getCurrentTerm(req.user.schoolId);
  }

  // Get teacher's timetable (for teachers viewing their own)
  @UseGuards(JwtAuthGuard)
  @Get('my-timetable')
  async getMyTimetable(
    @Request() req: AuthenticatedRequest,
    @Query('termId') termId?: string,
  ) {
    const teacher = await this.timetableService.getTeacherByUserId(
      req.user.sub,
    );
    if (!teacher) {
      throw new ForbiddenException('Teacher profile not found');
    }
    const effectiveTermId =
      termId ||
      (await this.timetableService.getCurrentTermId(req.user.schoolId));
    return this.timetableService.getTeacherTimetable(
      teacher.id,
      effectiveTermId,
    );
  }

  // Get student's timetable (for students viewing their own)
  @UseGuards(JwtAuthGuard)
  @Get('student/timetable')
  async getStudentTimetable(
    @Request() req: AuthenticatedRequest,
    @Query('termId') termId?: string,
  ) {
    const student = await this.timetableService.getStudentByUserId(
      req.user.sub,
    );
    if (!student) {
      throw new ForbiddenException('Student profile not found');
    }
    const effectiveTermId =
      termId ||
      (await this.timetableService.getCurrentTermId(req.user.schoolId));
    return this.timetableService.getStudentTimetable(
      student.id,
      effectiveTermId,
    );
  }

  // Get parent's children's timetables
  @UseGuards(JwtAuthGuard)
  @Get('parent/children-timetable')
  async getChildrenTimetables(
    @Request() req: AuthenticatedRequest,
    @Query('termId') termId?: string,
  ) {
    const parent = await this.timetableService.getParentByUserId(req.user.sub);
    if (!parent) {
      throw new ForbiddenException('Parent profile not found');
    }
    const effectiveTermId =
      termId ||
      (await this.timetableService.getCurrentTermId(req.user.schoolId));
    return this.timetableService.getChildrenTimetables(
      parent.id,
      effectiveTermId,
    );
  }

  // Get specific child's timetable by studentId
  @UseGuards(JwtAuthGuard)
  @Get('parent/child/:studentId')
  async getChildTimetable(
    @Request() req: AuthenticatedRequest,
    @Param('studentId') studentId: string,
    @Query('termId') termId?: string,
  ) {
    // Verify the parent has access to this child
    const parent = await this.timetableService.getParentByUserId(req.user.sub);
    if (!parent) {
      throw new ForbiddenException('Parent profile not found');
    }

    const hasAccess = await this.timetableService.verifyParentChildAccess(
      parent.id,
      studentId,
    );
    if (!hasAccess) {
      throw new ForbiddenException("Access denied to this student's timetable");
    }

    const effectiveTermId =
      termId ||
      (await this.timetableService.getCurrentTermId(req.user.schoolId));
    return this.timetableService.getStudentTimetable(
      studentId,
      effectiveTermId,
    );
  }

  // ==================== CLASS TIMETABLE (Admin/Director) ====================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin', 'Teacher')
  @Get('class')
  getClassTimetable(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
  ) {
    return this.timetableService.getClassTimetable(classId, termId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin', 'Teacher')
  @Get('class/list')
  getClassesWithTimetables(
    @Query('termId') termId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.timetableService.getClassesWithTimetables(
      termId,
      req.user.schoolId,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin', 'Teacher')
  @Get('lesson-requirements')
  getLessonRequirements(@Query('classId') classId: string) {
    return this.timetableService.getLessonRequirements(classId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  @Get('lesson-requirements/all')
  getAllLessonRequirements(@Request() req: AuthenticatedRequest) {
    return this.timetableService.getAllLessonRequirements(req.user.schoolId);
  }

  // ==================== TEACHER TIMETABLE (Admin/Director) ====================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin', 'Teacher')
  @Get('teacher')
  getTeacherTimetable(
    @Query('teacherId') teacherId: string,
    @Query('termId') termId: string,
  ) {
    return this.timetableService.getTeacherTimetable(teacherId, termId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  @Get('teacher/list')
  getTeachersWithTimetables(
    @Query('termId') termId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.timetableService.getTeachersWithTimetables(
      termId,
      req.user.schoolId,
    );
  }

  // ==================== ROOM TIMETABLE (Admin/Director) ====================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin', 'Teacher')
  @Get('room')
  getRoomTimetable(
    @Query('roomId') roomId: string,
    @Query('termId') termId: string,
  ) {
    return this.timetableService.getRoomTimetable(roomId, termId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  @Get('room/list')
  getRooms(@Request() req: AuthenticatedRequest) {
    return this.timetableService.getRooms(req.user.schoolId);
  }

  // ==================== TIMETABLE MANAGEMENT (Admin/Director Only) ====================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  @Post('lesson-requirement')
  createLessonRequirement(
    @Request() req: AuthenticatedRequest,
    @Body()
    body: {
      classId: string;
      subjectId: string;
      teacherId: string;
      lessonsPerWeek: number;
      lessonType?: string;
    },
  ) {
    return this.timetableService.createLessonRequirement(
      req.user.schoolId,
      body.classId,
      body.subjectId,
      body.teacherId,
      body.lessonsPerWeek,
      body.lessonType,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  @Delete('lesson-requirement/:id')
  deleteLessonRequirement(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.timetableService.deleteLessonRequirement(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  @Delete('lesson-requirements/class/:classId')
  deleteLessonRequirementsByClass(
    @Param('classId') classId: string,
  ) {
    return this.timetableService.deleteLessonRequirementsByClass(classId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  @Post('generate/:classId')
  generateTimetable(
    @Request() req: AuthenticatedRequest,
    @Param('classId') classId: string,
    @Body()
    body: {
      termId: string;
    },
  ) {
    console.log('--- TIMETABLE GENERATE REQUEST ---');
    console.log('classId (from URL param):', classId);
    console.log('schoolId (from auth):', req.user.schoolId);
    console.log('termId (from body):', body.termId);
    console.log('---------------------------------');
    return this.timetableService.generateTimetableWithAI(
      req.user.schoolId,
      body.termId,
      classId,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  @Post('generate-ai/:classId')
  async generateTimetableAI(
    @Request() req: AuthenticatedRequest,
    @Param('classId') classId: string,
    @Body()
    body: {
      termId: string;
    },
  ) {
    console.log('--- AI TIMETABLE GENERATE REQUEST ---');
    console.log('classId (from URL param):', classId);
    console.log('schoolId (from auth):', req.user.schoolId);
    console.log('termId (from body):', body.termId);
    console.log('--------------------------------------');
    return this.timetableService.generateTimetableWithAI(
      req.user.schoolId,
      body.termId,
      classId,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  @Delete(':timetableId')
  deleteTimetable(
    @Param('timetableId') timetableId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.timetableService.deleteTimetable(timetableId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  @Post(':timetableId/publish')
  publishTimetable(
    @Param('timetableId') timetableId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.timetableService.publishTimetable(timetableId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  @Post(':timetableId/unpublish')
  unpublishTimetable(
    @Param('timetableId') timetableId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.timetableService.unpublishTimetable(timetableId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin', 'Teacher')
  @Post('moveSlot/:slotId')
  moveSlot(
    @Param('slotId') slotId: string,
    @Body() body: { day: number; period: number },
  ) {
    return this.timetableService.moveSlot(slotId, body.day, body.period);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin', 'Teacher')
  @Post('swapSlot/:slotId')
  swapSlot(
    @Param('slotId') slotId: string,
    @Body()
    body: {
      sourceSlotId: string;
      targetDay: number;
      targetPeriod: number;
    },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.timetableService.swapSlot(
      body.sourceSlotId,
      body.targetDay,
      body.targetPeriod,
      req.user?.sub || 'system',
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin', 'Teacher')
  @Post('previewMove')
  previewMove(
    @Body()
    body: {
      slotId: string;
      targetDay: number;
      targetPeriod: number;
    },
  ) {
    return this.timetableService.previewMove(
      body.slotId,
      body.targetDay,
      body.targetPeriod,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  @Post('snapshot/:timetableId')
  createSnapshot(
    @Param('timetableId') timetableId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.timetableService.createTimetableSnapshot(timetableId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  @Get('versions/:timetableId')
  getVersions(@Param('timetableId') timetableId: string) {
    return this.timetableService.getVersions(timetableId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  @Post('restoreVersion/:versionId')
  restoreVersion(
    @Param('versionId') versionId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.timetableService.restoreVersion(versionId);
  }

  // ==================== QUEUE-BASED GENERATION (For 100+ Schools) ====================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  @Post('generate/queue/all-classes')
  async generateAllClasses(
    @Request() req: AuthenticatedRequest,
    @Body() body: { termId: string },
  ) {
    const jobId = await this.queueService.addGenerationJob({
      schoolId: req.user.schoolId,
      termId: body.termId,
      requestedBy: req.user.sub,
    });
    return { jobId, message: 'Timetable generation job queued' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  @Post('generate/queue/classes')
  async generateSelectedClasses(
    @Request() req: AuthenticatedRequest,
    @Body() body: { termId: string; classIds: string[] },
  ) {
    const jobId = await this.queueService.addGenerationJob({
      schoolId: req.user.schoolId,
      termId: body.termId,
      classIds: body.classIds,
      requestedBy: req.user.sub,
    });
    return { jobId, message: 'Timetable generation job queued' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  @Get('job/:jobId/status')
  async getJobStatus(@Param('jobId') jobId: string) {
    const progress = this.queueService.getProgress(jobId);
    if (!progress) {
      return { error: 'Job not found', jobId };
    }
    return { ...progress };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Admin')
  @Get('job/status/list')
  getSchoolJobStatus(@Request() req: AuthenticatedRequest) {
    return this.queueService.getSchoolProgress(req.user.schoolId);
  }
}
