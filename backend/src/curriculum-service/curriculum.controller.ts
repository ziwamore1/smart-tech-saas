import {
  Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurriculumService } from './curriculum.service';
import { Grade7EngineService } from './grade7-engine.service';
import { SelectionAnalyticsService } from './selection-analytics.service';
import { EducationLevelCategory, SubjectCategory, PathwayType } from '@prisma/client';

@Controller('curriculum')
@UseGuards(AuthGuard('jwt'))
export class CurriculumController {
  constructor(
    private curriculumService: CurriculumService,
    private grade7Engine: Grade7EngineService,
    private selectionAnalytics: SelectionAnalyticsService,
  ) {}

  // ===================== EDUCATION LEVELS =====================

  @Post('education-levels')
  createEducationLevel(@Body() body: {
    name: string; code: EducationLevelCategory; description?: string; schoolId?: string;
  }) {
    return this.curriculumService.createEducationLevel(body);
  }

  @Get('education-levels')
  getEducationLevels(@Query('schoolId') schoolId?: string) {
    return this.curriculumService.getEducationLevels(schoolId);
  }

  @Get('education-levels/:id')
  getEducationLevel(@Param('id') id: string) {
    return this.curriculumService.getEducationLevel(id);
  }

  @Patch('education-levels/:id')
  updateEducationLevel(@Param('id') id: string, @Body() body: any) {
    return this.curriculumService.updateEducationLevel(id, body);
  }

  @Delete('education-levels/:id')
  deleteEducationLevel(@Param('id') id: string) {
    return this.curriculumService.deleteEducationLevel(id);
  }

  // ===================== CURRICULUM VERSIONS =====================

  @Post('versions')
  createVersion(@Body() body: {
    name: string; code: string; description?: string; educationLevelId: string;
    effectiveFrom?: string; effectiveTo?: string; isCurrent?: boolean; schoolId?: string;
  }) {
    return this.curriculumService.createCurriculumVersion(body);
  }

  @Get('versions')
  getVersions(@Query('educationLevelId') elId?: string, @Query('schoolId') schoolId?: string) {
    return this.curriculumService.getCurriculumVersions(elId, schoolId);
  }

  @Get('versions/:id')
  getVersion(@Param('id') id: string) {
    return this.curriculumService.getCurriculumVersion(id);
  }

  @Patch('versions/:id')
  updateVersion(@Param('id') id: string, @Body() body: any) {
    return this.curriculumService.updateCurriculumVersion(id, body);
  }

  @Delete('versions/:id')
  deleteVersion(@Param('id') id: string) {
    return this.curriculumService.deleteCurriculumVersion(id);
  }

  // ===================== ACADEMIC STAGES =====================

  @Post('stages')
  createStage(@Body() body: {
    name: string; code: string; sortOrder: number; educationLevelId: string;
    curriculumVersionId?: string; schoolId?: string;
  }) {
    return this.curriculumService.createAcademicStage(body);
  }

  @Get('stages')
  getStages(@Query('educationLevelId') elId?: string, @Query('curriculumVersionId') cvId?: string) {
    return this.curriculumService.getAcademicStages(elId, cvId);
  }

  @Get('stages/:id')
  getStage(@Param('id') id: string) {
    return this.curriculumService.getAcademicStage(id);
  }

  @Patch('stages/:id')
  updateStage(@Param('id') id: string, @Body() body: any) {
    return this.curriculumService.updateAcademicStage(id, body);
  }

  @Delete('stages/:id')
  deleteStage(@Param('id') id: string) {
    return this.curriculumService.deleteAcademicStage(id);
  }

  // ===================== SUBJECT GROUPS =====================

  @Post('subject-groups')
  createSubjectGroup(@Body() body: {
    name: string; code: string; description?: string; category: SubjectCategory;
    curriculumVersionId?: string; minSelection?: number; maxSelection?: number; schoolId?: string;
  }) {
    return this.curriculumService.createSubjectGroup(body);
  }

