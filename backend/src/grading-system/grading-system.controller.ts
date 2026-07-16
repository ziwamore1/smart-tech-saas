import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { GradingSystemService } from './grading-system.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('grading-systems')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GradingSystemController {
  constructor(private service: GradingSystemService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.service.findAll(req.user.schoolId);
  }

  @Get('default')
  findDefault(@Req() req: any) {
    return this.service.findDefault(req.user.schoolId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user.schoolId);
  }

  @Post()
  @Roles('DIRECTOR')
  create(@Body() body: any, @Req() req: any) {
    return this.service.create(req.user.schoolId, body);
  }

  @Patch(':id')
  @Roles('DIRECTOR')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.service.update(id, req.user.schoolId, body);
  }

  @Delete(':id')
  @Roles('DIRECTOR')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.service.delete(id, req.user.schoolId);
  }

  @Patch(':id/set-default')
  @Roles('DIRECTOR')
  setDefault(@Param('id') id: string, @Req() req: any) {
    return this.service.setDefault(id, req.user.schoolId);
  }
}
