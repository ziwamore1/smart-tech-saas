import TeacherTimetable from "@/components/timetable/TeacherTimetable";

export default function TeacherPage({
  params,
}: {
  params: { teacherId: string };
}) {
  // In a real app, the termId would be fetched from the current user context
  // or from the school's current term settings
  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Teacher Timetable
          </h1>
          <p className="text-gray-600 mt-1">
            View teaching schedule and class assignments
          </p>
        </div>

        <TeacherTimetable
          teacherId={params.teacherId}
          showClassName={true}
        />
      </div>
    </main>
  );
}