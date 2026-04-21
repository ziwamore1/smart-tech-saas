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
  Request,
} from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('communications')
@UseGuards(JwtAuthGuard)
export class CommunicationController {
  constructor(private readonly communicationService: CommunicationService) {}

  @Post()
  async createCommunication(
    @Body()
    data: {
      type: string;
      subject?: string;
      message: string;
      recipientType?: string;
      recipientIds?: string[];
      scheduledAt?: Date;
    },
    @Request() req: any,
  ) {
    return this.communicationService.createCommunication({
      ...data,
      schoolId: req.user.schoolId,
      createdById: req.user.id,
    });
  }

  @Get()
  async getCommunications(
    @Request() req: any,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.communicationService.getCommunications(req.user.schoolId, {
      type,
      status,
      limit,
      offset,
    });
  }

  @Get('stats')
  async getCommunicationStats(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const dateRange =
      startDate && endDate
        ? { start: new Date(startDate), end: new Date(endDate) }
        : undefined;
    return this.communicationService.getCommunicationStats(
      req.user.schoolId,
      dateRange,
    );
  }

  @Get('settings')
  async getCommunicationSettings(@Request() req: any) {
    return this.communicationService.getCommunicationSettings(
      req.user.schoolId,
    );
  }

  @Put('settings')
  async updateCommunicationSettings(@Body() data: any, @Request() req: any) {
    return this.communicationService.updateCommunicationSettings(
      req.user.schoolId,
      data,
    );
  }

  @Get(':id')
  async getCommunicationById(@Param('id') id: string) {
    return this.communicationService.getCommunicationById(id);
  }

  @Post(':id/send')
  async sendCommunication(@Param('id') id: string) {
    return this.communicationService.sendCommunication(id);
  }

  @Post(':id/send-bulk')
  async sendBulkCommunication(
    @Param('id') id: string,
    @Body() data: { recipientIds: string[] },
  ) {
    return this.communicationService.sendBulkCommunication(
      id,
      data.recipientIds,
    );
  }

  @Delete(':id')
  async deleteCommunication(@Param('id') id: string) {
    return this.communicationService.deleteCommunication(id);
  }

  @Post('schedule')
  async scheduleCommunication(
    @Body()
    data: {
      type: string;
      subject?: string;
      message: string;
      recipientType?: string;
      scheduledAt: Date;
    },
    @Request() req: any,
  ) {
    return this.communicationService.scheduleCommunication({
      ...data,
      schoolId: req.user.schoolId,
      createdById: req.user.id,
    });
  }

  @Get('templates/list')
  async getCommunicationTemplates(@Request() req: any) {
    return this.communicationService.getCommunicationTemplates(
      req.user.schoolId,
    );
  }

  @Post('templates')
  async createCommunicationTemplate(
    @Body()
    data: { name: string; type: string; subject?: string; message: string },
    @Request() req: any,
  ) {
    return this.communicationService.createCommunicationTemplate({
      ...data,
      schoolId: req.user.schoolId,
    });
  }

  @Get('platforms/facebook')
  async getFacebookAnalytics(@Request() req: any) {
    return this.communicationService.getPlatformAnalytics(
      req.user.schoolId,
      'FACEBOOK',
    );
  }

  @Get('platforms/youtube')
  async getYouTubeAnalytics(@Request() req: any) {
    return this.communicationService.getPlatformAnalytics(
      req.user.schoolId,
      'YOUTUBE',
    );
  }

  @Get('platforms/linkedin')
  async getLinkedInAnalytics(@Request() req: any) {
    return this.communicationService.getPlatformAnalytics(
      req.user.schoolId,
      'LINKEDIN',
    );
  }

  @Get('platforms/whatsapp')
  async getWhatsAppAnalytics(@Request() req: any) {
    return this.communicationService.getPlatformAnalytics(
      req.user.schoolId,
      'WHATSAPP',
    );
  }

  @Get('alerts/realtime')
  async getRealtimeAlerts(@Request() req: any) {
    return this.communicationService.getRealtimeAlerts(req.user.schoolId);
  }

  @Post('alerts/sms')
  async sendSMSAlert(
    @Body() data: { message: string; priority?: string },
    @Request() req: any,
  ) {
    return this.communicationService.sendSMSAlert({
      ...data,
      schoolId: req.user.schoolId,
      createdById: req.user.id,
    });
  }
}
