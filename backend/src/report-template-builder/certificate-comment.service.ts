import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class CertificateCommentService {
  private readonly logger = new Logger(CertificateCommentService.name);
  private readonly openai?: OpenAI;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) this.openai = new OpenAI({ apiKey });
  }

  async generate(input: {
    certificateType: string;
    awardText?: string;
    studentName: string;
    termName?: string;
    average?: number;
    classRank?: number;
    classSize?: number;
    attendanceRate?: number;
    subjects?: Array<{ name: string; score: number; grade?: string }>;
  }): Promise<string> {
    const fallback = this.fallback(input);
    if (!this.openai) return fallback;

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.config.get<string>('OPENAI_CERTIFICATE_MODEL') || 'gpt-4o-mini',
        temperature: 0.55,
        max_tokens: 90,
        messages: [
          {
            role: 'system',
            content: 'Write one warm, formal certificate comment in 25 to 45 words. Use only the supplied facts. Do not invent awards, ranks, subjects, or activities. Do not mention AI, prompts, or data.',
          },
          {
            role: 'user',
            content: JSON.stringify(input),
          },
        ],
      });
      const text = completion.choices[0]?.message?.content?.trim();
      return text || fallback;
    } catch (error: any) {
      this.logger.warn(`Certificate comment AI unavailable: ${error?.message || error}`);
      return fallback;
    }
  }

  private fallback(input: { certificateType: string; studentName: string; average?: number; classRank?: number; classSize?: number; attendanceRate?: number }): string {
    const average = input.average == null ? '' : ` with an average performance of ${input.average.toFixed(1)}%`;
    const rank = input.classRank && input.classSize ? `, placing ${input.studentName} ${this.ordinal(input.classRank)} in a class of ${input.classSize}` : '';
    const attendance = input.attendanceRate != null ? ` Attendance was ${input.attendanceRate.toFixed(1)}%.` : '';
    const type = input.certificateType === 'ATTENDANCE'
      ? 'consistent attendance and punctuality'
      : input.certificateType === 'SPORTS_AWARD'
        ? 'dedication, sportsmanship, and athletic achievement'
        : input.certificateType === 'GRADUATION'
          ? 'successful completion of the required academic programme'
          : 'academic excellence and sustained commitment to learning';
    return `${input.studentName} is recognised for ${type}${average}${rank}.${attendance}`;
  }

  private ordinal(value: number): string {
    const suffix = value % 10 === 1 && value % 100 !== 11 ? 'st' : value % 10 === 2 && value % 100 !== 12 ? 'nd' : value % 10 === 3 && value % 100 !== 13 ? 'rd' : 'th';
    return `${value}${suffix}`;
  }
}
