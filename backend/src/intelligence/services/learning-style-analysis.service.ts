import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LearningStyleAnalysisService {
  constructor(private prisma: PrismaService) {}

  async assessStudent(studentId: string, schoolId: string, responses: {
    visual: number; aural: number; readWrite: number; kinesthetic: number;
  }) {
    const total = responses.visual + responses.aural + responses.readWrite + responses.kinesthetic;
    if (total === 0) return { error: 'All scores cannot be zero' };

    const normalized = {
      visual: Number(((responses.visual / total) * 100).toFixed(2)),
      aural: Number(((responses.aural / total) * 100).toFixed(2)),
      readWrite: Number(((responses.readWrite / total) * 100).toFixed(2)),
      kinesthetic: Number(((responses.kinesthetic / total) * 100).toFixed(2)),
    };

    const maxScore = Math.max(normalized.visual, normalized.aural, normalized.readWrite, normalized.kinesthetic);
    const styles: string[] = [];
    if (normalized.visual === maxScore) styles.push('VISUAL');
    if (normalized.aural === maxScore) styles.push('AURAL');
    if (normalized.readWrite === maxScore) styles.push('READ_WRITE');
    if (normalized.kinesthetic === maxScore) styles.push('KINESTHETIC');

    const dominantStyle = styles[0];

    const profile = await this.prisma.learningStyleProfile.upsert({
      where: { studentId },
      update: {
        visualScore: normalized.visual,
        auralScore: normalized.aural,
        readWriteScore: normalized.readWrite,
        kinestheticScore: normalized.kinesthetic,
        dominantStyle,
        lastAssessed: new Date(),
      },
      create: {
        studentId,
        schoolId,
        visualScore: normalized.visual,
        auralScore: normalized.aural,
        readWriteScore: normalized.readWrite,
        kinestheticScore: normalized.kinesthetic,
        dominantStyle,
        lastAssessed: new Date(),
      },
    });

    return {
      profile,
      dominantStyle,
      scores: normalized,
      multimodal: styles.length > 1,
      recommendations: this.getLearningRecommendations(dominantStyle, normalized),
    };
  }

  async getStudentProfile(studentId: string, schoolId: string) {
    const profile = await this.prisma.learningStyleProfile.findUnique({
      where: { studentId },
    });

    if (!profile || profile.schoolId !== schoolId) {
      return { error: 'Profile not found. Complete the VARK assessment first.' };
    }

    return {
      studentId,
      dominantStyle: profile.dominantStyle,
      scores: {
        visual: profile.visualScore,
        aural: profile.auralScore,
        readWrite: profile.readWriteScore,
        kinesthetic: profile.kinestheticScore,
      },
      interpretation: this.interpretStyle(profile.dominantStyle),
      studyStrategies: this.getStudyStrategies(profile.dominantStyle),
      teachingStrategies: this.getTeachingStrategies(profile.dominantStyle),
      recommendations: this.getLearningRecommendations(profile.dominantStyle, {
        visual: profile.visualScore,
        aural: profile.auralScore,
        readWrite: profile.readWriteScore,
        kinesthetic: profile.kinestheticScore,
      }),
    };
  }

  async getClassStyleDistribution(schoolId: string, classId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      select: { studentId: true },
    });

    const profiles = await this.prisma.learningStyleProfile.findMany({
      where: {
        studentId: { in: enrollments.map(e => e.studentId) },
        schoolId,
      },
    });

    if (!profiles.length) return { error: 'No learning style profiles found for this class' };

    const distribution: Record<string, number> = {};
    for (const p of profiles) {
      const style = p.dominantStyle || 'UNKNOWN';
      distribution[style] = (distribution[style] || 0) + 1;
    }

    const total = profiles.length;
    return {
      classId,
      totalStudents: total,
      distribution: Object.entries(distribution).map(([style, count]) => ({
        style,
        count,
        percentage: Number(((count / total) * 100).toFixed(2)),
      })),
      dominantStyle: Object.entries(distribution).sort((a, b) => b[1] - a[1])[0]?.[0] || 'NONE',
      teachingRecommendation: this.getClassTeachingRecommendation(
        Object.entries(distribution).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
      ),
    };
  }

  async getSubjectStyleFit(schoolId: string, subjectId: string) {
    const subject = await this.prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) return { error: 'Subject not found' };

    const recommended = this.getSubjectRecommendedStyle(subject.name);

    return {
      subject: subject.name,
      recommendedStyle: recommended.style,
      reasoning: recommended.reasoning,
      teachingApproach: recommended.approach,
    };
  }

  private interpretStyle(style: string | null): string {
    switch (style) {
      case 'VISUAL':
        return 'You learn best by seeing and observing. You prefer diagrams, charts, mind maps, and visual demonstrations.';
      case 'AURAL':
        return 'You learn best by listening and speaking. You prefer lectures, discussions, verbal explanations, and group conversations.';
      case 'READ_WRITE':
        return 'You learn best by reading and writing. You prefer textbooks, notes, lists, and written explanations.';
      case 'KINESTHETIC':
        return 'You learn best by doing and experiencing. You prefer hands-on activities, experiments, and real-world examples.';
      default:
        return 'No dominant learning style identified. You may be a multimodal learner.';
    }
  }

  private getStudyStrategies(style: string | null): string[] {
    const strategies: Record<string, string[]> = {
      VISUAL: [
        'Use mind maps and concept diagrams',
        'Color-code your notes and materials',
        'Watch video demonstrations and tutorials',
        'Create charts and graphs to represent information',
        'Use flashcards with images and diagrams',
      ],
      AURAL: [
        'Record lectures and listen again',
        'Participate in group discussions',
        'Explain concepts to study partners',
        'Use verbal repetition and mnemonics',
        'Listen to educational podcasts and audio',
      ],
      READ_WRITE: [
        'Rewrite notes in your own words',
        'Create detailed summaries and outlines',
        'Read textbooks and supplementary materials',
        'Write practice questions and answers',
        'Use lists and bullet points for organization',
      ],
      KINESTHETIC: [
        'Use hands-on experiments and activities',
        'Take frequent breaks to move around',
        'Study in short bursts with physical activity',
        'Build models or use manipulatives',
        'Apply concepts to real-world situations',
      ],
    };

    return strategies[style || 'READ_WRITE'] || strategies['READ_WRITE'];
  }

  private getTeachingStrategies(style: string | null): string[] {
    const strategies: Record<string, string[]> = {
      VISUAL: [
        'Use diagrams, charts, and infographics in lessons',
        'Provide visual handouts and slide presentations',
        'Incorporate video and multimedia content',
        'Use color coding and visual organization',
        'Include graphic organizers and mind maps',
      ],
      AURAL: [
        'Incorporate group discussions and debates',
        'Use verbal explanations with examples',
        'Allow audio recording of lessons',
        'Include oral presentations and Q&A sessions',
        'Use rhymes, rhythms, and verbal repetition',
      ],
      READ_WRITE: [
        'Provide written instructions and handouts',
        'Assign reading and writing tasks',
        'Use textbooks and reference materials',
        'Include list-making and note-taking activities',
        'Provide written feedback on assignments',
      ],
      KINESTHETIC: [
        'Include hands-on experiments and activities',
        'Use role-playing and simulations',
        'Incorporate movement and physical activities',
        'Provide real-world application examples',
        'Allow manipulative use during learning',
      ],
    };

    return strategies[style || 'READ_WRITE'] || strategies['READ_WRITE'];
  }

  private getLearningRecommendations(style: string, scores: Record<string, number>): string[] {
    const recs: string[] = [];
    recs.push(`Primary learning style: ${style}. ${this.interpretStyle(style)}`);

    const secondHighest = Object.entries(scores)
      .filter(([k]) => k !== style.toLowerCase())
      .sort(([, a], [, b]) => b - a)[0];

    if (secondHighest && secondHighest[1] > 25) {
      recs.push(`Secondary strength in ${secondHighest[0].toUpperCase()}. Use ${secondHighest[0]} strategies to reinforce learning.`);
    }

    return recs;
  }

  private getClassTeachingRecommendation(dominantStyle: string): string {
    switch (dominantStyle) {
      case 'VISUAL': return 'Incorporate more visual aids, diagrams, and multimedia presentations for this class.';
      case 'AURAL': return 'Include more group discussions, verbal explanations, and audio materials.';
      case 'READ_WRITE': return 'Provide written materials, reading assignments, and note-taking opportunities.';
      case 'KINESTHETIC': return 'Include hands-on activities, experiments, and movement-based learning.';
      default: return 'Use a balanced multimodal teaching approach.';
    }
  }

  private getSubjectRecommendedStyle(subjectName: string): { style: string; reasoning: string; approach: string } {
    const subjectLower = subjectName.toLowerCase();

    if (['mathematics', 'physics', 'chemistry', 'geometry'].some(s => subjectLower.includes(s))) {
      return {
        style: 'VISUAL',
        reasoning: 'Mathematical and scientific concepts are often represented visually through graphs, formulas, and diagrams.',
        approach: 'Use visual problem-solving, graphs, and step-by-step diagrams.',
      };
    }

    if (['english', 'literature', 'history', 'social studies'].some(s => subjectLower.includes(s))) {
      return {
        style: 'READ_WRITE',
        reasoning: 'Humanities subjects emphasize reading texts, writing essays, and analyzing written content.',
        approach: 'Focus on reading comprehension, written analysis, and essay writing.',
      };
    }

    if (['music', 'language', 'french'].some(s => subjectLower.includes(s))) {
      return {
        style: 'AURAL',
        reasoning: 'Language and music learning heavily rely on listening and speaking skills.',
        approach: 'Emphasize listening exercises, oral practice, and verbal repetition.',
      };
    }

    if (['physical education', 'art', 'design', 'technology'].some(s => subjectLower.includes(s))) {
      return {
        style: 'KINESTHETIC',
        reasoning: 'Practical subjects require hands-on engagement and physical activity.',
        approach: 'Prioritize hands-on projects, practical exercises, and real-world application.',
      };
    }

    return {
      style: 'READ_WRITE',
      reasoning: 'This subject benefits from structured reading and note-taking approaches.',
      approach: 'Balance between written materials and practical application.',
    };
  }
}
