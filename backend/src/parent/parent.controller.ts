import { Controller, Query, Get, Post, Put, Delete, Body, Req, Res, UseGuards, Param } from '@nestjs/common';
import { ParentService } from './parent.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateParentDto } from './dto/create-parent.dto';

@Controller('parent')
export class ParentController {
  constructor(private service: ParentService) {}

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Director')
  register(@Body() dto: CreateParentDto, @Req() req: any) {
    return this.service.register(dto, req.user.schoolId);
  }

  @Get('children')
  @UseGuards(JwtAuthGuard)
  getChildren(@Req() req: any) {
    return this.service.getChildren(req.user.id);
  }

  @Get('children/results')
  @UseGuards(JwtAuthGuard)
  getAllChildrenResults(@Req() req: any) {
    return this.service.getAllChildrenResults(req.user.id);
  }

  @Get('children/:studentId/attendance')
  @UseGuards(JwtAuthGuard)
  getChildAttendance(@Param('studentId') studentId: string) {
    return this.service.getChildAttendance(studentId);
  }

  @Get('children/:studentId/homework')
  @UseGuards(JwtAuthGuard)
  getChildHomework(@Param('studentId') studentId: string) {
    return this.service.getChildHomework(studentId);
  }

  @Get('results')
  @UseGuards(JwtAuthGuard)
  getResults(@Query('studentId') studentId: string, @Query('termId') termId: string, @Req() req: any) {
    return this.service.getChildResults(studentId, req.user.schoolId, termId);
  }

  @Get('report-card')
  @UseGuards(JwtAuthGuard)
  async downloadReportCard(
    @Query('studentId') studentId: string,
    @Query('termId') termId: string,
    @Req() req: any,
    @Res() res,
  ) {
    const pdf = await this.service.getReportCard(
      req.user.schoolId,
      studentId,
      termId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=report-card.pdf',
    });

    res.send(pdf);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Head Teacher')
  findAll(@Req() req: any, @Query('search') search?: string) {
    return this.service.findAll(req.user.schoolId, search);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Head Teacher')
  getStats(@Req() req: any) {
    return this.service.getStats(req.user.schoolId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director', 'Head Teacher')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Post('link-child')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Director', 'Teacher')
  linkChild(@Body('parentId') parentId: string, @Body('studentId') studentId: string) {
    return this.service.linkChild(parentId, studentId);
  }

  @Post('unlink-child')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'Director')
  unlinkChild(@Body('parentId') parentId: string, @Body('studentId') studentId: string) {
    return this.service.unlinkChild(parentId, studentId);
  }
}
