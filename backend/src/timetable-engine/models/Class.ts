export interface ClassModel {
  id: string;
  name: string;
  levelType?: string;
  capacity: number;
  academicYearId: string;
  subjects: string[];
}

export interface ClassConstraint {
  maxLessonsPerDay: number;
  maxConsecutiveLessons: number;
  preferredDays: number[];
  blockedPeriods: TimeSlot[];
}

export interface TimeSlot {
  day: number;
  period: number;
}

export interface ClassRegistry {
  get(id: string): ClassModel | undefined;
  getAll(): ClassModel[];
  add(cls: ClassModel): void;
  getConstraint(classId: string): ClassConstraint | undefined;
  setConstraint(classId: string, constraint: ClassConstraint): void;
}

export function createClassRegistry(): ClassRegistry {
  const classes = new Map<string, ClassModel>();
  const constraints = new Map<string, ClassConstraint>();

  return {
    get(id: string) {
      return classes.get(id);
    },
    getAll() {
      return Array.from(classes.values());
    },
    add(cls: ClassModel) {
      classes.set(cls.id, cls);
      if (!constraints.has(cls.id)) {
        constraints.set(cls.id, {
          maxLessonsPerDay: 6,
          maxConsecutiveLessons: 3,
          preferredDays: [1, 2, 3, 4, 5],
          blockedPeriods: [],
        });
      }
    },
    getConstraint(classId: string) {
      return constraints.get(classId);
    },
    setConstraint(classId: string, constraint: ClassConstraint) {
      constraints.set(classId, constraint);
    },
  };
}