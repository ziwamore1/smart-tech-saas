import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { TimetableService } from './timetable.service';

@Processor('timetable')
@Injectable()
export class TimetableProcessor {
  constructor(private readonly timetableService: TimetableService) {}

  @Process('generate')
  async handleGenerate(job: Job) {
    const { schoolId } = job.data;
    console.log('Generating timetable for:', schoolId);

    await this.generateAI(schoolId);

    console.log('Timetable generated!');
  }

  async generateAI(schoolId: string) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
