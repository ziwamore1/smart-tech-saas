import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards, Logger } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { PasswordGenerationService } from './password-generation.service';
import { AccountRecoveryService } from './account-recovery.service';
import { OtpService } from './otp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('identity')
export class IdentityController {
  private readonly logger = new Logger(IdentityController.name);

  constructor(
    private identityService: IdentityService,
    private passwordGenService: PasswordGenerationService,
    private accountRecoveryService: AccountRecoveryService,
    private otpService: OtpService,
  ) {}

  // ============ PASSWORD HUB (SuperAdmin & Director) ============

  @Get('password-hub')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Director')
  async getPasswordHub(
    @Req() req: any,
    @Query('role') role?: string,
    @Query('search') search?: string,
    @Query('accountStatus') accountStatus?: string,
    @Query('schoolId') schoolId?: string,
  ) {
    const adminSchoolId = req.user.type === 'super_admin' ? schoolId : req.user.schoolId;
    return this.identityService.getPasswordHubData(req.user.id, adminSchoolId, { role, search, accountStatus, schoolId });
  }

  // ============ CREDENTIAL MANAGEMENT ============

  @Post('credentials/generate/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Director')
  async generateCredentials(
    @Param('userId') userId: string,
    @Body('channel') channel: 'SMS' | 'EMAIL' | 'WHATSAPP',
    @Req() req: any,
  ) {
    return this.identityService.generateAndDeliverCredentials(userId, req.user.id, channel || 'EMAIL');
  }

  @Post('credentials/bulk-generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Director')
  async bulkGenerateCredentials(
    @Body() body: { userIds: string[]; channel?: 'SMS' | 'EMAIL' | 'WHATSAPP' },
    @Req() req: any,
  ) {
    return this.identityService.bulkGenerateCredentials(body.userIds, req.user.id, body.channel || 'EMAIL');
  }

  @Post('credentials/resend/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Director')
  async resendCredentials(
    @Param('userId') userId: string,
    @Body('channel') channel: 'SMS' | 'EMAIL' | 'WHATSAPP',
    @Req() req: any,
  ) {
    return this.identityService.resendCredentials(userId, req.user.id, channel || 'EMAIL');
  }

  @Get('credentials/delivery-history/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Director')
  async getDeliveryHistory(@Param('userId') userId: string) {
    return this.identityService.getDeliveryHistory(userId);
  }

  // ============ PASSWORD MANAGEMENT ============

  @Post('password/generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Director')
  async generatePassword(@Body('role') role?: string, @Body('length') length?: number) {
    if (role) {
      return this.passwordGenService.generateRoleBasedPassword(role);
    }
    return this.passwordGenService.generateSecurePassword({ length });
  }

