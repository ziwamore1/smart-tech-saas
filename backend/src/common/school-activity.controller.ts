import { Controller, Get, Query, Param, Body, Post, Req, UseGuards } from '@nestjs/common';
import { SchoolActivityService } from './services/school-activity.service';
import { ActivityCategory } from './types/activity-event.types';

@Controller('school-activity')
export class SchoolActivityController {
  constructor(private readonly activityService: SchoolActivityService) {}

  @Get('stats')
  getStats(@Query('schoolId') schoolId: string) {
    if (!schoolId) {
      return { statusCode: 400, message: 'schoolId required', data: null };
    }
    const stats = this.activityService.getLiveStats(schoolId);
    return { statusCode: 200, data: stats };
  }

  @Get('feed')
  getFeed(
    @Query('schoolId') schoolId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('category') category?: string,
  ) {
    if (!schoolId) {
      return { statusCode: 400, message: 'schoolId required', data: [] };
    }
    const parsedLimit = Math.min(parseInt(limit || '50', 10) || 50, 200);
    const parsedOffset = parseInt(offset || '0', 10) || 0;
    const parsedCategory = category && Object.values(ActivityCategory).includes(category as ActivityCategory)
      ? (category as ActivityCategory)
      : undefined;

    const feed = this.activityService.getFeed(schoolId, parsedLimit, parsedOffset, parsedCategory);
    return { statusCode: 200, data: feed };
  }

  @Get('presence')
  getPresence(@Query('schoolId') schoolId: string) {
    if (!schoolId) {
      return { statusCode: 400, message: 'schoolId required', data: [] };
    }
    const presence = this.activityService.getPresence(schoolId);
    return { statusCode: 200, data: presence };
  }

  @Post('presence/heartbeat')
  heartbeat(
    @Body() body: { schoolId: string; userId: string; userName: string; userRole: string; page?: string },
  ) {
    if (!body.schoolId || !body.userId) {
      return { statusCode: 400, message: 'schoolId and userId required' };
    }
    this.activityService.trackPresence(
      body.schoolId,
      body.userId,
      body.userName,
      body.userRole,
      'http-poll',
      body.page,
    );
    return { statusCode: 200, data: { ok: true } };
  }
}
