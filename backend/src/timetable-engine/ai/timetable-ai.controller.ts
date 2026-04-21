import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { TimetableAssistant, createAssistant } from './ai/assistant';
import { TimetableCache, SlotIndex } from '../entities/cache';
import { Lesson } from '../solver/fastCSPSolver';
import { Intent } from './ai/types';

class ChatRequest {
  message: string;
  timetableId: string;
}

class ApplyRequest {
  intent: string;
  timetableId: string;
}

@Controller('timetable/ai')
export class TimetableAIController {
  private assistants = new Map<string, TimetableAssistant>();

  private getOrCreateAssistant(timetableId: string): TimetableAssistant {
    if (!this.assistants.has(timetableId)) {
      this.assistants.set(timetableId, createAssistant({ enableLearning: true }));
    }
    return this.assistants.get(timetableId)!;
  }

  @Post('chat')
  async chat(@Body() body: ChatRequest) {
    const assistant = this.getOrCreateAssistant(body.timetableId);

    const lessons: Lesson[] = [];
    const slots: SlotIndex[] = Array.from({ length: 35 }, (_, i) => i);
    const cache = new TimetableCache({ totalSlots: 35 });

    const response = await assistant.processInput(body.message, {
      lessons,
      slots,
      cache,
    });

    const suggestions = await assistant.suggestImprovements({
      lessons,
      slots,
      cache,
    });

    return {
      response,
      suggestions: suggestions.slice(0, 5).map(s => ({
        id: s.id,
        title: s.title,
        description: s.description,
        intent: s.intent,
      })),
    };
  }

  @Post('apply')
  async apply(@Body() body: ApplyRequest) {
    const assistant = this.getOrCreateAssistant(body.timetableId);

    const lessons: Lesson[] = [];
    const slots: SlotIndex[] = Array.from({ length: 35 }, (_, i) => i);
    const cache = new TimetableCache({ totalSlots: 35 });

    const intent = body.intent as Intent;
    const intentMap: Record<string, string> = {
      'FIX_CONFLICTS': 'fix conflicts',
      'REDUCE_GAPS': 'reduce gaps',
      'BALANCE_SUBJECTS': 'balance subjects',
      'BALANCE_DAYS': 'balance days',
      'OPTIMIZE_FULL': 'optimize',
      'OPTIMIZE_TEACHER': 'optimize teacher',
      'AVOID_LATE': 'avoid late periods',
    };

    const response = await assistant.processInput(
      intentMap[intent] || 'optimize',
      { lessons, slots, cache }
    );

    assistant.markAccepted(intentMap[intent] || intent);

    return { response };
  }

  @Get('suggestions')
  async suggestions(@Query('timetableId') timetableId: string) {
    const assistant = this.getOrCreateAssistant(timetableId);

    const lessons: Lesson[] = [];
    const slots: SlotIndex[] = Array.from({ length: 35 }, (_, i) => i);
    const cache = new TimetableCache({ totalSlots: 35 });

    const suggestions = await assistant.suggestImprovements({
      lessons,
      slots,
      cache,
    });

    return {
      suggestions: suggestions.slice(0, 5).map(s => ({
        id: s.id,
        title: s.title,
        description: s.description,
        intent: s.intent,
        impact: s.impact,
        estimatedImprovement: s.estimatedImprovement,
      })),
    };
  }

  @Get('insights')
  async insights(@Query('timetableId') timetableId: string) {
    const assistant = this.getOrCreateAssistant(timetableId);
    return assistant.getLearningInsights();
  }
}
