import { Controller, Query, Get, Post, Body, Req, Res, UseGuards, Param } from '@nestjs/common';
import { ParentService } from './parent.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateParentDto } from './dto/create-parent.dto';

@Controller('parent')
@UseGuards(JwtAuthGuard)
export class ParentController {
  constructor(private service: ParentService) {}

  @Post('register')
  register(@Body() dto: CreateParentDto, @Req() req: any) {
    return this.service.register(dto, req.user.schoolId);
  }

  @Get('children')
  getChildren(@Req() req: any) {
    return this.service.getChildren(req.user.id);
  }

  @Get('children/:studentId/attendance')
  getChildAttendance(@Param('studentId') studentId: string) {
    return this.service.getChildAttendance(studentId);
  }

  @Get('children/:studentId/homework')
  getChildHomework(@Param('studentId') studentId: string) {
    return this.service.getChildHomework(studentId);
  }

  @Get('results')
  getResults(@Query('studentId') studentId: string) {
    return this.service.getChildResults(studentId);
  }

  @Get('report-card')
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
}
