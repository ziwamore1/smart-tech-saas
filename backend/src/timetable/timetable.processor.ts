import { Injectable } from '@nestjs/common';

@Injectable()
export class TimetableProcessor {
  async generateAI(schoolId: string) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
