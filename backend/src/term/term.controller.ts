// src/term/term.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TermService } from './term.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('term')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TermController {
  constructor(private termService: TermService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.termService.findAllBySchool(req.user.schoolId);
  }

  @Post()
  @Roles('DIRECTOR')
  create(@Body() body: any, @Req() req: any) {
    return this.termService.create(body, req.user.schoolId);
  }

  @Get('current')
  getCurrent(@Req() req: any) {
    return this.termService.getCurrent(req.user.schoolId);
  }

  @Get(':academicYearId')
  @Roles('DIRECTOR')
  findAllByYear(@Param('academicYearId') academicYearId: string) {
    return this.termService.findAll(academicYearId);
  }

  @Patch(':id/set-current')
  @Roles('DIRECTOR')
  setCurrent(@Param('id') id: string, @Req() req: any) {
    return this.termService.setCurrent(id, req.user.schoolId);
  }

  @Patch(':termId/finalize')
  @Roles('DIRECTOR')
  finalizeResults(@Req() req, @Param('termId') termId: string) {
    return this.termService.finalizeResults(req.user.schoolId, termId);
  }

  @Patch(':termId/unfinalize')
  @Roles('DIRECTOR')
  unfinalizeResults(@Req() req, @Param('termId') termId: string) {
    return this.termService.unfinalizeResults(req.user.schoolId, termId);
  }
}