  @Get('subject-groups')
  getSubjectGroups(@Query('curriculumVersionId') cvId?: string, @Query('schoolId') schoolId?: string) {
    return this.curriculumService.getSubjectGroups(cvId, schoolId);
  }

  @Post('subject-groups/:groupId/subjects/:subjectId')
  assignSubjectToGroup(
    @Param('groupId') groupId: string,
    @Param('subjectId') subjectId: string,
    @Body() body: { isCompulsory?: boolean; sortOrder?: number },
  ) {
    return this.curriculumService.assignSubjectToGroup({
      subjectGroupId: groupId, subjectId, ...body,
    });
  }

  @Delete('subject-groups/:groupId/subjects/:subjectId')
  removeSubjectFromGroup(@Param('groupId') groupId: string, @Param('subjectId') subjectId: string) {
    return this.curriculumService.removeSubjectFromGroup(groupId, subjectId);
  }

  // ===================== SUBJECT COMBINATION RULES =====================

  @Post('subject-combination-rules')
  createCombinationRule(@Body() body: {
    name: string; code: string; description?: string; subjectGroupId: string;
    includedSubjects: string[]; allowedAlternatives?: string[]; schoolId?: string;
  }) {
    return this.curriculumService.createSubjectCombinationRule(body);
  }

  @Get('subject-combination-rules')
  getCombinationRules(@Query('subjectGroupId') sgId?: string) {
    return this.curriculumService.getSubjectCombinationRules(sgId);
  }

  // ===================== CONVERSION RULES =====================

  @Post('conversion-rules')
  createConversionRule(@Body() body: {
    name: string; subjectId: string; actualMaxScore?: number; standardizedMax?: number;
    conversionMultiplier?: number; conversionFormula?: string; effectiveYear?: number;
    curriculumVersionId?: string; schoolId?: string;
  }) {
    return this.curriculumService.createConversionRule(body);
  }

  @Get('conversion-rules')
  getConversionRules(@Query('subjectId') subjectId?: string, @Query('curriculumVersionId') cvId?: string) {
    return this.curriculumService.getConversionRules(subjectId, cvId);
  }

  @Patch('conversion-rules/:id')
  updateConversionRule(@Param('id') id: string, @Body() body: any) {
    return this.curriculumService.updateConversionRule(id, body);
  }

  @Delete('conversion-rules/:id')
  deleteConversionRule(@Param('id') id: string) {
    return this.curriculumService.deleteConversionRule(id);
  }

  // ===================== DIVISION RULES =====================

  @Post('division-rules')
  createDivisionRule(@Body() body: {
    name: string; code: string; division: string; minScore: number; maxScore: number;
    description?: string; label?: string; color?: string; curriculumVersionId?: string;
    examStructureId?: string; schoolId?: string; sortOrder?: number;
  }) {
    return this.curriculumService.createDivisionRule(body);
  }

  @Get('division-rules')
  getDivisionRules(@Query('curriculumVersionId') cvId?: string, @Query('examStructureId') esId?: string) {
    return this.curriculumService.getDivisionRules(cvId, esId);
  }

  @Patch('division-rules/:id')
  updateDivisionRule(@Param('id') id: string, @Body() body: any) {
    return this.curriculumService.updateDivisionRule(id, body);
  }

  // ===================== PERFORMANCE CATEGORIES =====================

  @Post('performance-categories')
  createPerformanceCategory(@Body() body: {
    name: string; label: string; labelLocal?: string; minScore?: number; maxScore?: number;
    description?: string; color?: string; curriculumVersionId?: string;
    schoolId?: string; sortOrder?: number;
  }) {
    return this.curriculumService.createPerformanceCategory(body);
  }

  @Get('performance-categories')
  getPerformanceCategories(@Query('curriculumVersionId') cvId?: string) {
    return this.curriculumService.getPerformanceCategories(cvId);
  }

  // ===================== EXAM STRUCTURES =====================

  @Post('exam-structures')
  createExamStructure(@Body() body: {
    name: string; code: string; description?: string; academicStageId: string;
    curriculumVersionId?: string; totalMarks?: number; passMark?: number;
    duration?: number; schoolId?: string;
  }) {
    return this.curriculumService.createExamStructure(body);
  }

