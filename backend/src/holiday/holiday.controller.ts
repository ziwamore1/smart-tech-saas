import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { HolidayService } from './holiday.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('holiday')
@UseGuards(JwtAuthGuard)
export class HolidayController {
  constructor(private readonly holidayService: HolidayService) {}

  @Post()
  create(@Request() req: any, @Body() body: any) {
    if (req.user?.roles?.includes('Director') !== true && req.user?.schoolRoles?.includes('Director') !== true) {
      throw new Error('Only Directors can manage holidays');
    }
    return this.holidayService.create(req.user.schoolId, body);
  }

  @Get()
  findAll(@Request() req: any, @Query('type') type?: string, @Query('year') year?: string) {
    return this.holidayService.findAll(req.user.schoolId, {
      type,
      year: year ? parseInt(year) : undefined,
    });
  }

  @Get('check/:date')
  checkDate(@Request() req: any, @Param('date') date: string) {
    return this.holidayService.isHoliday(req.user.schoolId, new Date(date));
  }

  @Get('range')
  getInRange(@Request() req: any, @Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.holidayService.getHolidaysInRange(req.user.schoolId, new Date(startDate), new Date(endDate));
  }

  @Post('seed/:year')
  seedNationalHolidays(@Request() req: any, @Param('year') year: string) {
    if (req.user?.roles?.includes('Director') !== true && req.user?.schoolRoles?.includes('Director') !== true) {
      throw new Error('Only Directors can seed holidays');
    }
    return this.holidayService.seedNationalHolidays(req.user.schoolId, parseInt(year));
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.holidayService.findOne(id, req.user.schoolId);
  }

  @Put(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    if (req.user?.roles?.includes('Director') !== true && req.user?.schoolRoles?.includes('Director') !== true) {
      throw new Error('Only Directors can update holidays');
    }
    return this.holidayService.update(id, req.user.schoolId, body);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    if (req.user?.roles?.includes('Director') !== true && req.user?.schoolRoles?.includes('Director') !== true) {
      throw new Error('Only Directors can delete holidays');
    }
    return this.holidayService.remove(id, req.user.schoolId);
  }
}
