import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ReportCardService } from '../report-card/report-card.service';

@Processor('publishing', { drainDelay: 30000, stalledInterval: 120000 })
export class PublishingWorker extends WorkerHost {
  constructor(private reportCardService: ReportCardService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'generate') {
      const { schoolId, studentId, termId } = job.data;

      await this.reportCardService.generateReportCardPdf(
        schoolId,
        studentId,
        termId,
      );
    }
  }
}
