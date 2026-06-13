import { Controller, Post, Get, Body, Param, UseGuards, Req, Logger } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('approval')
@UseGuards(JwtAuthGuard)
export class ApprovalController {
  private readonly logger = new Logger(ApprovalController.name);

  constructor(private readonly approvalService: ApprovalService) {}

  @Post('workflow')
  async createWorkflow(@Body() body: any, @Req() req: any) {
    const { documentId, documentName, documentType, schoolId, steps } = body;

    const workflow = await this.approvalService.createWorkflow({
      documentId,
      documentName,
      documentType,
      createdById: req.user.id,
      schoolId,
      steps,
    });

    return {
      success: true,
      workflow,
    };
  }

  @Post('step/:stepId/approve')
  async approveStep(@Param('stepId') stepId: string, @Body() body: any, @Req() req: any) {
    const { action, note, signature } = body;

    const result = await this.approvalService.approveStep({
      stepId,
      userId: req.user.id,
      action,
      note,
      signature,
    });

    return {
      success: true,
      result,
    };
  }

  @Post('step/:stepId/comment')
  async addComment(@Param('stepId') stepId: string, @Body() body: any, @Req() req: any) {
    const { comment } = body;

    const result = await this.approvalService.addComment({
      stepId,
      userId: req.user.id,
      comment,
    });

    return {
      success: true,
      comment: result,
    };
  }

  @Get('workflow/:workflowId')
  async getWorkflow(@Param('workflowId') workflowId: string) {
    const workflow = await this.approvalService.getWorkflow(workflowId);

    return {
      success: true,
      workflow,
    };
  }

  @Get('document/:documentId')
  async getDocumentWorkflows(@Param('documentId') documentId: string) {
    const workflows = await this.approvalService.getDocumentWorkflows(documentId);

    return {
      success: true,
      workflows,
    };
  }

  @Get('school/all')
  async getAllWorkflows() {
    const workflows = await this.approvalService.getAllWorkflows();

    return {
      success: true,
      workflows,
    };
  }

  @Get('school/:schoolId')
  async getSchoolWorkflows(@Param('schoolId') schoolId: string, @Req() req: any) {
    const { status } = req.query;
    const workflows = await this.approvalService.getSchoolWorkflows(schoolId, status);

    return {
      success: true,
      workflows,
    };
  }

  @Get('pending')
  async getPendingApprovals(@Req() req: any) {
    const approvals = await this.approvalService.getPendingApprovals(req.user.id);

    return {
      success: true,
      approvals,
    };
  }
}
