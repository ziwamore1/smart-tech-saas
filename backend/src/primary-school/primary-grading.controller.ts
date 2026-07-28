import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GradingEngineService } from '../grading-engine/grading-engine.service';
import { GradingSystemService } from '../grading-system/grading-system.service';

@Controller('primary/grading')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrimaryGradingController {
  constructor(
    private readonly gradingEngine: GradingEngineService,
    private readonly gradingSystemService: GradingSystemService,
  ) {}

  @Get('policies')
  @Roles('Director', 'Class Teacher', 'Teacher')
  async getPolicies(@Request() req) {
    await this.gradingSystemService.ensureG7PolicyExists(req.user.schoolId);
    const policies = await this.gradingEngine.getGradingPolicies(req.user.schoolId);
    return { data: policies, message: 'Primary grading policies retrieved' };
  }

  @Get('policies/:id')
  @Roles('Director', 'Class Teacher', 'Teacher')
  async getPolicy(@Param('id') id: string) {
    const policy = await this.gradingEngine.getGradingPolicyById(id);
    if (!policy) throw new NotFoundException('Grading policy not found');
    return { data: policy, message: 'Grading policy retrieved' };
  }

  @Post('assign')
  @Roles('Director')
  async assignPolicy(
    @Body() body: { classId: string; subjectId?: string; termId?: string; policyId: string },
    @Request() req,
  ) {
    const result = await this.gradingEngine.assignGradingPolicy({
      classId: body.classId,
      subjectId: body.subjectId,
      termId: body.termId,
      policyId: body.policyId,
      schoolId: req.user.schoolId,
    });
    return { data: result, message: 'Grading policy assigned successfully' };
  }

  @Get('report/:classId/:termId')
  @Roles('Director', 'Class Teacher', 'Teacher')
  async getClassReport(@Param('classId') classId: string, @Param('termId') termId: string, @Request() req) {
    const report = await this.gradingEngine.getClassTermReport(classId, termId, req.user.schoolId);
    return { data: report, message: 'Class term report retrieved' };
  }
}
