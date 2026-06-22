import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto, BroadcastNotificationDto, TestNotificationDto } from './dto/send-notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('register-device')
  @UseGuards(JwtAuthGuard)
  async registerDevice(
    @Req() req: any,
    @Body() body: { deviceToken: string; platform?: string; role?: string },
  ) {
    await this.notificationsService.registerDevice(
      req.user.id,
      body.deviceToken,
      body.platform,
      body.role || req.user.roles?.[0],
    );
    return { success: true };
  }

  @Post('remove-device')
  @UseGuards(JwtAuthGuard)
  async removeDevice(
    @Req() req: any,
    @Body() body: { deviceToken: string },
  ) {
    await this.notificationsService.removeDevice(req.user.id, body.deviceToken);
    return { success: true };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getNotifications(
    @Req() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('category') category?: string,
  ) {
    return this.notificationsService.getNotifications(req.user.id, Number(page), Number(limit), category);
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  async getUnreadCount(@Req() req: any) {
    const count = await this.notificationsService.getUnreadCount(req.user.id);
    return { count };
  }

  @Put(':id/read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(@Req() req: any, @Param('id') id: string) {
    await this.notificationsService.markAsRead(req.user.id, id);
    return { success: true };
  }

  @Put('read-all')
  @UseGuards(JwtAuthGuard)
  async markAllAsRead(@Req() req: any) {
    await this.notificationsService.markAllAsRead(req.user.id);
    return { success: true };
  }

  @Post('send')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Director', 'Admin')
  async send(@Req() req: any, @Body() dto: SendNotificationDto) {
    return this.notificationsService.send(dto, req.user.id);
  }

  @Post('broadcast')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  async broadcast(@Req() req: any, @Body() dto: BroadcastNotificationDto) {
    return this.notificationsService.broadcast(dto, req.user.id);
  }

  @Get('analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Director', 'Admin')
  async getAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('category') category?: string,
  ) {
    return this.notificationsService.getAnalytics(startDate, endDate, category);
  }

  @Get('categories')
  @UseGuards(JwtAuthGuard)
  async getCategories() {
    return this.notificationsService.getCategories();
  }

  @Post('test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Admin')
  async test(@Body() dto: TestNotificationDto) {
    return this.notificationsService.sendTestNotification(dto.token);
  }

  @Get('queue-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  async getQueueStats() {
    return this.notificationsService.getQueueStats();
  }
}
