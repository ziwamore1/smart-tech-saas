import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { 
  generateTimetable, 
  GenerateTimetableRequest, 
  GenerateTimetableResponse,
  formatScheduleByClass,
  formatScheduleByTeacher,
  formatScheduleByDay,
  exportToArray,
  exportToObject,
} from './api';
import { getStatistics } from './preprocessor';
import { TimetableInput } from './index';

class GenerateTimetableDto implements GenerateTimetableRequest {
  classes: any[];
  teachers: any[];
  subjects: any[];
  rooms: any[];
  lessons: any[];
  timeslots?: any[];
  config?: any;
}

class FormatResponseDto {
  schedule: any[];
  lessons: any[];
  format: 'array' | 'object' | 'byClass' | 'byTeacher' | 'byDay';
}

@Controller('timetable')
export class TimetableController {
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generate(@Body() dto: GenerateTimetableDto): Promise<GenerateTimetableResponse> {
    return generateTimetable(dto, { useBacktracking: true });
  }

  @Post('format')
  @HttpCode(HttpStatus.OK)
  format(@Body() dto: FormatResponseDto): any {
    const { schedule, lessons, format = 'array' } = dto;
    
    switch (format) {
      case 'array':
        return exportToArray(schedule);
      case 'object':
        return exportToObject(schedule, lessons);
      case 'byClass':
        return Object.fromEntries(formatScheduleByClass(schedule, lessons));
      case 'byTeacher':
        return Object.fromEntries(formatScheduleByTeacher(schedule, lessons));
      case 'byDay':
        return Object.fromEntries(formatScheduleByDay(schedule));
      default:
        return schedule;
    }
  }

  @Post('statistics')
  @HttpCode(HttpStatus.OK)
  statistics(@Body() input: TimetableInput): ReturnType<typeof getStatistics> {
    return getStatistics(input);
  }
}

export default TimetableController;