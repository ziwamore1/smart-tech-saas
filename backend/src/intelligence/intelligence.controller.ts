import { Controller, Get, Post, Param, Query, Req, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DescriptiveStatsService } from './services/descriptive-stats.service';
import { TrendAnalysisService } from './services/trend-analysis.service';
import { CorrelationAnalysisService } from './services/correlation-analysis.service';
import { PredictiveAnalysisService } from './services/predictive-analysis.service';
import { DiagnosticAnalysisService } from './services/diagnostic-analysis.service';
import { NarrativeReportService } from './services/narrative-report.service';
import { RecommendationService } from './services/recommendation.service';
import { BenchmarkingService } from './services/benchmarking.service';
import { PsychometricAnalysisService } from './services/psychometric-analysis.service';
import { AdaptiveTestingService } from './services/adaptive-testing.service';
import { LearningStyleAnalysisService } from './services/learning-style-analysis.service';
import { ExamQualityAnalysisService } from './services/exam-quality-analysis.service';
import { AiTutorService } from './services/ai-tutor.service';

@Controller('intelligence')
@UseGuards(JwtAuthGuard)
export class IntelligenceController {
  constructor(
    private descriptiveStats: DescriptiveStatsService,
    private trendAnalysis: TrendAnalysisService,
    private correlationAnalysis: CorrelationAnalysisService,
    private predictiveAnalysis: PredictiveAnalysisService,
    private diagnosticAnalysis: DiagnosticAnalysisService,
    private narrativeReport: NarrativeReportService,
    private recommendation: RecommendationService,
    private benchmarking: BenchmarkingService,
    private psychometricAnalysis: PsychometricAnalysisService,
    private adaptiveTesting: AdaptiveTestingService,
    private learningStyleAnalysis: LearningStyleAnalysisService,
    private examQualityAnalysis: ExamQualityAnalysisService,
    private aiTutor: AiTutorService,
  ) {}

  @Get('descriptive-stats/student/:studentId')
  async getStudentStats(@Req() req: any, @Param('studentId') studentId: string) {
    return this.descriptiveStats.getStudentStats(req.user.schoolId, studentId);
  }

  @Get('descriptive-stats/class/:classId')
  async getClassStats(
    @Req() req: any,
    @Param('classId') classId: string,
    @Query('termId') termId: string,
  ) {
    return this.descriptiveStats.getClassStats(req.user.schoolId, classId, termId);
  }

  @Get('descriptive-stats/zscores/:classId')
  async getZScoreAnalysis(
    @Req() req: any,
    @Param('classId') classId: string,
    @Query('termId') termId: string,
  ) {
    return this.descriptiveStats.getZScoreAnalysis(req.user.schoolId, classId, termId);
  }

  @Get('descriptive-stats/histogram/:classId')
  async getHistogram(
    @Req() req: any,
    @Param('classId') classId: string,
    @Query('termId') termId: string,
    @Query('bins') bins?: string,
  ) {
    return this.descriptiveStats.getHistogram(req.user.schoolId, classId, termId, bins ? parseInt(bins) : 10);
  }

  @Get('trends/student/:studentId')
  async getStudentGrowthTrajectory(@Req() req: any, @Param('studentId') studentId: string) {
    return this.trendAnalysis.getStudentGrowthTrajectory(req.user.schoolId, studentId);
  }

  @Get('trends/subject/:classId')
  async getSubjectTrend(
    @Req() req: any,
    @Param('classId') classId: string,
    @Query('subjectId') subjectId: string,
  ) {
    return this.trendAnalysis.getSubjectTrend(req.user.schoolId, classId, subjectId);
  }

  @Get('trends/class-comparison/:classId')
  async getClassComparisonTrend(@Req() req: any, @Param('classId') classId: string) {
    return this.trendAnalysis.getClassComparisonTrend(req.user.schoolId, classId);
  }

  @Get('trends/longitudinal/:studentId')
  async getLongitudinalReport(@Req() req: any, @Param('studentId') studentId: string) {
    return this.trendAnalysis.getLongitudinalStudentReport(req.user.schoolId, studentId);
  }

