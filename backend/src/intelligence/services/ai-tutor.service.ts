import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import { AiContextService } from './ai-context.service';
import { AiMemoryService } from './ai-memory.service';
import { SubjectEngineService } from './subject-engine.service';
import { buildSystemPrompt, buildUserPrompt, AiContext, Role } from './prompt-templates';
import { CompositeSubjectService } from '../../composite-subject/composite-subject.service';
import { CloudinaryService, FOLDERS } from '../../cloudinary/cloudinary.service';

@Injectable()
export class AiTutorService {
  private readonly logger = new Logger(AiTutorService.name);
  private openai: OpenAI;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private aiContext: AiContextService,
    private aiMemory: AiMemoryService,
    private subjectEngine: SubjectEngineService,
    private compositeSubjectService: CompositeSubjectService,
    private cloudinary: CloudinaryService,
  ) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('OpenAI initialized (gpt-4o-mini). AI Tutor is active.');
    } else {
      this.logger.warn('OPENAI_API_KEY not configured. AI Tutor will use fallback responses (keyword-matched, not AI-generated).');
    }
  }

  async startSession(
    studentId: string,
    schoolId: string,
    options?: { subjectId?: string; topic?: string; context?: Partial<AiContext> },
  ) {
    // Detect subject from topic if no subjectId given
    let detectedSubjectId = options?.subjectId || options?.context?.subjectId;
    if (!detectedSubjectId && options?.topic) {
      const detected = this.subjectEngine.detectSubjectFromQuery(options.topic);
      if (detected) {
        const subjectRecord = await this.prisma.subject.findFirst({
          where: { schoolId, name: { contains: detected, mode: 'insensitive' } },
          orderBy: { name: 'asc' },
        });
        if (subjectRecord) detectedSubjectId = subjectRecord.id;
      }
    }

    const session = await this.prisma.aiTutorSession.create({
      data: {
        studentId,
        schoolId,
        subjectId: detectedSubjectId,
        topic: options?.topic,
      },
    });

    const context = await this.buildFullContext(schoolId, {
      ...options?.context,
      subjectId: detectedSubjectId || options?.context?.subjectId,
      topic: options?.topic || options?.context?.topic,
    });
    const greeting = await this.generateGreeting(context, options);

    await this.prisma.aiTutorMessage.create({
      data: { sessionId: session.id, role: 'tutor', content: greeting },
    });

    await this.aiMemory.update(studentId, {
      subject: detectedSubjectId,
      topic: options?.topic,
      role: context.role,
      className: context.className,
      grade: context.grade,
      performanceSnapshot: context.currentPerformance
        ? { average: context.currentPerformance.average, weakAreas: context.currentPerformance.weakAreas }
        : undefined,
      recentMessages: [{ role: 'tutor', content: greeting }],
    }, session.id);

    return { sessionId: session.id, message: greeting };
  }

  async sendMessage(
    sessionId: string,
    studentId: string,
    message: string,
    schoolId: string,
    context?: Partial<AiContext> & { fileUrls?: string[] },
  ) {
    const session = await this.prisma.aiTutorSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 50 } },
    });

    if (!session || session.schoolId !== schoolId) {
      return { error: 'Session not found' };
    }
    if (session.studentId && session.studentId !== studentId) {
      return { error: 'Session not found' };
    }

    const { fileUrls, ...restContext } = context || {};
    const fileAttachmentContent = fileUrls?.length
      ? `\n\n[Attached files: ${fileUrls.join(', ')}]`
      : '';

    await this.prisma.aiTutorMessage.create({
      data: { sessionId, role: 'student', content: message + fileAttachmentContent },
    });

    const memory = await this.aiMemory.pushMessage(studentId, 'user', message + fileAttachmentContent, sessionId);
    const previousMessages = memory.recentMessages.slice(-10).map(m => ({
      role: m.role === 'tutor' ? 'assistant' : 'user',
      content: m.content,
    }));

    const fullContext = await this.buildFullContext(schoolId, {
      ...restContext,
      studentId,
      message: fileUrls?.length
        ? `${message}\n\nThe student has attached the following files for review: ${fileUrls.join(', ')}. Please analyze the attached files and incorporate them into your response.`
        : message,
      subject: restContext?.subject || session.subjectId || memory.subject || undefined,
      subjectId: restContext?.subjectId || session.subjectId || undefined,
      topic: restContext?.topic || session.topic || memory.topic || undefined,
      previousMessages,
    });

    const response = await this.generateLLMResponse(fullContext);

    // Try to parse structured JSON and store in metadata
    let structuredContent: any = null;
    let displayContent = response;
    try {
      const parsed = JSON.parse(response);
      if (parsed && typeof parsed === 'object' && parsed.type) {
        structuredContent = parsed;
        // Use explanation or steps as the display content
        displayContent = parsed.explanation || parsed.answer?.text || response;
      }
    } catch {
      // Not JSON, store as plain text
    }

    await this.prisma.aiTutorMessage.create({
      data: {
        sessionId,
        role: 'tutor',
        content: displayContent,
        metadata: structuredContent || { raw: response },
      },
    });

    await this.aiMemory.pushMessage(studentId, 'tutor', response, sessionId);

    return {
      response: displayContent,
      ...(structuredContent ? { structured: structuredContent, raw: response } : {}),
    };
  }

  async askQuestion(
    studentId: string,
    schoolId: string,
    question: string,
    subjectId?: string,
    context?: Partial<AiContext> & { fileUrls?: string[] },
  ) {
    if (!studentId) {
      const { fileUrls, ...restContext } = context || {};
      const genericCtx: AiContext = {
        role: 'student',
        message: fileUrls?.length
          ? `${question}\n\nThe student has attached the following files: ${fileUrls.join(', ')}. Please analyze them.`
          : question,
        subject: restContext?.subject || subjectId,
        subjectId: restContext?.subjectId || subjectId,
      };
      const response = await this.generateLLMResponse(genericCtx);
      let structuredData: any = null;
      try {
        const parsed = JSON.parse(response);
        if (parsed && typeof parsed === 'object' && parsed.type) {
          structuredData = parsed;
        }
      } catch {}
      return {
        response: structuredData?.explanation || response,
        ...(structuredData ? { structured: structuredData, raw: response } : {}),
        isGeneral: true,
      };
    }

    const sessions = await this.prisma.aiTutorSession.findMany({
      where: { studentId, schoolId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
      take: 1,
    });

    let sessionId: string;
    if (sessions.length > 0) {
      sessionId = sessions[0].id;
    } else {
      const result = await this.startSession(studentId, schoolId, { subjectId, context });
      sessionId = result.sessionId;
    }

    return this.sendMessage(sessionId, studentId, question, schoolId, context);
  }

  async getSessionHistory(sessionId: string, schoolId: string) {
    const session = await this.prisma.aiTutorSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!session || session.schoolId !== schoolId) return { error: 'Session not found' };

    return {
      sessionId: session.id,
      subjectId: session.subjectId,
      topic: session.topic,
      status: session.status,
      messages: session.messages.map(m => ({
        role: m.role,
        content: m.content,
        metadata: m.metadata,
        createdAt: m.createdAt,
      })),
    };
  }

  async getStudentSessions(studentId: string, schoolId: string) {
    const sessions = await this.prisma.aiTutorSession.findMany({
      where: { studentId, schoolId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    return sessions.map(s => ({
      sessionId: s.id,
      subjectId: s.subjectId,
      topic: s.topic,
      status: s.status,
      createdAt: s.createdAt,
      lastActive: s.updatedAt,
    }));
  }

  async endSession(
    sessionId: string,
    schoolId: string,
    feedback?: { rating?: number; helpful?: boolean; comment?: string },
  ) {
    const session = await this.prisma.aiTutorSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.schoolId !== schoolId) return { error: 'Session not found' };

    await this.prisma.aiTutorSession.update({
      where: { id: sessionId },
      data: { status: 'completed' },
    });

    if (feedback) {
      await this.prisma.aiTutorFeedback.upsert({
        where: { sessionId },
        update: feedback,
        create: { sessionId, ...feedback },
      });
    }

    return { message: 'Session ended', sessionId };
  }

  async getTutorInsights(studentId: string, schoolId: string) {
    const sessions = await this.prisma.aiTutorSession.findMany({
      where: { studentId, schoolId },
      include: { messages: true, feedback: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    if (!sessions.length) return { error: 'No tutoring sessions found' };

    const totalMessages = sessions.reduce((s, sess) => s + sess.messages.length, 0);
    const tutorMessages = sessions.reduce((s, sess) => s + sess.messages.filter(m => m.role === 'tutor').length, 0);
    const avgRating = sessions.filter(s => s.feedback?.rating).reduce((sum, s) => sum + (s.feedback?.rating || 0), 0) /
      Math.max(1, sessions.filter(s => s.feedback?.rating).length);

    const topics = sessions.filter(s => s.topic).map(s => s.topic);
    const uniqueTopics = [...new Set(topics)];

    const keywords = this.extractKeywords(
      sessions.flatMap(s => s.messages).filter(m => m.role === 'student').map(m => m.content),
    );

    return {
      totalSessions: sessions.length,
      totalMessages,
      tutorMessageRatio: totalMessages > 0 ? Number((tutorMessages / totalMessages * 100).toFixed(2)) : 0,
      averageRating: avgRating > 0 ? Number(avgRating.toFixed(2)) : null,
      topicsExplored: uniqueTopics,
      commonQuestionKeywords: keywords.slice(0, 10),
      recommendations: keywords.length > 0
        ? [`Student frequently asks about: ${keywords.slice(0, 5).join(', ')}. Consider providing additional resources in these areas.`]
        : ['No specific patterns detected yet. Continue tutoring sessions for more insights.'],
    };
  }

  async uploadFile(
    file: Express.Multer.File,
    sessionId?: string,
    studentId?: string,
    schoolId?: string,
  ): Promise<{
    url: string;
    secureUrl: string;
    publicId: string;
    fileName: string;
    mimeType: string;
    size: number;
  }> {
    const folder = FOLDERS.aiContent;
    const result = await this.cloudinary.upload(file, folder);
    return {
      url: result.url,
      secureUrl: result.secureUrl,
      publicId: result.publicId,
      fileName: file.originalname,
      mimeType: result.mimeType,
      size: result.size,
    };
  }

  async checkHealth(): Promise<{ status: string; openai: boolean; model: string; testResponse?: string; error?: string }> {
    if (!this.openai) {
      return { status: 'fallback', openai: false, model: 'none', error: 'OPENAI_API_KEY not configured' };
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a health check endpoint. Reply with exactly: "OK" followed by today\'s date.' },
          { role: 'user', content: 'Confirm you are working.' },
        ],
        max_tokens: 50,
        temperature: 0,
      });

      const content = response.choices[0]?.message?.content || '(empty)';
      return {
        status: 'active',
        openai: true,
        model: 'gpt-4o-mini',
        testResponse: content,
      };
    } catch (error) {
      return {
        status: 'error',
        openai: true,
        model: 'gpt-4o-mini',
        error: `${(error as any)?.message || error}`,
      };
    }
  }

  private async buildFullContext(schoolId: string, partial?: Partial<AiContext>): Promise<AiContext> {
    const context: AiContext = {
      role: partial?.role || 'student',
      subject: partial?.subject,
      subjectId: partial?.subjectId,
      topic: partial?.topic,
      screen: partial?.screen,
      message: partial?.message,
      previousMessages: partial?.previousMessages,
    };

    if (partial?.studentId) {
      const studentCtx = await this.aiContext.getStudentContext(partial.studentId, schoolId);
      if (studentCtx) {
        context.name = studentCtx.name;
        context.grade = studentCtx.grade;
        context.className = studentCtx.className;
        context.currentPerformance = studentCtx.currentPerformance;
        context.attendance = studentCtx.attendance;
        context.recentResults = studentCtx.recentResults;
        context.competency = studentCtx.competency;
        context.growth = studentCtx.growth;
      }
    }

    if (partial?.role === 'teacher' || partial?.role === 'class_teacher') {
      const teacherCtx = await this.aiContext.getTeacherContext(partial.userId || '', schoolId);
      if (teacherCtx) {
        context.name = partial?.name;
        context.classPerformance = teacherCtx.classes;
      }
    }

    if (partial?.role === 'director') {
      const directorCtx = await this.aiContext.getDirectorContext(schoolId);
      if (directorCtx) {
        context.schoolStats = directorCtx.schoolStats;
        context.classPerformance = directorCtx.classPerformance;
        context.className = directorCtx.currentTerm || undefined;
      }
    }

    if (partial?.role === 'parent') {
      const parentCtx = await this.aiContext.getParentContext(partial.userId || '', schoolId);
      if (parentCtx) {
        context.children = parentCtx.children;
      }
    }

    // Fetch curriculum context when subjectId is available
    const subjectId = partial?.subjectId || context.subjectId;
    if (subjectId && schoolId) {
      try {
        context.curriculumContext = await this.fetchCurriculumContext(schoolId, subjectId, partial?.topic);
        // Resolve subject name from the database so it can be used for math detection
        // Always prefer the resolved DB name over a raw UUID that may have been
        // set from session.subjectId
        if (context.curriculumContext?.subjectName) {
          context.subject = context.curriculumContext.subjectName;
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch curriculum context for subject ${subjectId}: ${err}`);
      }

      // Check if this subject is a component of a composite subject
      try {
        const composites = await this.prisma.compositeSubject.findMany({
          where: {
            isActive: true,
            components: { some: { subjectId } },
          },
          include: { components: { include: { subject: true } } },
        });

        if (composites.length > 0) {
          const composite = composites[0];
          const studentId = partial?.studentId || context.studentId;
          const term = studentId
            ? await this.prisma.term.findFirst({
                where: { schoolId, isCurrent: true },
                orderBy: { startDate: 'desc' },
              })
            : null;

          const components = [];
          for (const component of composite.components) {
            let percentage: number | null = null;
            if (studentId && term) {
              const computed = await this.prisma.computedResult.findUnique({
                where: {
                  studentId_subjectId_termId: {
                    studentId,
                    subjectId: component.subjectId,
                    termId: term.id,
                  },
                },
              }).catch(() => null);
              percentage = computed?.finalPercentage ?? null;
            }
            components.push({
              subjectName: component.subject.name,
              percentage,
              weight: component.weight,
            });
          }

          context.compositeContext = {
            isComposite: true,
            compositeName: composite.name,
            components,
          };
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch composite context: ${err}`);
      }
    }

    return context;
  }

  private async fetchCurriculumContext(schoolId: string, subjectId: string, topicId?: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        topics: {
          include: { subtopics: true, competencies: true, learningOutcomes: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!subject) return null;

    const eocs = await this.prisma.elementOfConstruct.findMany({
      where: { subjectId },
      include: { competencies: true },
      orderBy: { sortOrder: 'asc' },
    });

    const assessmentObjectives = await this.prisma.assessmentObjective.findMany({
      where: { subjectId },
    });

    let currentTopic = null;
    if (topicId) {
      currentTopic = await this.prisma.topic.findUnique({
        where: { id: topicId },
        include: { subtopics: true, competencies: true, learningOutcomes: true },
      });
    }

    return {
      subjectName: subject.name,
      subjectCode: subject.code || '',
      elementsOfConstruct: eocs.map(e => ({
        name: e.name,
        competencies: e.competencies.map(c => c.name),
      })),
      assessmentObjectives: assessmentObjectives.map(a => ({ name: a.name, weight: a.weight })),
      topics: subject.topics.map(t => ({
        name: t.name,
        subtopics: t.subtopics.map(s => s.name),
        competencies: t.competencies.map(c => c.name),
        outcomes: t.learningOutcomes.map(o => o.name),
      })),
      currentTopic: currentTopic ? {
        name: currentTopic.name,
        subtopics: currentTopic.subtopics.map(s => ({ name: s.name, description: s.description })),
        competencies: currentTopic.competencies.map(c => ({ name: c.name, description: c.description, bloomLevel: c.bloomLevel })),
        outcomes: currentTopic.learningOutcomes.map(o => ({ name: o.name, bloomLevel: o.bloomLevel })),
      } : null,
    };
  }

  private async generateLLMResponse(context: AiContext): Promise<string> {
    if (!this.openai) {
      return this.fallbackResponse(context);
    }

    try {
      const subject = context.subject || this.subjectEngine.detectSubjectFromQuery(context.message || '');
      const subjectPrompt = this.subjectEngine.getSystemPromptForSubject(subject);
      const rolePrompt = buildSystemPrompt(context);
      const structuredSubjects = ['mathematics', 'math', 'science', 'physics', 'chemistry', 'biology',
        'english', 'language', 'literature', 'history', 'geography', 'civic', 'religious',
        'ict', 'agriculture', 'social studies', 'humanities',
      ];
      const isMathOrScience = subject && (
        structuredSubjects.some(s => subject.toLowerCase().includes(s)) ||
        this.subjectEngine.getEngineForSubject(subject)
      );
      const systemPrompt = subjectPrompt
        ? `${rolePrompt}\n\n=== SUBJECT-SPECIFIC INSTRUCTIONS ===\n${subjectPrompt}\n\nRemember: You are teaching ${subject}. Follow the subject-specific methodology above while also adapting to the user's role and context.`
        : rolePrompt;

      const preprocessedQuery = await this.subjectEngine.preprocessQuery(subject, context.message || '', context);
      const userPrompt = buildUserPrompt({ ...context, message: preprocessedQuery });

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...(context.previousMessages?.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[]) || [],
        { role: 'user', content: userPrompt },
      ];

      const completionOptions: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 4096,
        temperature: 0.7,
      };

      // Use JSON response format for math/science to get structured data
      if (isMathOrScience) {
        completionOptions.response_format = { type: 'json_object' };
      }

      const response = await this.openai.chat.completions.create(completionOptions);

      const content = response.choices[0]?.message?.content;
      const finishReason = response.choices[0]?.finish_reason;
      if (content) {
        this.logger.log(`OpenAI response OK (${content.length} chars, finish_reason: ${finishReason})`);
        // For math/science, try to parse as JSON and store both raw and structured
        if (isMathOrScience) {
          try {
            const parsed = JSON.parse(content);
            // Return the structured JSON string - frontend will parse it
            return content;
          } catch {
            // If JSON parsing fails, return content as-is (fallback)
            this.logger.warn('Failed to parse structured JSON from math response, using raw text');
            return content;
          }
        }
        return content;
      }
      this.logger.warn(`OpenAI returned empty content (finish_reason: ${finishReason})`);
      return this.fallbackResponse(context);
    } catch (error) {
      this.logger.error(`OpenAI API error [${(error as any)?.status || 'unknown'}]: ${(error as any)?.message || error}`);
      if ((error as any)?.response?.data) {
        this.logger.error(`OpenAI error details: ${JSON.stringify((error as any).response.data)}`);
      }
      return this.fallbackResponse(context);
    }
  }

  private async generateGreeting(context: AiContext, options?: { subjectId?: string; topic?: string }): Promise<string> {
    if (this.openai) {
      try {
        const systemPrompt = buildSystemPrompt(context);
        const introPrompt = `Generate a warm, personalized greeting for a ${context.role}${options?.topic ? ` who wants to learn about ${options.topic}` : ''}${options?.subjectId ? ` in ${context.subject || 'this subject'}` : ''}. Be specific and reference their performance context. Keep it under 3 sentences.`;

        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: introPrompt },
          ],
          max_tokens: 300,
          temperature: 0.8,
        });

        return response.choices[0]?.message?.content || this.staticGreeting(options?.topic, options?.subjectId);
      } catch {
        return this.staticGreeting(options?.topic, options?.subjectId);
      }
    }
    return this.staticGreeting(options?.topic, options?.subjectId);
  }

  private staticGreeting(topic?: string, subjectId?: string): string {
    if (topic && subjectId) {
      return `Hello! I'm your AI tutor. Let's explore ${topic} together. What would you like to learn about this topic?`;
    }
    if (subjectId) {
      return `Hi there! I'm your AI tutor. I see you're studying this subject. What topic would you like help with?`;
    }
    return `Welcome! I'm your AI tutor. I can help you understand concepts, solve problems, and practice for exams. What would you like to learn today?`;
  }

  private fallbackResponse(context: AiContext): string {
    const message = context.message || '';
    const lower = message.toLowerCase();
    const weakAreas = context.currentPerformance?.weakAreas;
    const subject = context.subject || 'this subject';
    const name_ = context.name ? ` ${context.name.split(' ')[0]}` : '';

    // Extract the actual topic/question content
    const topicMatch = message.match(/(?:explain|what is|how does|why does|define|tell me about|what are|what's|describe)\s+(.+?)(?:\?|$)/i);
    const topic = topicMatch ? topicMatch[1].trim() : '';

    // Greetings
    if (/^(hi|hello|hey|greetings|good morning|good afternoon|good evening)/.test(lower)) {
      const focusHint = weakAreas?.length
        ? ` I noticed we should focus on ${weakAreas.slice(0, 2).join(' and ')}.`
        : '';
      return `Hello${name_}!${focusHint} What would you like to learn about today?`;
    }

    // Questions with a clear topic — respond with actual content
    if (topic) {
      const curriculumRef = context.curriculumContext?.currentTopic
        ? ` This is covered under "${context.curriculumContext.currentTopic.name}".`
        : '';
      const perfNote = context.currentPerformance?.average != null && context.currentPerformance.average < 50
        ? ` Since you're working on improving, let me explain this clearly.`
        : '';
      return `Great question about **${topic}**!${perfNote}${curriculumRef}\n\n**Overview**: ${topic} is an important concept in ${subject}. To understand it well, focus on:\n\n1. **Core idea** — What ${topic} means and why it matters\n2. **Key principles** — The main rules or components that define it\n3. **Real-world examples** — How it applies in practice\n4. **Common connections** — How it relates to other topics you've studied\n\nWould you like me to go deeper into any specific aspect of ${topic}, or would you like a practice question to test your understanding?`;
    }

    // Help/struggling
    if (/help|struggling|confused|don't understand|difficult/.test(lower)) {
      const specificHint = weakAreas?.length
        ? ` I see ${weakAreas.slice(0, 2).join(' and ')} have been challenging based on your results.`
        : '';
      return `I'm here to help${name_}!${specificHint} Tell me specifically which concept or problem you're working on, and I'll break it down step by step.`;
    }

    // Practice/exercise requests
    if (/practice|exercise|problem|question|test me|quiz/.test(lower)) {
      const focusArea = weakAreas?.length ? weakAreas[0] : (topic || subject);
      return `Let's practice **${focusArea}**!\n\n**Try this**: Explain ${focusArea} in your own words and give an example.\n\nAfter you respond, I'll give you feedback and a follow-up question. Ready?`;
    }

    // Encouragement/motivation
    if (/tired|bored|demotivated|give up|hard|frustrated/.test(lower)) {
      const avg = context.currentPerformance?.average;
      if (avg != null && avg >= 50) {
        return `You're actually doing well — your average is ${avg}%!${name_} Keep going, you've got this. Let's break down what you're working on into small steps. What's the first thing we can tackle?`;
      }
      return `Every expert was once a beginner${name_}. Let's take it step by step. Pick one small concept or problem and we'll work through it together. What would you like to start with?`;
    }

    // Performance-based guidance
    if (weakAreas?.length && context.currentPerformance?.average != null && context.currentPerformance.average < 50) {
      return `Let's work on improving **${weakAreas.slice(0, 2).join(' and ')}**. Your current average is ${context.currentPerformance.average}%. Would you like me to:\n\n1. Explain a concept from ${weakAreas[0]}?\n2. Give you a practice problem?\n3. Create a simple study plan?`;
    }

    // Generic — extract any noun-like words from the message
    const words = message.split(/\s+/).filter(w => w.length > 4);
    const possibleTopic = words.length > 0 ? words.slice(0, 3).join(' ') : 'this';
    return `I understand you're asking about **${possibleTopic}** in ${subject}.\n\nHere's my guidance:\n\n1. **Start with the basics** — Make sure you understand the fundamental concepts\n2. **Practice actively** — Work through examples step by step\n3. **Review regularly** — Revisit topics to reinforce learning\n\nWhat specific aspect would you like me to explain further? I can break it down for you.`;
  }

  private extractKeywords(messages: string[]): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'my', 'your', 'this', 'that', 'these', 'those',
      'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about',
      'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off',
      'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
      'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
      'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'because', 'as',
      'until', 'while', 'if', 'can', 'get', 'got', 'like', 'know', 'think', 'want', 'need']);

    const words = messages
      .join(' ')
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));

    const freq = new Map<string, number>();
    for (const w of words) {
      freq.set(w, (freq.get(w) || 0) + 1);
    }

    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([w]) => w);
  }
}
