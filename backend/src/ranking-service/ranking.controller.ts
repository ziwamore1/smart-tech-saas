import {
  Controller,
  Post,
  Get,
  Query,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { RankingService } from './ranking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('ranking')
@UseGuards(JwtAuthGuard)
export class RankingController {
  constructor(private ranking: RankingService) {}

  @Post('class')
  computeClassRankings(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
    @Request() req,
  ) {
    return this.ranking.computeClassRankings(classId, termId, req.user.schoolId);
  }

  @Post('subject')
  computeSubjectRankings(
    @Query('subjectId') subjectId: string,
    @Query('termId') termId: string,
    @Query('classId') classId: string,
    @Request() req,
  ) {
    return this.ranking.computeSubjectRankings(
      subjectId,
      termId,
      classId,
      req.user.schoolId,
    );
  }

  @Get('student/:studentId')
  getStudentRankings(
    @Param('studentId') studentId: string,
    @Query('termId') termId: string,
  ) {
    return this.ranking.getStudentRankings(studentId, termId);
  }

  @Get('top-performers')
  getTopPerformers(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
    @Query('limit') limit?: string,
  ) {
    return this.ranking.getTopPerformers(
      classId,
      termId,
      parseInt(limit) || 10,
    );
  }

  @Post('percentiles')
  computePercentiles(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
    @Request() req,
  ) {
    return this.ranking.computePercentileRanks(
      classId,
      termId,
      req.user.schoolId,
    );
  }
}