  @Get('correlations/subjects/:classId')
  async getSubjectCorrelation(
    @Req() req: any,
    @Param('classId') classId: string,
    @Query('termId') termId: string,
  ) {
    return this.correlationAnalysis.getSubjectCorrelation(req.user.schoolId, classId, termId);
  }

  @Get('correlations/attendance/:classId')
  async getAttendanceCorrelation(
    @Req() req: any,
    @Param('classId') classId: string,
    @Query('termId') termId: string,
  ) {
    return this.correlationAnalysis.getAttendancePerformanceCorrelation(req.user.schoolId, classId, termId);
  }

  @Get('correlations/teacher-effectiveness')
  async getTeacherEffectiveness(
    @Req() req: any,
    @Query('termId') termId: string,
  ) {
    return this.correlationAnalysis.getTeacherEffectiveness(req.user.schoolId, termId);
  }

  @Get('correlations/subject-clusters/:classId')
  async getSubjectClusters(
    @Req() req: any,
    @Param('classId') classId: string,
    @Query('termId') termId: string,
  ) {
    return this.correlationAnalysis.getSubjectClusters(req.user.schoolId, classId, termId);
  }

  @Get('predictive/risk/:classId')
  async predictStudentRisk(@Req() req: any, @Param('classId') classId: string) {
    return this.predictiveAnalysis.predictStudentRisk(req.user.schoolId, classId);
  }

  @Get('predictive/subject-outcome/:studentId')
  async predictSubjectOutcome(
    @Req() req: any,
    @Param('studentId') studentId: string,
    @Query('subjectId') subjectId: string,
  ) {
    return this.predictiveAnalysis.predictSubjectOutcome(req.user.schoolId, studentId, subjectId);
  }

  @Get('predictive/at-risk')
  async getAtRiskStudents(
    @Req() req: any,
    @Query('classId') classId?: string,
  ) {
    return this.predictiveAnalysis.getAtRiskStudents(req.user.schoolId, classId);
  }

  @Get('predictive/dropout-risk')
  async getDropoutPrediction(
    @Req() req: any,
    @Query('classId') classId?: string,
  ) {
    return this.predictiveAnalysis.getDropoutPrediction(req.user.schoolId, classId);
  }

  @Get('diagnostic/competency/:studentId')
  async getCompetencyDiagnosis(
    @Req() req: any,
    @Param('studentId') studentId: string,
    @Query('termId') termId: string,
  ) {
    return this.diagnosticAnalysis.getCompetencyDiagnosis(req.user.schoolId, studentId, termId);
  }

  @Get('diagnostic/class-competency/:classId')
  async getClassCompetencyOverview(
    @Req() req: any,
    @Param('classId') classId: string,
    @Query('termId') termId: string,
  ) {
    return this.diagnosticAnalysis.getClassCompetencyOverview(req.user.schoolId, classId, termId);
  }

  @Get('diagnostic/weaknesses/:studentId')
  async getStudentWeaknesses(@Req() req: any, @Param('studentId') studentId: string) {
    return this.diagnosticAnalysis.getStudentWeaknessProfile(req.user.schoolId, studentId);
  }

  @Get('diagnostic/cross-subject/:studentId')
  async getCrossSubjectDiagnosis(@Req() req: any, @Param('studentId') studentId: string) {
    return this.diagnosticAnalysis.getCrossSubjectDiagnosis(req.user.schoolId, studentId);
  }

  @Get('narrative/student/:studentId')
  async generateStudentNarrative(
    @Req() req: any,
    @Param('studentId') studentId: string,
    @Query('termId') termId: string,
  ) {
    return this.narrativeReport.generateStudentNarrativeReport(req.user.schoolId, studentId, termId);
  }

  @Get('narrative/class/:classId')
  async generateClassNarrative(
    @Req() req: any,
    @Param('classId') classId: string,
    @Query('termId') termId: string,
  ) {
    return this.narrativeReport.generateClassNarrativeReport(req.user.schoolId, classId, termId);
  }

  @Get('narrative/longitudinal/:studentId')
  async generateLongitudinalNarrative(@Req() req: any, @Param('studentId') studentId: string) {
    return this.narrativeReport.generateLongitudinalNarrative(req.user.schoolId, studentId);
  }

