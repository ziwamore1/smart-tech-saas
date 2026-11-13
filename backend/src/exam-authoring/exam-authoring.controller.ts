import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Request, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateBlueprintInput, ExamAuthoringService } from './exam-authoring.service';
import { ExamArtifactType } from '@prisma/client';
import { ExamExportService } from './exam-export.service';
import { DiagramInput, ExamDiagramService } from './exam-diagram.service';
import { AiExaminorService } from '../curriculum-intelligence/ai-examinor.service';

const AUTHORING_ROLES = ['Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher'];

@Controller('exam-authoring')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ExamAuthoringController {
  constructor(private readonly service: ExamAuthoringService, private readonly aiExaminor: AiExaminorService, private readonly exportService: ExamExportService, private readonly diagrams: ExamDiagramService) {}

  @Get('dashboard')
  getDashboard(@Request() req: any) { return this.service.getDashboard(req.user.schoolId); }

  @Get('providers')
  getProviders() { return this.aiExaminor.getProviderStatus(); }

  @Get('blueprints')
  listBlueprints(@Request() req: any, @Query('subjectId') subjectId?: string, @Query('status') status?: string) { return this.service.listBlueprints(req.user.schoolId, { subjectId, status }); }

  @Get('examinations')
  listExaminations(@Request() req: any, @Query() query: { search?: string; status?: any; subjectId?: string; page?: number; limit?: number }) { return this.service.listExaminations(req.user.schoolId, query); }

  @Get('examinations/:id/versions')
  listVersions(@Request() req: any, @Param('id') id: string) { return this.service.listVersions(req.user.schoolId, id); }

  @Get('blueprints/:id')
  getBlueprint(@Request() req: any, @Param('id') id: string) { return this.service.getBlueprint(req.user.schoolId, id); }

  @Post('blueprints')
  @Roles(...AUTHORING_ROLES)
  createBlueprint(@Request() req: any, @Body() body: CreateBlueprintInput) { return this.service.createBlueprint(req.user.schoolId, req.user.id, body); }

  @Patch('blueprints/:id/approve')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD')
  approveBlueprint(@Request() req: any, @Param('id') id: string) { return this.service.approveBlueprint(req.user.schoolId, id); }

  @Post('drafts')
  @Roles(...AUTHORING_ROLES)
  createDraft(@Request() req: any, @Body() body: any) { return this.service.createExamDraft({ ...body, schoolId: req.user.schoolId, createdById: req.user.id }); }

  @Post('generate')
  @Roles(...AUTHORING_ROLES)
  async generateDraft(@Request() req: any, @Body() body: any) {
    const blueprint = await this.service.getBlueprint(req.user.schoolId, body.blueprintId);
    if (!blueprint.isApproved) throw new ForbiddenException('An approved examination blueprint is required');
    const structure = blueprint.structure as any;
    const job = await this.service.startGenerationJob(req.user.schoolId, req.user.id, { ...body, subjectId: blueprint.subjectId, blueprintId: blueprint.id });
    try {
      const artifact = await this.aiExaminor.generate({ ...body, subjectId: blueprint.subjectId, totalMarks: structure.totalMarks, durationMinutes: structure.durationMinutes, sections: structure.sections, topicPlan: structure.topicPlan, cognitiveDistribution: structure.cognitiveDistribution, difficultyDistribution: structure.difficultyDistribution }, { requireProvider: true });
      const exam = await this.service.createExamDraft({ ...body, blueprintId: blueprint.id, subjectId: blueprint.subjectId, schoolId: req.user.schoolId, createdById: req.user.id, generationJobId: job.id, artifact });
      await this.service.finishGenerationJob(job.id, { versionId: exam?.versions?.[0]?.id, examId: exam?.id });
      return exam;
    } catch (error) {
      await this.service.finishGenerationJob(job.id, undefined, (error as Error).message);
      throw error;
    }
  }

  @Get('versions/:id')
  getVersion(@Request() req: any, @Param('id') id: string) { return this.service.getVersion(req.user.schoolId, id); }

  @Post('versions/:id/duplicate')
  @Roles(...AUTHORING_ROLES)
  duplicateVersion(@Request() req: any, @Param('id') id: string, @Body('restore') restore?: boolean) { return this.service.duplicateVersion(req.user.schoolId, id, req.user.id, Boolean(restore)); }

  @Patch('questions/:id')
  @Roles(...AUTHORING_ROLES)
  updateQuestion(@Request() req: any, @Param('id') id: string, @Body() body: any) { return this.service.updateQuestion(req.user.schoolId, id, req.user.id, body); }

  @Patch('marking-entries/:id')
  @Roles(...AUTHORING_ROLES)
  updateMarkingEntry(@Request() req: any, @Param('id') id: string, @Body() body: any) { return this.service.updateMarkingEntry(req.user.schoolId, id, req.user.id, body); }

  @Post('versions/:id/questions/:questionNumber/regenerate')
  @Roles(...AUTHORING_ROLES)
  async regenerateQuestion(@Request() req: any, @Param('id') id: string, @Param('questionNumber') questionNumber: string, @Body() body: { instruction?: string; topic?: string }) {
    const version = await this.service.getVersion(req.user.schoolId, id);
    const blueprint = version.exam?.blueprintId ? await this.service.getBlueprint(req.user.schoolId, version.exam.blueprintId) : null;
    if (!blueprint?.isApproved) throw new ForbiddenException('An approved blueprint is required before regenerating a question');
    const question = (version.snapshot as any)?.sections?.flatMap((section: any) => section.questions || []).find((item: any) => Number(item.number) === Number(questionNumber));
    if (!question) throw new ForbiddenException(`Question ${questionNumber} was not found`);
    const structure: any = blueprint.structure;
    const artifact = await this.aiExaminor.generate({ subjectId: blueprint.subjectId, totalMarks: Number(question.marks), durationMinutes: structure.durationMinutes, title: version.exam.title, sections: [{ code: 'R', title: 'Regenerated item', totalMarks: Number(question.marks), itemCount: 1, answerRule: 'ALL', questionTypes: [question.type || 'STRUCTURED'] }], includeTopics: body.topic ? [body.topic] : undefined, instruction: `Regenerate only question ${questionNumber}. Preserve its marks (${question.marks}) and create a new, non-duplicated assessment task. ${body.instruction || ''}` }, { requireProvider: true });
    return this.service.replaceGeneratedQuestion(req.user.schoolId, id, Number(questionNumber), req.user.id, artifact.sections[0].questions[0]);
  }

  @Post('versions/:id/regenerate')
  @Roles(...AUTHORING_ROLES)
  async regenerateVersion(@Request() req: any, @Param('id') id: string, @Body() body: { instruction?: string }) {
    const version = await this.service.getVersion(req.user.schoolId, id);
    const blueprint = version.exam?.blueprintId ? await this.service.getBlueprint(req.user.schoolId, version.exam.blueprintId) : null;
    if (!blueprint?.isApproved) throw new ForbiddenException('An approved blueprint is required before regenerating the draft');
    const structure: any = blueprint.structure;
    const artifact = await this.aiExaminor.generate({
      schoolId: req.user.schoolId,
      subjectId: version.exam.subjectId,
      totalMarks: structure.totalMarks,
      durationMinutes: structure.durationMinutes,
      title: version.exam.title,
      sections: structure.sections,
      topicPlan: structure.topicPlan,
      cognitiveDistribution: structure.cognitiveDistribution,
      difficultyDistribution: structure.difficultyDistribution,
      instruction: `Regenerate the complete examination draft. Preserve the approved section structure and mark budget. Replace weak, duplicated or incomplete items with candidate-ready tasks and a complete marking scheme. ${body?.instruction || ''}`.trim(),
    });
    return this.service.regenerateVersion(req.user.schoolId, id, req.user.id, artifact, 'Full draft regenerated after validation findings; validation rerun.');
  }

  @Post('versions/:id/validate')
  @Roles(...AUTHORING_ROLES)
  validateVersion(@Request() req: any, @Param('id') id: string) { return this.service.validateVersion(req.user.schoolId, id, req.user.id); }

  @Post('versions/:id/submit-moderation')
  @Roles(...AUTHORING_ROLES)
  submitForModeration(@Request() req: any, @Param('id') id: string) { return this.service.submitForModeration(req.user.schoolId, id, req.user.id); }

  @Post('versions/:id/moderate')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD')
  moderate(@Request() req: any, @Param('id') id: string, @Body() body: { decision: 'APPROVED' | 'REJECTED'; comments?: string }) { return this.service.moderate(req.user.schoolId, id, req.user.id, body.decision, body.comments); }

  @Post('versions/:id/export')
  @Roles(...AUTHORING_ROLES)
  exportVersion(@Request() req: any, @Param('id') id: string, @Body('type') type: ExamArtifactType) { return this.exportService.exportVersion(req.user.schoolId, id, type || ExamArtifactType.CANDIDATE_PDF); }

  @Post('versions/:id/diagrams')
  @Roles(...AUTHORING_ROLES)
  createDiagram(@Request() req: any, @Param('id') id: string, @Body() body: DiagramInput) { return this.diagrams.create(req.user.schoolId, id, body); }

  @Patch('diagrams/:id')
  @Roles(...AUTHORING_ROLES)
  updateDiagram(@Request() req: any, @Param('id') id: string, @Body('definition') definition: any) { return this.diagrams.update(req.user.schoolId, id, definition); }

  @Get('artifacts/:id')
  async downloadArtifact(@Request() req: any, @Param('id') id: string, @Res() response: Response) {
    const result = await this.exportService.getArtifact(req.user.schoolId, id);
    if (result.artifact.downloadUrl) return response.redirect(result.artifact.downloadUrl);
    response.type(result.artifact.mimeType).send(result.buffer);
  }
}
