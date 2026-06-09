import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { TimetableService } from './timetable.service';

@Processor('timetable')
@Injectable()
export class TimetableProcessor extends WorkerHost {
  constructor(private readonly timetableService: TimetableService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'generate') {
      const { schoolId } = job.data;
      console.log('Generating timetable for:', schoolId);
      await this.generateAI(schoolId);
      console.log('Timetable generated!');
    }
  }

  async generateAI(schoolId: string) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