  @Get('recommendations/student/:studentId')
  async getStudentRecommendations(
    @Req() req: any,
    @Param('studentId') studentId: string,
    @Query('termId') termId: string,
  ) {
    return this.recommendation.getStudentRecommendations(req.user.schoolId, studentId, termId);
  }

  @Get('recommendations/class/:classId')
  async getClassInterventionNeeds(
    @Req() req: any,
    @Param('classId') classId: string,
    @Query('termId') termId: string,
  ) {
    return this.recommendation.getClassInterventionNeeds(req.user.schoolId, classId, termId);
  }

  @Get('recommendations/suggest/:studentId')
  async suggestInterventions(@Req() req: any, @Param('studentId') studentId: string) {
    return this.recommendation.suggestInterventions(req.user.schoolId, studentId);
  }

  @Get('benchmarking/compare/:subjectId')
  async compareWithNational(
    @Req() req: any,
    @Param('subjectId') subjectId: string,
    @Query('termId') termId: string,
  ) {
    return this.benchmarking.compareWithNational(req.user.schoolId, subjectId, termId);
  }

  @Get('benchmarking/multi-subject/:classId')
  async getMultiSubjectBenchmark(
    @Req() req: any,
    @Param('classId') classId: string,
    @Query('termId') termId: string,
  ) {
    return this.benchmarking.getMultiSubjectBenchmark(req.user.schoolId, classId, termId);
  }

  @Post('benchmarking/add')
  async addBenchmark(
    @Req() req: any,
    @Body() body: { subjectId: string; year: number; average: number; stdDev?: number; passRate?: number; region?: string; source?: string; termName?: string },
  ) {
    return this.benchmarking.addBenchmark(body.subjectId, body.year, body.average, body);
  }

  @Get('benchmarking/trends/:subjectId')
  async getBenchmarkTrends(@Param('subjectId') subjectId: string) {
    return this.benchmarking.getBenchmarkTrends(subjectId);
  }

  @Get('benchmarking/dashboard')
  async getSchoolBenchmarkDashboard(@Req() req: any, @Query('termId') termId: string) {
    return this.benchmarking.getSchoolBenchmarkDashboard(req.user.schoolId, termId);
  }

  @Get('psychometric/item-analysis/:examId')
  async getItemAnalysis(@Req() req: any, @Param('examId') examId: string) {
    return this.psychometricAnalysis.getItemAnalysis(req.user.schoolId, examId);
  }

  @Get('psychometric/reliability/:examId')
  async getExamReliability(@Req() req: any, @Param('examId') examId: string) {
    return this.psychometricAnalysis.getExamReliability(req.user.schoolId, examId);
  }

  @Get('psychometric/difficulty-distribution/:examId')
  async getDifficultyDistribution(@Req() req: any, @Param('examId') examId: string) {
    return this.psychometricAnalysis.getDifficultyDistribution(req.user.schoolId, examId);
  }

  @Get('psychometric/score-distribution/:examId')
  async getScoreDistribution(@Req() req: any, @Param('examId') examId: string) {
    return this.psychometricAnalysis.getScoreDistributionAnalysis(req.user.schoolId, examId);
  }

  @Post('adaptive-testing/start')
  async startAdaptiveSession(
    @Req() req: any,
    @Body() body: { studentId: string; subjectId: string },
  ) {
    return this.adaptiveTesting.startSession(body.studentId, body.subjectId, req.user.schoolId);
  }

  @Get('adaptive-testing/next-question/:sessionId')
  async getNextAdaptiveQuestion(@Req() req: any, @Param('sessionId') sessionId: string) {
    return this.adaptiveTesting.getNextQuestion(sessionId, req.user.schoolId);
  }

  @Post('adaptive-testing/submit-answer')
  async submitAdaptiveAnswer(
    @Req() req: any,
    @Body() body: { sessionId: string; questionId: string; studentAnswer: string; responseTimeMs: number },
  ) {
    return this.adaptiveTesting.submitAnswer(body.sessionId, body.questionId, body.studentAnswer, body.responseTimeMs, req.user.schoolId);
  }

  @Get('adaptive-testing/result/:sessionId')
  async getAdaptiveResult(@Req() req: any, @Param('sessionId') sessionId: string) {
    return this.adaptiveTesting.getSessionResult(sessionId, req.user.schoolId);
  }

