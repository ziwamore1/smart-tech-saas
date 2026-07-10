import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AcademicYearService } from './academic-year.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('academic-year')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcademicYearController {
  constructor(private readonly service: AcademicYearService) {}

  @Post()
  @Roles('DIRECTOR')
  create(@Body() body: any, @Req() req: any) {
    return this.service.create(body, req.user.schoolId);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.service.findAll(req.user.schoolId);
  }

  @Patch(':id')
  @Roles('DIRECTOR')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.service.update(id, body, req.user.schoolId);
  }

  @Delete(':id')
  @Roles('DIRECTOR')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.service.delete(id, req.user.schoolId);
  }

  @Patch(':id/current')
  @Roles('DIRECTOR')
  setCurrent(@Param('id') id: string, @Req() req: any) {
    return this.service.setCurrent(id, req.user.schoolId);
  }
}
