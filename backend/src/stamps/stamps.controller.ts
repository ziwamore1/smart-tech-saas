import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req, Logger } from '@nestjs/common';
import { StampsService } from './stamps.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('stamps')
@UseGuards(JwtAuthGuard)
export class StampsController {
  private readonly logger = new Logger(StampsController.name);

  constructor(private stampsService: StampsService) {}

  @Get()
  async getStamps(@Req() req: any) {
    const { schoolId } = req.user;
    return this.stampsService.getStamps(schoolId);
  }

  @Get('documents')
  async getStampedDocuments(@Req() req: any) {
    const { schoolId, id: userId, roles } = req.user;
    return this.stampsService.getStampedDocuments(schoolId, userId, roles);
  }

  @Get('approvals')
  async getApprovalRequests(@Req() req: any) {
    const { schoolId } = req.user;
    return this.stampsService.getApprovalRequests(schoolId);
  }

  @Post('apply')
  async applyStamp(@Req() req: any, @Body() body: { documentId: string; stampId: string; note?: string }) {
    const { schoolId, id: userId, roles } = req.user;
    return this.stampsService.applyStamp(schoolId, userId, roles, body);
  }

  @Post('approvals/:id')
  async approveDocument(@Req() req: any, @Param('id') id: string, @Body() body: { approved: boolean; note?: string }) {
    const { schoolId, id: userId } = req.user;
    return this.stampsService.approveDocument(schoolId, userId, id, body);
  }

  @Post('request-approval')
  async requestApproval(@Req() req: any, @Body() body: { documentId: string; note?: string }) {
    const { schoolId, id: userId } = req.user;
    return this.stampsService.requestApproval(schoolId, userId, body);
  }

  @Get('verify/:hash')
  async verifyDocument(@Param('hash') hash: string) {
    return this.stampsService.verifyDocument(hash);
  }

  @Get('documents/:id/pdf')
  async getDocumentPDF(@Param('id') id: string) {
    return { url: `/api/v1/stamps/documents/${id}/download` };
  }

  @Get('workflows')
  async getApprovalWorkflows(@Req() req: any) {
    const { schoolId, id: userId, roles } = req.user;
    return this.stampsService.getApprovalWorkflows(schoolId, userId, roles);
  }

  @Post('workflows')
  async createApprovalWorkflow(@Req() req: any, @Body() body: { documentId: string; documentName: string; documentType: string }) {
    const { schoolId, id: userId } = req.user;
    return this.stampsService.createApprovalWorkflow(schoolId, userId, body);
  }

  @Post('workflows/:workflowId/steps/:stepId')
  async processApprovalStep(
    @Req() req: any,
    @Param('workflowId') workflowId: string,
    @Param('stepId') stepId: string,
    @Body() body: { approved: boolean; note?: string },
  ) {
    const { schoolId, id: userId } = req.user;
    return this.stampsService.processApprovalStep(schoolId, userId, workflowId, stepId, body);
  }

  @Post('upload')
  async uploadStamp(@Req() req: any, @Body() body: { name: string; type: string; svgContent?: string; imageUrl?: string }) {
    const { schoolId, id: userId } = req.user;
    return this.stampsService.uploadStamp(schoolId, userId, body);
  }

  @Delete(':id')
  async deleteStamp(@Req() req: any, @Param('id') id: string) {
    const { schoolId } = req.user;
    return { message: 'Stamp deleted' };
  }
}
