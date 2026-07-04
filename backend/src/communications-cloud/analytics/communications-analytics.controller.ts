import { Controller, Get, Param, Query } from '@nestjs/common';
import { CommunicationsAnalyticsService } from './communications-analytics.service';

@Controller('communications-cloud/analytics')
export class CommunicationsAnalyticsController {
  constructor(private readonly analyticsService: CommunicationsAnalyticsService) {}

  @Get('dashboard')
  async getDashboard() {
    return this.analyticsService.getDashboardStats();
  }

  @Get('daily')
  async getDaily(@Query('days') days?: string) {
    return this.analyticsService.getDailyMessages(days ? parseInt(days, 10) : 30);
  }

  @Get('monthly')
  async getMonthly(@Query('months') months?: string) {
    return this.analyticsService.getMonthlyMessages(months ? parseInt(months, 10) : 12);
  }

  @Get('country')
  async getCountry(@Query('channel') channel?: string) {
    return this.analyticsService.getCountryUsage(channel);
  }

  @Get('school/:schoolId')
  async getSchoolUsage(
    @Param('schoolId') schoolId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const period =
      startDate && endDate
        ? { start: new Date(startDate), end: new Date(endDate) }
        : undefined;
    return this.analyticsService.getSchoolUsage(schoolId, period);
  }

  @Get('providers')
  async getProviders(@Query('channel') channel?: string) {
    return this.analyticsService.getProviderComparison(channel);
  }

  @Get('delivery-rate')
  async getDeliveryRate(
    @Query('channel') channel?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const period =
      startDate && endDate
        ? { start: new Date(startDate), end: new Date(endDate) }
        : undefined;
    return this.analyticsService.getDeliveryRate(channel, period);
  }

  @Get('failure-rate')
  async getFailureRate(
    @Query('channel') channel?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const period =
      startDate && endDate
        ? { start: new Date(startDate), end: new Date(endDate) }
        : undefined;
    return this.analyticsService.getFailureRate(channel, period);
  }

  @Get('revenue')
  async getRevenue(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const period =
      startDate && endDate
        ? { start: new Date(startDate), end: new Date(endDate) }
        : undefined;
    return this.analyticsService.getRevenue(period);
  }
}