  @Get('exam-structures')
  getExamStructures(@Query('academicStageId') asId?: string, @Query('curriculumVersionId') cvId?: string) {
    return this.curriculumService.getExamStructures(asId, cvId);
  }

  @Get('exam-structures/:id')
  getExamStructure(@Param('id') id: string) {
    return this.curriculumService.getExamStructure(id);
  }

  @Patch('exam-structures/:id')
  updateExamStructure(@Param('id') id: string, @Body() body: any) {
    return this.curriculumService.updateExamStructure(id, body);
  }

  @Delete('exam-structures/:id')
  deleteExamStructure(@Param('id') id: string) {
    return this.curriculumService.deleteExamStructure(id);
  }

  // ===================== EXAM COMPONENTS =====================

  @Post('exam-components')
  createExamComponent(@Body() body: {
    name: string; code: string; description?: string; examStructureId: string;
    maxScore: number; weight?: number; sortOrder?: number; isGroupComponent?: boolean;
    groupId?: string; schoolId?: string;
  }) {
    return this.curriculumService.createExamComponent(body);
  }

  @Get('exam-structures/:examStructureId/components')
  getExamComponents(@Param('examStructureId') esId: string) {
    return this.curriculumService.getExamComponents(esId);
  }

  @Patch('exam-components/:id')
  updateExamComponent(@Param('id') id: string, @Body() body: any) {
    return this.curriculumService.updateExamComponent(id, body);
  }

  @Delete('exam-components/:id')
  deleteExamComponent(@Param('id') id: string) {
    return this.curriculumService.deleteExamComponent(id);
  }

  // ===================== BEST SUBJECT RULES =====================

  @Post('best-subject-rules')
  createBestSubjectRule(@Body() body: {
    name: string; code: string; description?: string; count?: number;
    mustIncludeSubjectIds: string[]; excludeSubjectIds?: string[];
    priorityGroupIds?: string[]; curriculumVersionId?: string;
    examStructureId?: string; schoolId?: string;
  }) {
    return this.curriculumService.createBestSubjectRule(body);
  }

  @Get('best-subject-rules')
  getBestSubjectRules(@Query('curriculumVersionId') cvId?: string) {
    return this.curriculumService.getBestSubjectRules(cvId);
  }

  // ===================== CERTIFICATION RULES =====================

  @Post('certification-rules')
  createCertificationRule(@Body() body: {
    name: string; code: string; description?: string; minSubjects?: number;
    maxFailingSubjects?: number; minPassScore?: number;
    mustIncludeSubjectIds: string[]; minTotalScore?: number; maxTotalScore?: number;
    curriculumVersionId?: string; examStructureId?: string; schoolId?: string;
  }) {
    return this.curriculumService.createCertificationRule(body);
  }

  @Get('certification-rules')
  getCertificationRules(@Query('curriculumVersionId') cvId?: string) {
    return this.curriculumService.getCertificationRules(cvId);
  }

  // ===================== PROMOTION RULES =====================

  @Post('promotion-rules')
  createPromotionRule(@Body() body: {
    name: string; code: string; description?: string; fromStageId?: string;
    toStageId?: string; minAverageScore?: number; maxFailingSubjects?: number;
    mustPassSubjectIds: string[]; curriculumVersionId?: string; schoolId?: string;
  }) {
    return this.curriculumService.createPromotionRule(body);
  }

  @Get('promotion-rules')
  getPromotionRules(@Query('curriculumVersionId') cvId?: string) {
    return this.curriculumService.getPromotionRules(cvId);
  }

  // ===================== PATHWAY RULES =====================

  @Post('pathway-rules')
  createPathwayRule(@Body() body: {
    name: string; code: string; description?: string; pathwayType: PathwayType;
    entryStageId?: string; exitStageId?: string; minEntryScore?: number;
    recommendedSubjects?: string[]; compulsorySubjects?: string[];
    curriculumVersionId?: string; schoolId?: string;
  }) {
    return this.curriculumService.createPathwayRule(body);
  }

