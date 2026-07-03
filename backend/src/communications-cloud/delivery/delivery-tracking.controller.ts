import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { DeliveryTrackingService } from './delivery-tracking.service';

@Controller('communications-cloud/delivery')
@UseGuards(JwtAuthGuard)
export class DeliveryTrackingController {
  constructor(private readonly deliveryTrackingService: DeliveryTrackingService) {}

  @Get(':messageId')
  async getDeliveryLogs(@Param('messageId') messageId: string) {
    return this.deliveryTrackingService.getMessageDeliveryLogs(messageId);
  }

  @Get('stats')
  async getStats(
    @Query('channel') channel?: string,
    @Query('schoolId') schoolId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const period =
      startDate && endDate
        ? { start: new Date(startDate), end: new Date(endDate) }
        : undefined;
    return this.deliveryTrackingService.getDeliveryStats(
      channel as any,
      schoolId,
      period,
    );
  }

  @Get('failed')
  async getFailed(
    @Query('channel') channel?: string,
    @Query('limit') limit?: string,
  ) {
    return this.deliveryTrackingService.getFailedDeliveries(
      channel as any,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
