'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { schoolApi, termApi, teacherApi } from '@/lib/api';
import EduPageMasterTimetable from '@/components/timetable/EduPageMasterTimetable';

export default function TeacherViewPage() {
  const [selectedTeacher, setSelectedTeacher] = useState('');

  const { data: schoolData } = useQuery({
    queryKey: ['school'],
    queryFn: () => schoolApi.getProfile(),
  });

  const { data: termData } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent(),
  });

  const { data: teachersData } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => {
      return teacherApi.getAll().then(res => {
        let data = res.data?.data || res.data;
        if (data?.result) data = data.result;
        if (data?.items) data = data.items;
        return Array.isArray(data) ? data : [];
      });
    },
  });

  const schoolId = schoolData?.data?.id;
  const termId = termData?.data?.id;
  const teachers = Array.isArray(teachersData) ? teachersData : [];

  if (!schoolId || !termId) {
    return (
      <main className="space-y-4">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Teacher View</h1>
          <p className="text-gray-500">Loading school data...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teacher Timetables</h1>
          <p className="text-sm text-gray-500">View and manage individual teacher schedules</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="max-w-md">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Teacher
          </label>
          <select
            value={selectedTeacher}
            onChange={(e) => setSelectedTeacher(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="">-- Select a teacher --</option>
            {teachers.map((teacher: any) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.firstName || teacher.user?.firstName} {teacher.lastName || teacher.user?.lastName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedTeacher ? (
        <EduPageMasterTimetable entityType="teacher" entityId={selectedTeacher} termId={termId} />
      ) : (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <span className="text-4xl">👨‍🏫</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Select a Teacher</h3>
          <p className="text-gray-500">
            Choose a teacher from the dropdown above to view their timetable
          </p>
        </div>
      )}
    </main>
  );
}
