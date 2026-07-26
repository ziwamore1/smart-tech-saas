import { Controller, Get, Post, Delete, Body, Req, UseGuards, Res, Param, Query, Logger } from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import { ReportEngineService, ReportType, ReportGenerationRequest } from './report-engine.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('report-engine')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportEngineController {
  private readonly logger = new Logger(ReportEngineController.name);
  constructor(private readonly reportEngine: ReportEngineService) {}

  @Get('types')
  @Roles('Director', 'Class Teacher', 'Teacher')
  getReportTypes() {
    return this.reportEngine.getReportTypes();
  }

  @Get('reports')
  @Roles('Director', 'Class Teacher', 'Teacher', 'Parent')
  async listReports(
    @Req() req,
    @Query('reportType') reportType?: ReportType,
    @Query('classId') classId?: string,
    @Query('studentId') studentId?: string,
    @Query('termId') termId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportEngine.listReports(req.user.schoolId, {
      reportType,
      classId,
      studentId,
      termId,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('reports/:id')
  @Roles('Director', 'Class Teacher', 'Teacher', 'Parent')
  async getReport(@Req() req, @Param('id') id: string) {
    return this.reportEngine.getReportById(id, req.user.schoolId);
  }

  @Delete('reports/:id')
  @Roles('Director')
  async deleteReport(@Req() req, @Param('id') id: string) {
    return this.reportEngine.deleteReport(id, req.user.schoolId);
  }

  @Post('validate')
  @Roles('Director', 'Class Teacher', 'Teacher')
  async validateRequest(
    @Req() req,
    @Body() body: { type: ReportType; studentId?: string; classId?: string; termId?: string; templateId?: string },
  ) {
    return this.reportEngine.validateGenerationRequest({
      ...body,
      schoolId: req.user.schoolId,
    });
  }

  @Post('generate')
  @Roles('Director', 'Class Teacher')
  async generateReport(
    @Req() req,
    @Body() body: {
      type: ReportType;
      studentId?: string;
      classId?: string;
      termId?: string;
      templateId?: string;
      options?: Record<string, any>;
    },
  ) {
    return this.reportEngine.generateReport({
      ...body,
      schoolId: req.user.schoolId,
      options: {
        ...body.options,
        userId: req.user.id,
        userName: req.user.name || req.user.firstName,
      },
    });
  }

  @Post('generate-pdf')
  @Roles('Director', 'Class Teacher')
  async generateAndDownloadPdf(
    @Req() req,
    @Body() body: {
      type: ReportType;
      studentId?: string;
      classId?: string;
      termId?: string;
      templateId?: string;
      options?: Record<string, any>;
    },
    @Res() res: ExpressResponse,
  ) {
    try {
      const report = await this.reportEngine.generateReport({
        ...body,
        schoolId: req.user.schoolId,
        options: {
          ...body.options,
          userId: req.user.id,
          userName: req.user.name || req.user.firstName,
        },
      });

      // Use cached buffer directly — avoids Cloudinary round-trip which corrupts PDFs uploaded as image type
      const bufferKey = (report as any)._bufferKey;
      if (bufferKey) {
        const pdfBuffer = this.reportEngine.getCachedPdfBuffer(bufferKey);
        if (pdfBuffer) {
          res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${report.fileName}"`,
            'X-Report-Id': report.id,
            'X-Pdf-Url': report.pdfUrl || '',
          });
          res.send(pdfBuffer);
          return;
        }
      }

      // Fallback: re-download from Cloudinary
      if (report.pdfUrl) {
        try {
          const pdfBuffer = await this.reportEngine.downloadPdf(report.pdfUrl);
          res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${report.fileName}"`,
            'X-Report-Id': report.id,
            'X-Pdf-Url': report.pdfUrl,
          });
          res.send(pdfBuffer);
          return;
        } catch {
          // Cloudinary download failed
        }
      }

      // Both cache and Cloudinary failed — return error, not JSON
      res.status(404).json({
        statusCode: 404,
        timestamp: new Date().toISOString(),
        message: 'PDF not available. Please regenerate the report.',
        data: { reportId: report.id, pdfUrl: report.pdfUrl },
      });
    } catch (error) {
      this.logger.error(`generate-pdf failed: ${error.message}`, error.stack);
      const status = error.getStatus?.() || 500;
      res.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        message: error.message || 'Failed to generate report',
      });
    }
  }

  @Post('generate-bulk')
  @Roles('Director')
  async generateBulkReports(
    @Req() req,
    @Body() body: {
      type: ReportType;
      classId?: string;
      termId?: string;
      templateId?: string;
      studentIds?: string[];
    },
  ) {
    return this.reportEngine.generateBulkReports({
      ...body,
      schoolId: req.user.schoolId,
      options: {
        userId: req.user.id,
        userName: req.user.name || req.user.firstName,
      },
    });
  }

  @Get('download/:reportId')
  @Roles('Director', 'Class Teacher', 'Teacher', 'Parent')
  async downloadReport(
    @Req() req,
    @Param('reportId') reportId: string,
    @Res() res: ExpressResponse,
  ) {
    try {
      const report = await this.reportEngine.getReportById(reportId, req.user.schoolId);
      if (report?.fileUrl) {
        const pdfBuffer = await this.reportEngine.downloadPdf(report.fileUrl);
        res.set({
          'Content-Type': report.mimeType || 'application/pdf',
          'Content-Disposition': `attachment; filename="${report.fileName}"`,
        });
        res.send(pdfBuffer);
        return;
      }

      res.status(404).json({
        statusCode: 404,
        timestamp: new Date().toISOString(),
        message: 'Report PDF not available. Generate the report first.',
      });
    } catch (error) {
      const status = error.getStatus?.() || 500;
      res.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        message: error.message || 'Failed to download report',
      });
    }
  }
}