  @Get('pathway-rules')
  getPathwayRules(@Query('curriculumVersionId') cvId?: string) {
    return this.curriculumService.getPathwayRules(cvId);
  }

  // ===================== SCHOOL CURRICULUM MAPPING =====================

  @Post('schools/:schoolId/education-levels')
  setSchoolLevels(@Param('schoolId') schoolId: string, @Body() body: { levelIds: string[] }) {
    return this.curriculumService.setSchoolEducationLevels(schoolId, body.levelIds);
  }

  @Get('schools/:schoolId/education-levels')
  getSchoolLevels(@Param('schoolId') schoolId: string) {
    return this.curriculumService.getSchoolEducationLevels(schoolId);
  }

  @Post('schools/:schoolId/curricula')
  setSchoolCurriculum(@Param('schoolId') schoolId: string, @Body() body: { curriculumVersionId: string }) {
    return this.curriculumService.setSchoolCurriculum(schoolId, body.curriculumVersionId);
  }

  @Get('schools/:schoolId/curricula')
  getSchoolCurricula(@Param('schoolId') schoolId: string) {
    return this.curriculumService.getSchoolCurricula(schoolId);
  }

  // ===================== FULL TREE =====================

  @Get('tree')
  getCurriculumTree(@Query('schoolId') schoolId?: string) {
    return this.curriculumService.getFullCurriculumTree(schoolId);
  }

  // ===================== GRADE 7 ENGINE =====================

  @Post('grade7/compute/:studentId/:termId')
  computeGrade7(
    @Param('studentId') studentId: string,
    @Param('termId') termId: string,
    @Query('curriculumVersionId') cvId?: string,
    @Query('examStructureId') esId?: string,
  ) {
    return this.grade7Engine.computeGrade7Result(studentId, termId, cvId, esId);
  }

  @Post('grade7/batch/:classId/:termId')
  batchComputeGrade7(
    @Param('classId') classId: string,
    @Param('termId') termId: string,
    @Query('curriculumVersionId') cvId?: string,
    @Query('examStructureId') esId?: string,
  ) {
    return this.grade7Engine.batchComputeGrade7(classId, termId, cvId, esId);
  }

  @Post('grade7/save/:studentId/:termId')
  saveGrade7(@Param('studentId') studentId: string, @Param('termId') termId: string, @Body() body: any) {
    return this.grade7Engine.saveGrade7Result(studentId, termId, body);
  }

  @Get('grade7/results')
  getGrade7Results(
    @Query('studentId') studentId?: string,
    @Query('termId') termId?: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.grade7Engine.getGrade7Results(studentId, termId, schoolId);
  }

  @Post('grade7/rank/:schoolId/:termId')
  rankGrade7(@Param('schoolId') schoolId: string, @Param('termId') termId: string) {
    return this.grade7Engine.rankGrade7Results(schoolId, termId);
  }

  // ===================== SELECTION ANALYTICS =====================

  @Get('selection/student/:studentId/:termId')
  analyzeStudentSelection(@Param('studentId') studentId: string, @Param('termId') termId: string) {
    return this.selectionAnalytics.analyzeStudentSelection(studentId, termId);
  }

  @Get('selection/class/:classId/:termId')
  analyzeClassSelection(@Param('classId') classId: string, @Param('termId') termId: string) {
    return this.selectionAnalytics.analyzeClassSelection(classId, termId);
  }

  @Get('selection/school-profile/:schoolId')
  getSchoolProfile(@Param('schoolId') schoolId: string) {
    return this.selectionAnalytics.getSchoolSelectionProfile(schoolId);
  }

  @Get('selection/district-rankings/:district/:termId')
  getDistrictRankings(@Param('district') district: string, @Param('termId') termId: string) {
    return this.selectionAnalytics.getDistrictRankings(district, termId);
  }

  @Get('selection/province-rankings/:province/:termId')
  getProvinceRankings(@Param('province') province: string, @Param('termId') termId: string) {
    return this.selectionAnalytics.getProvinceRankings(province, termId);
  }
}
