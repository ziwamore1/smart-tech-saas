import {
  Controller, Get, Post, Param, Query, Body, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommunicationsCloudService } from './communications-cloud.service';
import {
  SendSmsDto, SendEmailDto, SendWhatsAppDto, SendPushDto, SendInAppDto,
  BroadcastDto, ScheduleDto,
} from './dto';

@Controller('communications-cloud')
@UseGuards(JwtAuthGuard)
export class CommunicationsCloudController {
  constructor(private readonly service: CommunicationsCloudService) {}

  @Post('send/sms')
  async sendSms(@Body() dto: SendSmsDto) {
    return this.service.sendSms(dto);
  }

  @Post('send/email')
  async sendEmail(@Body() dto: SendEmailDto) {
    return this.service.sendEmail(dto);
  }

  @Post('send/whatsapp')
  async sendWhatsApp(@Body() dto: SendWhatsAppDto) {
    return this.service.sendWhatsApp(dto);
  }

  @Post('send/push')
  async sendPush(@Body() dto: SendPushDto) {
    return this.service.sendPush(dto);
  }

  @Post('send/in-app')
  async sendInApp(@Body() dto: SendInAppDto) {
    return this.service.sendInApp(dto);
  }

  @Post('broadcast')
  async broadcast(@Body() dto: BroadcastDto) {
    return this.service.broadcast(dto);
  }

  @Post('schedule')
  async schedule(@Body() dto: ScheduleDto) {
    return this.service.schedule(dto);
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string) {
    await this.service.cancel(id);
    return { success: true };
  }

  @Post(':id/retry')
  async retry(@Param('id') id: string) {
    return this.service.retry(id);
  }

  @Post('send/otp')
  async sendOtp(@Body() dto: { phone: string; message?: string }) {
    return this.service.sendOTP(dto.phone, dto.message);
  }

  @Get('ping')
  async ping() {
    return { ok: true };
  }

  @Get('db-check')
  async dbCheck() {
    const templateCount = await this.service['prisma'].commCloudTemplate.count();
    const messageCount = await this.service['prisma'].commCloudMessage.count();
    return { ok: true, templateCount, messageCount };
  }

  @Get('messages')
  async findAll(
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('schoolId') schoolId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.findAll({
      channel,
      status,
      schoolId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('messages/:id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // ===================== SCHOOL-SPECIFIC ENDPOINTS =====================

  @Get('school/wallet')
  async getSchoolWallet(@Request() req: any) {
    return this.service.getSchoolWallet(req.user.schoolId);
  }

  @Get('school/wallet/transactions')
  async getSchoolWalletTransactions(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.getSchoolWalletTransactions(
      req.user.schoolId,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
  }

  @Post('school/wallet/recharge')
  async rechargeSchoolWallet(
    @Request() req: any,
    @Body() dto: { amount: number; channel?: string; description?: string },
  ) {
    return this.service.rechargeSchoolWallet(req.user.schoolId, dto);
  }

  @Get('school/messages')
  async getSchoolMessages(
    @Request() req: any,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getSchoolMessages(req.user.schoolId, {
      channel, status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      from, to,
    });
  }

  @Get('school/stats')
  async getSchoolStats(@Request() req: any) {
    return this.service.getSchoolStats(req.user.schoolId);
  }

  @Get('school/balance')
  async checkSchoolProviderBalance(@Request() req: any) {
    return this.service.checkSchoolProviderBalance(req.user.schoolId);
  }

  @Get('school/settings')
  async getSchoolCommSettings(@Request() req: any) {
    return this.service.getSchoolCommSettings(req.user.schoolId);
  }

  @Post('school/settings')
  async updateSchoolCommSettings(
    @Request() req: any,
    @Body() dto: { smsProvider?: string; smsApiKey?: string; smsSenderId?: string; emailProvider?: string; emailApiKey?: string; whatsappProvider?: string; whatsappApiKey?: string; providerConfig?: any },
  ) {
    return this.service.updateSchoolCommSettings(req.user.schoolId, dto);
  }

  @Post('school/send-sms')
  async sendSchoolSms(
    @Request() req: any,
    @Body() dto: { recipient: string; message: string; senderId?: string; scheduledAt?: string },
  ) {
    return this.service.sendSchoolSms(req.user.schoolId, dto);
  }
}
