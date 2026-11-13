import { ExamAuthoringService } from './exam-authoring.service';
import { ExamValidationSeverity } from '@prisma/client';

describe('ExamAuthoringService', () => {
  it('rejects blueprints whose section marks do not equal the examination total', () => {
    const service = new ExamAuthoringService({} as any);
    const findings = service.validateBlueprint({
      totalMarks: 100,
      durationMinutes: 150,
      sections: [{ code: 'A', title: 'Section A', totalMarks: 80, itemCount: 4, answerRule: 'ALL' }],
    });

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'BLUEPRINT_MARK_TOTAL_MISMATCH', severity: ExamValidationSeverity.ERROR }),
    ]));
  });

  it('accepts the Mathematics I pilot structure', () => {
    const service = new ExamAuthoringService({} as any);
    const findings = service.validateBlueprint({
      totalMarks: 100,
      durationMinutes: 150,
      sections: [
        { code: 'A', title: 'Section A', totalMarks: 80, itemCount: 4, answerRule: 'ALL' },
        { code: 'B', title: 'Section B', totalMarks: 20, itemCount: 2, answerRule: 'ONE' },
      ],
    });

    expect(findings.filter(finding => finding.severity === ExamValidationSeverity.ERROR)).toHaveLength(0);
  });

  it('rejects a topic plan whose marks do not cover the advertised paper', () => {
    const service = new ExamAuthoringService({} as any);
    const findings = service.validateBlueprint({
      totalMarks: 100,
      durationMinutes: 150,
      sections: [{ code: 'A', title: 'Section A', totalMarks: 100, itemCount: 5, answerRule: 'ALL' }],
      topicPlan: [{ topic: 'Algebra', marks: 40 }, { topic: 'Geometry', marks: 20 }],
    });
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'BLUEPRINT_TOPIC_MARK_MISMATCH', severity: ExamValidationSeverity.ERROR }),
    ]));
  });
});