  @Post('learning-style/assess')
  async assessLearningStyle(
    @Req() req: any,
    @Body() body: { studentId: string; visual: number; aural: number; readWrite: number; kinesthetic: number },
  ) {
    return this.learningStyleAnalysis.assessStudent(body.studentId, req.user.schoolId, {
      visual: body.visual, aural: body.aural, readWrite: body.readWrite, kinesthetic: body.kinesthetic,
    });
  }

  @Get('learning-style/profile/:studentId')
  async getLearningStyleProfile(@Req() req: any, @Param('studentId') studentId: string) {
    return this.learningStyleAnalysis.getStudentProfile(studentId, req.user.schoolId);
  }

  @Get('learning-style/class-distribution/:classId')
  async getClassStyleDistribution(@Req() req: any, @Param('classId') classId: string) {
    return this.learningStyleAnalysis.getClassStyleDistribution(req.user.schoolId, classId);
  }

  @Get('learning-style/subject-fit/:subjectId')
  async getSubjectStyleFit(@Req() req: any, @Param('subjectId') subjectId: string) {
    return this.learningStyleAnalysis.getSubjectStyleFit(req.user.schoolId, subjectId);
  }

  @Get('exam-quality/analyze/:examId')
  async analyzeExamQuality(@Req() req: any, @Param('examId') examId: string) {
    return this.examQualityAnalysis.analyzeExamQuality(req.user.schoolId, examId);
  }

  @Get('exam-quality/compare/:subjectId')
  async compareExamsBySubject(@Req() req: any, @Param('subjectId') subjectId: string) {
    return this.examQualityAnalysis.compareExamsBySubject(req.user.schoolId, subjectId);
  }

  @Get('exam-quality/grade-inflation/:subjectId')
  async detectGradeInflation(@Req() req: any, @Param('subjectId') subjectId: string) {
    return this.examQualityAnalysis.detectGradeInflation(req.user.schoolId, subjectId);
  }

  @Get('exam-quality/blueprint/:examId')
  async getExamBlueprint(@Req() req: any, @Param('examId') examId: string) {
    return this.examQualityAnalysis.getExamBlueprintQuality(req.user.schoolId, examId);
  }

  @Post('ai-tutor/start')
  async startTutorSession(
    @Req() req: any,
    @Body() body: { studentId: string; subjectId?: string; topic?: string; context?: Record<string, any> },
  ) {
    return this.aiTutor.startSession(body.studentId, req.user.schoolId, {
      subjectId: body.subjectId,
      topic: body.topic,
      context: body.context as any,
    });
  }

  @Post('ai-tutor/message')
  async sendTutorMessage(
    @Req() req: any,
    @Body() body: { sessionId: string; studentId: string; message: string; context?: Record<string, any> },
  ) {
    return this.aiTutor.sendMessage(body.sessionId, body.studentId, body.message, req.user.schoolId, body.context as any);
  }

  @Get('ai-tutor/history/:sessionId')
  async getTutorSessionHistory(@Req() req: any, @Param('sessionId') sessionId: string) {
    return this.aiTutor.getSessionHistory(sessionId, req.user.schoolId);
  }

  @Get('ai-tutor/sessions/:studentId')
  async getStudentTutorSessions(@Req() req: any, @Param('studentId') studentId: string) {
    return this.aiTutor.getStudentSessions(studentId, req.user.schoolId);
  }

  @Post('ai-tutor/end/:sessionId')
  async endTutorSession(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
    @Body() body: { rating?: number; helpful?: boolean; comment?: string },
  ) {
    return this.aiTutor.endSession(sessionId, req.user.schoolId, body);
  }

  @Post('ai-tutor/ask')
  async askTutor(
    @Req() req: any,
    @Body() body: { studentId: string; question: string; subjectId?: string; context?: Record<string, any> },
  ) {
    return this.aiTutor.askQuestion(body.studentId, req.user.schoolId, body.question, body.subjectId, body.context as any);
  }

  @Get('ai-tutor/insights/:studentId')
  async getTutorInsights(@Req() req: any, @Param('studentId') studentId: string) {
    return this.aiTutor.getTutorInsights(studentId, req.user.schoolId);
  }
}
