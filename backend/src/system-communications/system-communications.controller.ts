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
import { SystemCommunicationsService } from './system-communications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';

@Controller('system-communications')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class SystemCommunicationsController {
  constructor(
    private readonly systemCommunicationsService: SystemCommunicationsService,
  ) {}

  @Get('dashboard')
  async getDashboard(@Request() req: any) {
    return this.systemCommunicationsService.getDashboardStats();
  }

  @Get('providers')
  async getProviders() {
    return this.systemCommunicationsService.getProviders();
  }

  @Get('providers/:id')
  async getProvider(@Param('id') id: string) {
    return this.systemCommunicationsService.getProviderById(id);
  }

  @Post('providers')
  async createProvider(
    @Body()
    data: {
      name: string;
      type: string;
      channel: string;
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      senderEmail?: string;
      senderName?: string;
      isDefault?: boolean;
      config?: any;
    },
  ) {
    return this.systemCommunicationsService.createProvider(data);
  }

  @Put('providers/:id')
  async updateProvider(
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.systemCommunicationsService.updateProvider(id, data);
  }

  @Delete('providers/:id')
  async deleteProvider(@Param('id') id: string) {
    return this.systemCommunicationsService.deleteProvider(id);
  }

  @Post('providers/:id/test')
  async testProvider(@Param('id') id: string) {
    return this.systemCommunicationsService.testProvider(id);
  }

  @Post('test-sms')
  async sendTestSms(
    @Body() data: { to: string; message?: string },
  ) {
    return this.systemCommunicationsService.sendTestSms(data.to, data.message);
  }

  @Post('providers/:id/set-default')
  async setDefaultProvider(@Param('id') id: string) {
    return this.systemCommunicationsService.setDefaultProvider(id);
  }

  @Get('broadcasts')
  async getBroadcasts(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.systemCommunicationsService.getBroadcasts({ page, limit, status });
  }

  @Get('broadcasts/:id')
  async getBroadcast(@Param('id') id: string) {
    return this.systemCommunicationsService.getBroadcastById(id);
  }

  @Post('broadcasts')
  async createBroadcast(
    @Body()
    data: {
      title: string;
      message: string;
      channels: string[];
      targetType: string;
      targetIds?: string[];
      scheduledAt?: Date;
    },
    @Request() req: any,
  ) {
    return this.systemCommunicationsService.createBroadcast({
      ...data,
      createdById: req.user.id,
    });
  }

  @Put('broadcasts/:id')
  async updateBroadcast(
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.systemCommunicationsService.updateBroadcast(id, data);
  }

  @Delete('broadcasts/:id')
  async deleteBroadcast(@Param('id') id: string) {
    return this.systemCommunicationsService.deleteBroadcast(id);
  }

  @Post('broadcasts/:id/send')
  async sendBroadcast(@Param('id') id: string) {
    return this.systemCommunicationsService.sendBroadcast(id);
  }

  @Post('broadcasts/:id/schedule')
  async scheduleBroadcast(
    @Param('id') id: string,
    @Body() data: { scheduledAt: Date },
  ) {
    return this.systemCommunicationsService.scheduleBroadcast(id, data.scheduledAt);
  }

  @Get('campaigns')
  async getCampaigns(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.systemCommunicationsService.getCampaigns({ page, limit, status });
  }

  @Get('campaigns/:id')
  async getCampaign(@Param('id') id: string) {
    return this.systemCommunicationsService.getCampaignById(id);
  }

  @Post('campaigns')
  async createCampaign(
    @Body()
    data: {
      name: string;
      description?: string;
      type: string;
      channels: string[];
      targetType: string;
      targetIds?: string[];
      templateId?: string;
      scheduledAt?: Date;
    },
    @Request() req: any,
  ) {
    return this.systemCommunicationsService.createCampaign({
      ...data,
      createdById: req.user.id,
    });
  }

  @Put('campaigns/:id')
  async updateCampaign(
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.systemCommunicationsService.updateCampaign(id, data);
  }

  @Delete('campaigns/:id')
  async deleteCampaign(@Param('id') id: string) {
    return this.systemCommunicationsService.deleteCampaign(id);
  }

  @Post('campaigns/:id/launch')
  async launchCampaign(@Param('id') id: string) {
    return this.systemCommunicationsService.launchCampaign(id);
  }

  @Post('campaigns/:id/pause')
  async pauseCampaign(@Param('id') id: string) {
    return this.systemCommunicationsService.pauseCampaign(id);
  }

  @Get('templates')
  async getTemplates(@Query('type') type?: string) {
    return this.systemCommunicationsService.getTemplates(type);
  }

  @Post('templates')
  async createTemplate(
    @Body()
    data: {
      name: string;
      type: string;
      subject?: string;
      message: string;
      category?: string;
    },
  ) {
    return this.systemCommunicationsService.createSystemTemplate(data);
  }

  @Put('templates/:id')
  async updateTemplate(
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.systemCommunicationsService.updateTemplate(id, data);
  }

  @Delete('templates/:id')
  async deleteTemplate(@Param('id') id: string) {
    return this.systemCommunicationsService.deleteTemplate(id);
  }

  @Get('notifications')
  async getNotifications(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('channel') channel?: string,
  ) {
    return this.systemCommunicationsService.getNotificationLogs({ page, limit, channel });
  }

  @Post('notifications')
  async triggerNotification(
    @Body() data: { type: string; data: any },
  ) {
    return this.systemCommunicationsService.triggerSystemNotification(
      data.type,
      data.data,
    );
  }

  @Get('youtube')
  async getYouTubeConfig() {
    return this.systemCommunicationsService.getYouTubeChannelConfig();
  }

  @Post('youtube')
  async saveYouTubeConfig(
    @Body()
    data: {
      channelUrl?: string;
      channelName?: string;
      apiKey?: string;
    },
  ) {
    return this.systemCommunicationsService.saveYouTubeChannelConfig(data);
  }

  @Post('youtube/sync')
  async syncYouTube() {
    return this.systemCommunicationsService.syncYouTubeChannel();
  }

  @Delete('youtube')
  async disconnectYouTube() {
    return this.systemCommunicationsService.disconnectYouTubeChannel();
  }

  @Get('analytics')
  async getAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const dateRange =
      startDate && endDate
        ? { start: new Date(startDate), end: new Date(endDate) }
        : undefined;
    return this.systemCommunicationsService.getUsageAnalytics(dateRange);
  }

  @Get('delivery-logs')
  async getDeliveryLogs(
    @Query('type') type?: string,
    @Query('provider') provider?: string,
    @Query('recipient') recipient?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const dateRange =
      startDate && endDate
        ? { start: new Date(startDate), end: new Date(endDate) }
        : undefined;
    return this.systemCommunicationsService.getDeliveryLogs({
      type,
      provider,
      recipient,
      status,
      dateRange,
      page,
      limit,
    });
  }

  @Get('status')
  async getStatus() {
    return this.systemCommunicationsService.getSystemStatus();
  }

  @Post('status/check')
  async forceStatusCheck() {
    return this.systemCommunicationsService.forceCheckAllProviders();
  }

  @Get('beem/dashboard')
  async getBeemDashboard() {
    return this.systemCommunicationsService.getBeemDashboard();
  }

  @Get('scheduled')
  async getScheduled() {
    return this.systemCommunicationsService.getScheduledCommunications();
  }

  @Post('scheduled/:id/cancel')
  async cancelScheduled(@Param('id') id: string) {
    return this.systemCommunicationsService.cancelScheduledCommunication(id);
  }
}
