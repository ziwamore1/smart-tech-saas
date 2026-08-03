import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { MobileService } from './mobile.service';
import { AiTutorService } from '../intelligence/services/ai-tutor.service';
import { StaffPositionService } from '../staff-position/staff-position.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('mobile')
@UseGuards(JwtAuthGuard)
export class MobileController {
  private readonly logger = new Logger(MobileController.name);

  constructor(
    private mobileService: MobileService,
    private aiTutorService: AiTutorService,
    private staffPositionService: StaffPositionService,
  ) {}

  @Get('dashboard')
  async getDashboard(@Req() req: any) {
    const { id: userId, schoolId, roles } = req.user;
    this.logger.log(`Dashboard request for user: ${userId}`);
    return this.mobileService.getDashboard(userId, schoolId, roles);
  }

  @Get('profile')
  async getProfile(@Req() req: any) {
    const { id: userId, schoolId } = req.user;
    return this.mobileService.getProfile(userId, schoolId);
  }

  @Get('notifications')
  async getNotifications(
    @Req() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const { id: userId } = req.user;
    return this.mobileService.getNotifications(userId, Number(page), Number(limit));
  }

  @Get('notifications/unread-count')
  async getUnreadCount(@Req() req: any) {
    const { id: userId } = req.user;
    return this.mobileService.getUnreadNotificationCount(userId);
  }

  @Put('notifications/:id/read')
  async markAsRead(@Req() req: any, @Param('id') notificationId: string) {
    const { id: userId } = req.user;
    return this.mobileService.markNotificationRead(userId, notificationId);
  }

  @Put('notifications/read-all')
  async markAllAsRead(@Req() req: any) {
    const { id: userId } = req.user;
    return this.mobileService.markAllNotificationsRead(userId);
  }

  @Post('register-push-token')
  async registerPushToken(
    @Req() req: any,
    @Body() body: { token: string; platform?: string; deviceId?: string },
  ) {
    const { id: userId } = req.user;
    return this.mobileService.registerPushToken(userId, body.token, body.platform, body.deviceId);
  }

  @Post('logout-device')
  async logoutDevice(
    @Req() req: any,
    @Body() body: { deviceToken: string },
  ) {
    const { id: userId } = req.user;
    return this.mobileService.logoutDevice(userId, body.deviceToken);
  }

  @Get('timetable/student')
  async getStudentTimetable(@Req() req: any) {
    const { id: userId, schoolId, roles } = req.user;
    if (roles.includes('Student')) {
      return this.mobileService.getStudentTimetable(userId, schoolId);
    }
    return { error: 'Not a student' };
  }

  @Get('timetable/teacher')
  async getTeacherTimetable(@Req() req: any) {
    const { id: userId, schoolId, roles } = req.user;
    if (roles.includes('Teacher') || roles.includes('Class Teacher')) {
      return this.mobileService.getTeacherTimetable(userId, schoolId);
    }
    return { error: 'Not a teacher' };
  }

  @Get('student/assignments')
  async getStudentAssignments(@Req() req: any) {
    const { id: userId, schoolId } = req.user;
    return this.mobileService.getStudentAssignments(userId, schoolId);
  }

  @Get('student/grades')
  async getStudentGrades(@Req() req: any) {
    const { id: userId, schoolId } = req.user;
    return this.mobileService.getStudentGrades(userId, schoolId);
  }

  @Get('teacher/activity')
  async getTeacherActivity(@Req() req: any) {
    const { id: userId, schoolId } = req.user;
    return this.mobileService.getTeacherActivity(userId, schoolId);
  }

  @Get('teacher/classes')
  async getTeacherClasses(@Req() req: any) {
    const { id: userId, schoolId } = req.user;
    return this.mobileService.getTeacherClasses(userId, schoolId);
  }

  @Get('ai-tutor/sessions')
  async getAiTutorSessions(@Req() req: any) {
    const { id: userId, schoolId, roles } = req.user;
    return this.mobileService.getAiTutorSessions(userId, schoolId, roles);
  }

