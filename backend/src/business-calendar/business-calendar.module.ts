import { Module } from '@nestjs/common';
import { BusinessCalendarController } from './business-calendar.controller';
import { BusinessCalendarService } from './business-calendar.service';
import { CalendarExcelService } from './calendar-excel.service';
import { BusinessCalendarReportService } from './business-calendar-report.service';

@Module({ controllers: [BusinessCalendarController], providers: [BusinessCalendarService, CalendarExcelService, BusinessCalendarReportService] })
export class BusinessCalendarModule {}
