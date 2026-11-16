import * as path from 'path';
import { extractStructuredSyllabusRows, syllabusRowCompleteness } from './cbc-syllabus-extractor';

describe('CBC syllabus extractor', () => {
  it('preserves the five syllabus columns and the source competency code', async () => {
    const file = path.resolve(__dirname, '../../CBC_SYLLABI/CAMERA-READY-O-LEVEL-BIOLOGY-SYLABUS-5-02-2024-FINAL-CORRECTED-FOR-PRINTING.pdf');
    const rows = await extractStructuredSyllabusRows(file);
    const row = rows.find(item => item.competencyCode === '1.1.1.1');

    expect(row).toBeDefined();
    expect(row?.conceptCode).toBe('1.1.0');
    expect(row?.subtopicCode).toBe('1.1.1');
    expect(row?.concept).toContain('Concepts and Methods in Biology');
    expect(row?.subtopic).toContain('Nature of Science Inquiry');
    expect(row?.learningActivities.length).toBeGreaterThan(0);
    expect(row?.expectedStandard).toContain('Scientific inquiry');
    expect(syllabusRowCompleteness(row!)).toBe(true);
  }, 120000);
});