  @Post('ai-tutor/start')
  async startAiTutorSession(@Req() req: any, @Body() body: {
    subjectId?: string;
    topic?: string;
    studentId?: string;
    context?: {
      role?: string;
      screen?: string;
      subject?: string;
      topic?: string;
    };
  }) {
    const { id: userId, schoolId, roles } = req.user;
    return this.mobileService.startAiTutorSession(userId, schoolId, roles, body);
  }

  @Post('ai-tutor/message')
  async sendAiTutorMessage(@Req() req: any, @Body() body: {
    sessionId: string;
    message: string;
    fileUrls?: string[];
    context?: {
      role?: string;
      screen?: string;
      subject?: string;
      topic?: string;
      studentId?: string;
    };
  }) {
    const { id: userId, schoolId } = req.user;
    return this.mobileService.sendAiTutorMessage(userId, schoolId, body.sessionId, body.message, { ...body.context, fileUrls: body.fileUrls });
  }

  @Get('ai-tutor/history/:sessionId')
  async getAiTutorHistory(@Req() req: any, @Param('sessionId') sessionId: string) {
    const { schoolId } = req.user;
    return this.aiTutorService.getSessionHistory(sessionId, schoolId);
  }

  @Post('ai-tutor/end/:sessionId')
  async endAiTutorSession(@Req() req: any, @Param('sessionId') sessionId: string, @Body() body: { rating?: number; helpful?: boolean; comment?: string }) {
    const { schoolId } = req.user;
    return this.aiTutorService.endSession(sessionId, schoolId, body);
  }

  @Post('ai-tutor/ask')
  async askAiTutor(@Req() req: any, @Body() body: {
    question: string;
    subjectId?: string;
    fileUrls?: string[];
    context?: {
      role?: string;
      screen?: string;
      subject?: string;
      topic?: string;
      studentId?: string;
    };
  }) {
    const { id: userId, schoolId, roles } = req.user;
    return this.mobileService.askAiTutor(userId, schoolId, roles, body.question, body.subjectId, { ...body.context, fileUrls: body.fileUrls });
  }

  @Get('academic-years')
  async getAcademicYears(@Req() req: any) {
    const { schoolId } = req.user;
    return this.mobileService.getAcademicYears(schoolId);
  }

  @Get('terms/:academicYearId')
  async getTerms(@Param('academicYearId') academicYearId: string) {
    return this.mobileService.getTerms(academicYearId);
  }

  @Post('terms')
  async createTerm(@Body() body: any, @Req() req: any) {
    const { schoolId } = req.user;
    return this.mobileService.createTerm(body, schoolId);
  }

  @Patch('terms/:id')
  async updateTerm(@Param('id') id: string, @Body() body: any) {
    return this.mobileService.updateTerm(id, body);
  }

  @Delete('terms/:id')
  async deleteTerm(@Param('id') id: string) {
    return this.mobileService.deleteTerm(id);
  }

  @Patch('terms/:id/set-current')
  async setCurrentTerm(@Param('id') id: string, @Req() req: any) {
    const { schoolId } = req.user;
    return this.mobileService.setCurrentTerm(id, schoolId);
  }

  @Get('classes')
  async getClasses(@Req() req: any) {
    const { schoolId } = req.user;
    return this.mobileService.getClasses(schoolId);
  }

  @Get('students')
  async getStudents(@Req() req: any, @Query('classId') classId?: string) {
    const { schoolId } = req.user;
    return this.mobileService.getStudents(schoolId, classId);
  }

  @Get('students/preview-admission')
  async previewAdmission(
    @Req() req: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('classId') classId?: string,
  ) {
    const { schoolId } = req.user;
    return this.mobileService.previewAdmission(schoolId, academicYearId, classId);
  }

