import {
  checkEczEligibility,
  detectEczGradingSystem,
  gradeForScore,
  scoreToEczGrade,
  ECZ_MAX_BEST_SIX_POINTS,
  ECZ_WORST_GRADE,
} from './ecz-eligibility.util';

describe('ecz-eligibility util', () => {
  describe('scoreToEczGrade (9-point secondary)', () => {
    it('maps 9-point secondary bands', () => {
      expect(scoreToEczGrade(100).points).toBe(1);
      expect(scoreToEczGrade(75).points).toBe(1);
      expect(scoreToEczGrade(74).points).toBe(2);
      expect(scoreToEczGrade(70).points).toBe(2);
      expect(scoreToEczGrade(69).points).toBe(3);
      expect(scoreToEczGrade(65).points).toBe(3);
      expect(scoreToEczGrade(64).points).toBe(4);
      expect(scoreToEczGrade(60).points).toBe(4);
      expect(scoreToEczGrade(59).points).toBe(5);
      expect(scoreToEczGrade(55).points).toBe(5);
      expect(scoreToEczGrade(54).points).toBe(6);
      expect(scoreToEczGrade(50).points).toBe(6);
      expect(scoreToEczGrade(49).points).toBe(7);
      expect(scoreToEczGrade(45).points).toBe(7);
      expect(scoreToEczGrade(44).points).toBe(8);
      expect(scoreToEczGrade(40).points).toBe(8);
      expect(scoreToEczGrade(39).points).toBe(9);
      expect(scoreToEczGrade(0).points).toBe(9);
    });
  });

  describe('gradeForScore', () => {
    it('maps Forms 5-point bands', () => {
      expect(gradeForScore(72, 'FORMS')).toEqual({ grade: '1', points: 1, remark: 'Star' });
      expect(gradeForScore(70, 'FORMS')).toEqual({ grade: '1', points: 1, remark: 'Star' });
      expect(gradeForScore(69, 'FORMS').points).toBe(2);
      expect(gradeForScore(60, 'FORMS').points).toBe(2);
      expect(gradeForScore(59, 'FORMS').points).toBe(3);
      expect(gradeForScore(50, 'FORMS').points).toBe(3);
      expect(gradeForScore(49, 'FORMS').points).toBe(4);
      expect(gradeForScore(40, 'FORMS').points).toBe(4);
      expect(gradeForScore(39, 'FORMS').points).toBe(5);
      expect(gradeForScore(0, 'FORMS').points).toBe(5);
    });

    it('maps secondary 9-point via score', () => {
      expect(gradeForScore(76, 'SECONDARY').points).toBe(1);
      expect(gradeForScore(56, 'SECONDARY').points).toBe(5);
      expect(gradeForScore(41, 'SECONDARY').points).toBe(8);
      expect(gradeForScore(35, 'SECONDARY').points).toBe(9);
    });
  });

  describe('detectEczGradingSystem', () => {
    it('detects Forms 1-4', () => {
      expect(detectEczGradingSystem('Form 1A')).toBe('FORMS');
      expect(detectEczGradingSystem('Form 2')).toBe('FORMS');
      expect(detectEczGradingSystem('Form 3 North')).toBe('FORMS');
      expect(detectEczGradingSystem('Form 4')).toBe('FORMS');
      expect(detectEczGradingSystem('form 1a')).toBe('FORMS');
      expect(detectEczGradingSystem('F1A')).toBe('FORMS');
      expect(detectEczGradingSystem('F2')).toBe('FORMS');
    });

    it('does not treat grade 10-12 or Form 5-6 as Forms', () => {
      expect(detectEczGradingSystem('Grade 10')).toBe('SECONDARY');
      expect(detectEczGradingSystem('Grade 11')).toBe('SECONDARY');
      expect(detectEczGradingSystem('Grade 12')).toBe('SECONDARY');
      expect(detectEczGradingSystem('Grade 10A')).toBe('SECONDARY');
      expect(detectEczGradingSystem('Form 5')).toBe('SECONDARY');
      expect(detectEczGradingSystem('Form 6')).toBe('SECONDARY');
      expect(detectEczGradingSystem('Form 10')).toBe('SECONDARY');
      expect(detectEczGradingSystem('')).toBe('SECONDARY');
      expect(detectEczGradingSystem('Primary 7')).toBe('SECONDARY');
    });
  });

  describe('checkEczEligibility — Forms (5-point)', () => {
    const formsSubjects = (overrides: Record<string, number>) => {
      const base: Record<string, number> = {
        English: 72,
        'Mathematics I': 65,
        'Integrated Science': 55,
        'Social Studies': 52,
        'Religious Education': 50,
        'Expressive Arts': 59,
        'Business Studies': 35,
      };
      return Object.entries({ ...base, ...overrides }).map(([name, score]) => ({ name, score }));
    };

    it('marks a strong Forms student UNIVERSITY', () => {
      const subjects = formsSubjects({}).slice(0, 6); // 6 subjects, English 1, Math I 2
      const r = checkEczEligibility(subjects, 'FORMS');
      expect(r.status).toBe('UNIVERSITY');
      expect(r.universityEligible).toBe(true);
      expect(r.certificateAwarded).toBe(true);
      expect(r.bestSix.length).toBe(6);
      expect(r.bestSixTotal).toBeLessThanOrEqual(30);
      expect(r.englishPassed).toBe(true);
      expect(r.mathPassed).toBe(true);
    });

    it('flags a Forms grade-5 (0-39%) as NOT eligible', () => {
      // BONGANI-style: English grade 5 -> no certificate, no university
      const subjects = formsSubjects({ English: 32 });
      const r = checkEczEligibility(subjects, 'FORMS');
      expect(r.status).toBe('NONE');
      expect(r.universityEligible).toBe(false);
      expect(r.certificateAwarded).toBe(false);
      expect(r.hasFailingSubject).toBe(true);
      expect(r.failingSubjects).toContain('English');
      expect(r.bestSix.some((s) => s.points === 5)).toBe(true);
    });

    it('applies the Forms max of 30 points for all grade-5 subjects', () => {
      const r = checkEczEligibility(
        ['English', 'Mathematics I', 'Science', 'History', 'Geography', 'Civics'].map((name) => ({
          name,
          score: 20,
        })),
        'FORMS',
      );
      expect(r.bestSixTotal).toBe(30);
      expect(r.bestSixTotal).toBe(ECZ_MAX_BEST_SIX_POINTS.FORMS);
    });

    it('treats 0% / missing grade as worst grade (forms fail)', () => {
      const r = checkEczEligibility(
        [
          { name: 'English', grade: '-' as any, points: null as any },
          { name: 'Mathematics I', score: 0 },
          { name: 'Science', score: 55 },
          { name: 'History', score: 62 },
          { name: 'Geography', score: 48 },
          { name: 'Civics', score: 0 },
        ],
        'FORMS',
      );
      expect(r.status).toBe('NONE');
      expect(r.bestSix.every((s) => s.points <= 5)).toBe(true);
      expect(r.bestSix.some((s) => s.points === 5)).toBe(true);
    });

    it('awards CERTIFICATE when best 6 all grades 1-4 but not university', () => {
      const r = checkEczEligibility(
        [
          { name: 'English', score: 55 },
          { name: 'Mathematics I', score: 58 },
          { name: 'Integrated Science', score: 50 },
          { name: 'Social Studies', score: 52 },
          { name: 'Religious Education', score: 48 },
          { name: 'Expressive Arts', score: 45 },
        ],
        'FORMS',
      );
      expect(r.status).toBe('CERTIFICATE');
      expect(r.universityEligible).toBe(false);
      expect(r.certificateAwarded).toBe(true);
    });

    it('requires English and Mathematics for university on Forms', () => {
      const subjects = formsSubjects({ 'Mathematics I': 30 });
      const r = checkEczEligibility(subjects.slice(0, 6), 'FORMS');
      expect(r.universityEligible).toBe(false);
      expect(r.mathPassed).toBe(false);
      if (r.mathSubject) expect(r.mathSubject.points).toBeGreaterThan(ECZ_WORST_GRADE.FORMS === 5 ? 3 : 6);
    });

    it('requires at least 6 subjects', () => {
      const r = checkEczEligibility(
        [
          { name: 'English', score: 80 },
          { name: 'Mathematics I', score: 80 },
          { name: 'Science', score: 80 },
          { name: 'History', score: 80 },
          { name: 'Geography', score: 80 },
        ],
        'FORMS',
      );
      expect(r.status).toBe('NONE');
      expect(r.details).toContain('Minimum 6');
    });
  });

  describe('checkEczEligibility — Secondary (9-point)', () => {
    const secondarySubjects = (overrides: Record<string, number>) => {
      const base: Record<string, number> = {
        English: 78,
        Mathematics: 66,
        Physics: 55,
        Chemistry: 50,
        Biology: 60,
        'Computer Studies': 55,
        'Civic Education': 5,
      };
      return Object.entries({ ...base, ...overrides }).map(([name, score]) => ({ name, score }));
    };

    it('marks a strong Grade 12 student UNIVERSITY (best 6 incl English & Math <= 6)', () => {
      const r = checkEczEligibility(secondarySubjects({}).slice(0, 6), 'SECONDARY');
      expect(r.status).toBe('UNIVERSITY');
      expect(r.universityEligible).toBe(true);
      expect(r.bestSixTotal).toBeLessThanOrEqual(54);
    });

    it('flags a 9-point grade-9 fail as NOT eligible', () => {
      const r = checkEczEligibility(secondarySubjects({ English: 30 }), 'SECONDARY');
      expect(r.status).toBe('NONE');
      expect(r.hasFailingSubject).toBe(true);
    });

    it('applies the secondary max of 54 points worst-case', () => {
      const r = checkEczEligibility(
        ['English', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Accounts'].map((name) => ({
          name,
          score: 20,
        })),
        'SECONDARY',
      );
      expect(r.bestSixTotal).toBe(54);
      expect(r.bestSixTotal).toBe(ECZ_MAX_BEST_SIX_POINTS.SECONDARY);
    });

    it('requires English for the School Certificate on secondary', () => {
      const r = checkEczEligibility(
        [
          { name: 'Physics', score: 80 },
          { name: 'Mathematics', score: 80 },
          { name: 'Chemistry', score: 80 },
          { name: 'Biology', score: 80 },
          { name: 'Accounts', score: 80 },
          { name: 'Geography', score: 80 },
        ],
        'SECONDARY',
      );
      expect(r.certificateAwarded).toBe(false);
      expect(r.englishPassed).toBe(false);
    });
  });

  describe('ECZ constants', () => {
    it('exposes expected work/scale maxima', () => {
      expect(ECZ_WORST_GRADE).toEqual({ FORMS: 5, SECONDARY: 9 });
      expect(ECZ_MAX_BEST_SIX_POINTS).toEqual({ FORMS: 30, SECONDARY: 54 });
    });
  });
});