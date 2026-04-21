import { TimeSlot } from './Class';

export interface TeacherModel {
  id: string;
  name: string;
  email: string;
  employeeNo: string;
  subjects: string[];
  maxLessonsPerDay: number;
  maxConsecutiveLessons: number;
  preferredDays: number[];
  unavailableSlots: TimeSlot[];
}

export interface TeacherAvailability {
  teacherId: string;
  availableSlots: TimeSlot[];
}

export interface TeacherRegistry {
  get(id: string): TeacherModel | undefined;
  getAll(): TeacherModel[];
  add(teacher: TeacherModel): void;
  markUnavailable(teacherId: string, slot: TimeSlot): void;
  markAvailable(teacherId: string, slot: TimeSlot): void;
  getUnavailableSlots(teacherId: string): TimeSlot[];
}

export function createTeacherRegistry(): TeacherRegistry {
  const teachers = new Map<string, TeacherModel>();

  return {
    get(id: string) {
      return teachers.get(id);
    },
    getAll() {
      return Array.from(teachers.values());
    },
    add(teacher: TeacherModel) {
      teachers.set(teacher.id, {
        ...teacher,
        maxLessonsPerDay: teacher.maxLessonsPerDay ?? 5,
        maxConsecutiveLessons: teacher.maxConsecutiveLessons ?? 3,
        preferredDays: teacher.preferredDays ?? [1, 2, 3, 4, 5],
        unavailableSlots: teacher.unavailableSlots ?? [],
      });
    },
    markUnavailable(teacherId: string, slot: TimeSlot) {
      const teacher = teachers.get(teacherId);
      if (teacher) {
        if (!teacher.unavailableSlots.some(s => s.day === slot.day && s.period === slot.period)) {
          teacher.unavailableSlots.push(slot);
        }
      }
    },
    markAvailable(teacherId: string, slot: TimeSlot) {
      const teacher = teachers.get(teacherId);
      if (teacher) {
        teacher.unavailableSlots = teacher.unavailableSlots.filter(
          s => !(s.day === slot.day && s.period === slot.period)
        );
      }
    },
    getUnavailableSlots(teacherId: string) {
      const teacher = teachers.get(teacherId);
      return teacher?.unavailableSlots ?? [];
    },
  };
}