  @Post('password/change')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() req: any,
    @Body('currentPassword') currentPassword: string,
    @Body('newPassword') newPassword: string,
  ) {
    this.logger.log(`Password change request for user: ${req.user.id}`);
    return this.accountRecoveryService.changePassword(req.user.id, currentPassword, newPassword);
  }

  @Post('password/reset/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Director')
  async resetPassword(@Param('userId') userId: string, @Req() req: any) {
    return this.identityService.resetPassword(userId, req.user.id);
  }

  @Post('password/force-change/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Director')
  async forcePasswordChange(@Param('userId') userId: string, @Req() req: any) {
    return this.accountRecoveryService.forcePasswordChange(userId, req.user.id);
  }

  @Post('password/set/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Director')
  async setPassword(@Param('userId') userId: string, @Body('password') password: string) {
    return this.identityService.setPassword(userId, password);
  }

  // ============ ACCOUNT MANAGEMENT ============

  @Post('account/lock/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Director')
  async lockAccount(@Param('userId') userId: string, @Body('reason') reason: string, @Req() req: any) {
    return this.identityService.lockAccount(userId, req.user.id, reason);
  }

  @Post('account/unlock/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Director')
  async unlockAccount(@Param('userId') userId: string, @Body('reason') reason: string, @Req() req: any) {
    return this.identityService.unlockAccount(userId, req.user.id, reason);
  }

  @Post('account/toggle-mfa/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Director')
  async toggleMfa(@Param('userId') userId: string, @Body('enable') enable: boolean, @Req() req: any) {
    return this.identityService.toggleMfa(userId, req.user.id, enable);
  }

  // ============ SESSION & DEVICE MANAGEMENT ============

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async getActiveSessions(@Req() req: any) {
    return this.identityService.getActiveSessions(req.user.id);
  }

  @Post('sessions/logout-all')
  @UseGuards(JwtAuthGuard)
  async logoutAllDevices(@Req() req: any) {
    return this.identityService.forceLogoutAllDevices(req.user.id, req.user.id);
  }

  @Post('sessions/force-logout/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Director')
  async forceLogoutUser(@Param('userId') userId: string, @Req() req: any) {
    return this.identityService.forceLogoutAllDevices(userId, req.user.id);
  }

  @Get('devices')
  @UseGuards(JwtAuthGuard)
  async getDevices(@Req() req: any) {
    return this.identityService.getDevices(req.user.id);
  }

  @Post('devices/register')
  @UseGuards(JwtAuthGuard)
  async registerDevice(@Req() req: any, @Body() body: any) {
    return this.identityService.registerDevice(req.user.id, body);
  }

  @Delete('devices/:deviceId')
  @UseGuards(JwtAuthGuard)
  async removeDevice(@Req() req: any, @Param('deviceId') deviceId: string) {
    return this.identityService.removeDevice(req.user.id, deviceId);
  }

  // ============ ACCOUNT CENTER ============

  @Get('account-center')
  @UseGuards(JwtAuthGuard)
  async getAccountCenter(@Req() req: any) {
    return this.identityService.getAccountCenterData(req.user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Req() req: any, @Body() body: { email?: string; phone?: string; firstName?: string; lastName?: string }) {
    return this.identityService.updateProfile(req.user.id, body);
  }

  // ============ SECURITY LOGS ============

  @Get('security-logs')
  @UseGuards(JwtAuthGuard)
  async getSecurityLogs(@Req() req: any) {
    return this.identityService.getSecurityLogs(req.user.id);
  }

  @Get('security-logs/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Director')
  async getUserSecurityLogs(@Param('userId') userId: string) {
    return this.identityService.getSecurityLogs(userId);
  }

  @Get('audit-logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Director')
  async getAuditLogs(@Query() query: any) {
    return this.identityService.getAuditLogs(query);
  }

  // ============ OTP ============

  @Post('otp/send')
  @UseGuards(JwtAuthGuard)
  async sendOtp(@Req() req: any, @Body() body: { purpose: string; channel: 'EMAIL' | 'SMS' | 'WHATSAPP'; recipient: string }) {
    return this.otpService.sendOtp(req.user.id, body.purpose, body.channel, body.recipient);
  }

  @Post('otp/verify')
  @UseGuards(JwtAuthGuard)
  async verifyOtp(@Req() req: any, @Body() body: { otpCode: string; purpose: string }) {
    return this.otpService.verifyOtp(req.user.id, body.otpCode, body.purpose);
  }

  // ============ RECOVERY (Public) ============

  @Post('recovery/forgot-password')
  async forgotPassword(@Body('email') email: string) {
    return this.accountRecoveryService.forgotPassword(email);
  }

  @Post('recovery/forgot-username')
  async forgotUsername(@Body('email') email: string) {
    return this.accountRecoveryService.forgotUsername(email);
  }

  @Post('recovery/reset-password')
  async resetPasswordWithToken(@Body('token') token: string, @Body('newPassword') newPassword: string) {
    return this.accountRecoveryService.resetPasswordWithToken(token, newPassword);
  }
}
