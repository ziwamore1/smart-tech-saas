export interface WizardValidationState {
  subjects: any[];
  classes: any[];
  classrooms: any[];
  teachers: any[];
  lessons: any[];
  settings: any;
}

export function validateWizard(state: WizardValidationState): string[] {
  const errors: string[] = [];

  if (state.subjects.length === 0) {
    errors.push("No subjects added");
  }

  if (state.classes.length === 0) {
    errors.push("No classes added");
  }

  if (state.classrooms.length === 0) {
    errors.push("No classrooms added");
  }

  if (state.teachers.length === 0) {
    errors.push("No teachers selected");
  }

  if (!state.settings?.periodsPerDay || state.settings.periodsPerDay < 1) {
    errors.push("Invalid periods per day");
  }

  if (!state.settings?.daysPerWeek || state.settings.daysPerWeek < 1) {
    errors.push("Invalid days per week");
  }

  return errors;
}

export function validateStep(step: string, state: WizardValidationState): string[] {
  switch (step) {
    case "subjects":
      return state.subjects.length === 0 ? ["Add at least one subject to continue"] : [];
    case "classes":
      return state.classes.length === 0 ? ["Add at least one class to continue"] : [];
    case "classrooms":
      return state.classrooms.length === 0 ? ["Add at least one classroom to continue"] : [];
    case "teachers":
      return state.teachers.length === 0 ? ["Select at least one teacher to continue"] : [];
    case "lessons":
      const errors: string[] = [];
      if (state.lessons.length === 0) {
        errors.push("Add at least one lesson to continue");
      }
      for (const lesson of state.lessons) {
        if (!lesson.teacherId) {
          errors.push(`Lesson for class ${lesson.classId} has no teacher assigned`);
        }
        if (!lesson.subjectId) {
          errors.push(`Lesson for class ${lesson.classId} has no subject assigned`);
        }
        if (!lesson.lessonsPerWeek || lesson.lessonsPerWeek < 1) {
          errors.push(`Lesson for class ${lesson.classId} must have at least 1 period per week`);
        }
      }
      return errors;
    case "end":
      return validateWizard(state);
    default:
      return [];
  }
}
