import { Module } from '@nestjs/common';
import { BusinessCalendarController } from './business-calendar.controller';
import { BusinessCalendarService } from './business-calendar.service';
import { CalendarExcelService } from './calendar-excel.service';

@Module({ controllers: [BusinessCalendarController], providers: [BusinessCalendarService, CalendarExcelService] })
export class BusinessCalendarModule {}
