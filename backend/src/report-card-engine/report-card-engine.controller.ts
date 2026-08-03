import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  Request,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ReportCardEngineService } from './report-card-engine.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipService } from '../common/services/ownership.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('report-card-engine')
@UseGuards(JwtAuthGuard)
export class ReportCardEngineController {
  constructor(
    private reportCardEngine: ReportCardEngineService,
    private ownership: OwnershipService,
    private prisma: PrismaService,
  ) {}

  @Get('student/:studentId')
  async generateReportCard(
    @Param('studentId') studentId: string,
    @Query('termId') termId: string,
    @Request() req,
  ) {
    if (!this.ownership.isStaff(req.user)) {
      const resolvedId = await this.ownership.resolveStudentId(req.user, studentId);
      await this.ownership.assertCanViewStudent(req.user, resolvedId);
      if (!termId) throw new BadRequestException('termId is required');
      const published = await this.prisma.computedResult.count({
        where: {
          studentId: resolvedId,
          termId,
          schoolId: req.user.schoolId,
          status: { in: ['PUBLISHED', 'LOCKED'] },
        },
      });
      if (published === 0) {
        throw new NotFoundException('Results for this term are not published yet');
      }
      studentId = resolvedId;
    }
    return this.reportCardEngine.generateReportCardData(
      studentId,
      termId,
      req.user.schoolId,
    );
  }

  @Get('bulk')
  generateBulkReportCards(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
    @Request() req,
  ) {
    return this.reportCardEngine.generateBulkReportCards(
      classId,
      termId,
      req.user.schoolId,
    );
  }

  @Get('remarks')
  getRemarks(
    @Request() req,
    @Query('type') type?: string,
  ) {
    return this.reportCardEngine.getRemarkTemplates(req.user.schoolId, type);
  }

  @Post('remarks')
  createRemark(@Request() req, @Body() body: any) {
    return this.reportCardEngine.createRemark(req.user.schoolId, body);
  }

  @Get('status')
  getReportCardStatus(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
    @Request() req,
  ) {
    return this.reportCardEngine.getReportCardStatus(
      classId,
      termId,
      req.user.schoolId,
    );
  }
}
