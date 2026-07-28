import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AssessmentEngineService } from './assessment-engine.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('assessment-engine')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Director', 'Teacher', 'Class Teacher')
export class AssessmentEngineController {
  constructor(private assessmentEngine: AssessmentEngineService) {}

  @Post('definitions')
  createDefinition(@Request() req, @Body() body: any) {
    return this.assessmentEngine.createAssessmentDefinition(req.user.schoolId, body);
  }

  @Get('definitions')
  getDefinitions(@Request() req, @Query('activeOnly') activeOnly?: string) {
    return this.assessmentEngine.getAssessmentDefinitions(
      req.user.schoolId,
      activeOnly !== 'false',
    );
  }

  @Put('definitions/:id')
  updateDefinition(@Param('id') id: string, @Body() body: any) {
    return this.assessmentEngine.updateAssessmentDefinition(id, body);
  }

  @Delete('definitions/:id')
  deleteDefinition(@Param('id') id: string) {
    return this.assessmentEngine.deleteAssessmentDefinition(id);
  }

  @Post('configure')
  configureTermAssessment(@Request() req, @Body() body: any) {
    return this.assessmentEngine.configureTermAssessment(req.user.schoolId, body);
  }

  @Get('configurations')
  getConfigurations(
    @Query('classId') classId: string,
    @Query('subjectId') subjectId: string,
    @Query('termId') termId: string,
  ) {
    return this.assessmentEngine.getTermAssessmentConfigurations(classId, subjectId, termId);
  }

  @Put('configurations')
  updateConfiguration(@Request() req, @Body() body: any) {
    return this.assessmentEngine.updateTermAssessmentConfiguration(
      req.user.schoolId,
      body.classId,
      body.subjectId,
      body.termId,
      body.assessmentDefId,
      {
        weightPercentage: body.weightPercentage,
        maxScore: body.maxScore,
        mandatory: body.mandatory,
      },
    );
  }

  @Post('scores/bulk')
  bulkEnterScores(@Request() req, @Body() body: any) {
    return this.assessmentEngine.bulkEnterScores(req.user.schoolId, {
      ...body,
      enteredBy: req.user.userId,
    });
  }

  @Post('scores')
  enterSingleScore(@Request() req, @Body() body: any) {
    return this.assessmentEngine.enterSingleScore(req.user.schoolId, {
      ...body,
      enteredBy: req.user.userId,
    });
  }

  @Get('results/student/:studentId')
  getStudentResults(
    @Param('studentId') studentId: string,
    @Query('termId') termId?: string,
  ) {
    return this.assessmentEngine.getStudentResults(studentId, termId);
  }

  @Get('results/class')
  getClassResults(
    @Query('classId') classId: string,
    @Query('subjectId') subjectId: string,
    @Query('termId') termId: string,
    @Query('assessmentDefId') assessmentDefId?: string,
  ) {
    return this.assessmentEngine.getClassResults(classId, subjectId, termId, assessmentDefId);
  }

  @Get('batches/:batchId')
  getBatchResults(@Param('batchId') batchId: string) {
    return this.assessmentEngine.getBatchResults(batchId);
  }

  @Post('batches/:batchId/verify')
  verifyBatch(@Param('batchId') batchId: string, @Request() req) {
    return this.assessmentEngine.verifyBatch(batchId, req.user.userId);
  }

  @Post('batches/:batchId/lock')
  lockBatch(@Param('batchId') batchId: string) {
    return this.assessmentEngine.lockBatch(batchId);
  }

  @Get('teacher/pending')
  getTeacherPendingAssessments(@Request() req) {
    return this.assessmentEngine.getTeacherPendingAssessments(req.user.userId, req.user.schoolId);
  }

  @Get('completion-stats')
  getCompletionStats(
    @Query('classId') classId: string,
    @Query('subjectId') subjectId: string,
    @Query('termId') termId: string,
  ) {
    return this.assessmentEngine.getAssessmentCompletionStats(classId, subjectId, termId);
  }
}
