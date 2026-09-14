import { Module } from '@nestjs/common';
import { BusinessCalendarController } from './business-calendar.controller';
import { BusinessCalendarService } from './business-calendar.service';
import { CalendarExcelService } from './calendar-excel.service';
import { BusinessCalendarReportService } from './business-calendar-report.service';
import { BusinessCalendarAnalyticsService } from './business-calendar-analytics.service';
import { BusinessCalendarNotificationService } from './business-calendar-notification.service';
import { CommunicationsCloudModule } from '../communications-cloud/communications-cloud.module';

@Module({ imports: [CommunicationsCloudModule], controllers: [BusinessCalendarController], providers: [BusinessCalendarService, CalendarExcelService, BusinessCalendarReportService, BusinessCalendarAnalyticsService, BusinessCalendarNotificationService] })
export class BusinessCalendarModule {}
