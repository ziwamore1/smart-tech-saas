import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { ReportCardService } from '../report-card/report-card.service';

@Processor('publishing')
export class PublishingWorker {
  constructor(private reportCardService: ReportCardService) {}

  @Process('generate')
  async generate(job: Job) {
    const { schoolId, studentId, termId } = job.data;

    await this.reportCardService.generateReportCardPdf(
      schoolId,
      studentId,
      termId,
    );
  }
}
