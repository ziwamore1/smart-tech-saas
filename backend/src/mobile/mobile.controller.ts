import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { MobileService } from './mobile.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('mobile')
@UseGuards(JwtAuthGuard)
export class MobileController {
  private readonly logger = new Logger(MobileController.name);

  constructor(private mobileService: MobileService) {}

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
}
