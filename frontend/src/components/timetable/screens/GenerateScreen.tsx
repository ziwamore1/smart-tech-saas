'use client';

interface GenerateScreenProps {
  classCount: number;
  teacherCount: number;
  subjectCount: number;
  lessonCount: number;
  onGenerate: () => void;
  onEdit: () => void;
}

export function GenerateScreen({ 
  classCount, 
  teacherCount, 
  subjectCount, 
  lessonCount, 
  onGenerate,
  onEdit 
}: GenerateScreenProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-sm border p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">📋</div>
          <h1 className="text-2xl font-bold text-slate-900">
            Ready to create your timetable?
          </h1>
          <p className="text-slate-600 mt-2">
            You have {classCount} classes, {teacherCount} teachers, and {lessonCount} lessons per week
          </p>
        </div>

        <div className="space-y-3 mb-8">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-600">Classes</span>
            <span className="font-medium text-slate-900">{classCount}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-600">Teachers</span>
            <span className="font-medium text-slate-900">{teacherCount}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-600">Subjects</span>
            <span className="font-medium text-slate-900">{subjectCount}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-600">Total Lessons</span>
            <span className="font-medium text-blue-600">{lessonCount}/week</span>
          </div>
        </div>

        <button
          onClick={onGenerate}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
        >
          🚀 Generate Timetable
        </button>

        <button
          onClick={onEdit}
          className="w-full mt-3 py-2 text-slate-600 hover:text-slate-900"
        >
          ← Edit data
        </button>
      </div>
    </div>
  );
}

export default GenerateScreen;