  @Post('students')
  async createStudent(
    @Req() req: any,
    @Body() body: {
      firstName: string;
      lastName: string;
      admissionNumber?: string;
      gender?: string;
      dateOfBirth?: string;
      email?: string;
      phone?: string;
      address?: string;
      parentName?: string;
      parentPhone?: string;
      parentEmail?: string;
      academicYearId?: string;
      classId?: string;
      manualOverride?: boolean;
      status?: string;
    },
  ) {
    const { id: userId, schoolId, roles } = req.user;
    return this.mobileService.createStudent(userId, schoolId, body, roles);
  }

  @Get('staff')
  async getStaff(@Req() req: any) {
    const { schoolId } = req.user;
    return this.mobileService.getStaff(schoolId);
  }

  @Get('subjects')
  async getSubjects(@Req() req: any) {
    const { schoolId, isSuperAdmin } = req.user;
    return this.mobileService.getSubjects(schoolId, isSuperAdmin);
  }

  @Get('users')
  async getUsers(@Req() req: any, @Query('role') role?: string) {
    const { schoolId } = req.user;
    return this.mobileService.getUsers(schoolId, role);
  }

  @Post('users')
  async createUser(@Req() req: any, @Body() body: { firstName: string; lastName: string; email: string; password: string; roles: string[] }) {
    const { id: userId, schoolId } = req.user;
    return this.mobileService.createUser(userId, schoolId, body);
  }

  @Patch('users/:id')
  async updateUser(@Req() req: any, @Param('id') id: string, @Body() body: { firstName?: string; lastName?: string; email?: string; roles?: string[]; isActive?: boolean }) {
    const { schoolId } = req.user;
    return this.mobileService.updateUser(schoolId, id, body);
  }

  @Delete('users/:id')
  async deleteUser(@Req() req: any, @Param('id') id: string) {
    const { schoolId } = req.user;
    return this.mobileService.deleteUser(schoolId, id);
  }

  @Get('attendance/register')
  async getAttendanceRegister(@Req() req: any, @Query('classId') classId: string, @Query('date') date: string) {
    const { schoolId } = req.user;
    return this.mobileService.getAttendanceRegister(schoolId, classId, date);
  }

  @Post('attendance/bulk')
  async submitBulkAttendance(@Req() req: any, @Body() body: { classId: string; date: string; records: { studentId: string; status: string; remarks?: string }[] }) {
    const { schoolId } = req.user;
    return this.mobileService.submitBulkAttendance(schoolId, body.classId, body.date, body.records);
  }

  @Post('attendance/mark-all')
  async markAllAttendance(@Req() req: any, @Body() body: { classId: string; date: string; status: string }) {
    const { schoolId } = req.user;
    return this.mobileService.markAllAttendance(schoolId, body.classId, body.date, body.status);
  }

  // ==================== STAFF POSITIONS (Mobile) ====================

  @Get('staff-positions/departments')
  async getMobileDepartments(@Req() req: any) {
    return this.staffPositionService.getDepartments(req.user.schoolId);
  }

  @Get('staff-positions/hierarchy')
  async getMobileHierarchy(@Req() req: any) {
    return this.staffPositionService.getHierarchy(req.user.schoolId);
  }

  @Get('staff-positions/monitoring-chain')
  async getMobileMonitoringChain(@Req() req: any) {
    const { schoolId, id: userId } = req.user;
    const teacher = await this.mobileService.getTeacherByUserId(userId);
    if (!teacher) return { teacher: null, supervises: [], supervisedBy: [] };
    return this.staffPositionService.getMonitoringChain(schoolId, teacher.id);
  }

  @Get('staff-positions/department/:departmentId/teachers')
  async getMobileDepartmentTeachers(@Req() req: any, @Param('departmentId') departmentId: string) {
    return this.staffPositionService.getDepartmentTeachers(req.user.schoolId, departmentId);
  }

  @Get('staff-positions/positions')
  async getMobilePositions(@Req() req: any, @Query('positionType') positionType?: string) {
    return this.staffPositionService.getSchoolPositions(req.user.schoolId, positionType);
  }
}
