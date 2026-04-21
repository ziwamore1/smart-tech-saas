import { TimeSlot } from './Class';

export interface SubjectModel {
  id: string;
  name: string;
  code: string;
  requiresLab: boolean;
  doublePeriod: boolean;
  preferredPeriods: TimeSlot[];
  minDaysBetween: number;
}

export interface SubjectRegistry {
  get(id: string): SubjectModel | undefined;
  getAll(): SubjectModel[];
  add(subject: SubjectModel): void;
  getIdsByTeacher(teacherId: string): string[];
}

export function createSubjectRegistry(): SubjectRegistry {
  const subjects = new Map<string, SubjectModel>();

  return {
    get(id: string) {
      return subjects.get(id);
    },
    getAll() {
      return Array.from(subjects.values());
    },
    add(subject: SubjectModel) {
      subjects.set(subject.id, {
        ...subject,
        requiresLab: subject.requiresLab ?? false,
        doublePeriod: subject.doublePeriod ?? false,
        preferredPeriods: subject.preferredPeriods ?? [],
        minDaysBetween: subject.minDaysBetween ?? 1,
      });
    },
    getIdsByTeacher(teacherId: string) {
      return [];
    },
  };
}