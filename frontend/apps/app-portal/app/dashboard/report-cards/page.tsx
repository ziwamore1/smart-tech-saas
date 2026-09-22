'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportEngineApi, classApi, termApi, studentApi } from '@/lib/api';
import { toast } from 'sonner';
import { ReportCardViewer } from '@/components/report-card-viewer';

export default function ReportCardsPage() {
  const queryClient = useQueryClient();

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [viewerStudentId, setViewerStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.getAll().then(r => {
      const data = r.data?.data || r.data;
      return Array.isArray(data) ? data : data?.classes || [];
    }),
  });

  const { data: terms } = useQuery({
    queryKey: ['terms'],
    queryFn: () => termApi.getAll().then(r => {
      const data = r.data?.data || r.data;
      return Array.isArray(data) ? data : data?.terms || [];
    }),
  });

  const { data: students } = useQuery({
    queryKey: ['students', selectedClass],
    queryFn: () =>
      studentApi.getAll({ classId: selectedClass }).then(r => {
        const data = r.data?.data || r.data;
        return Array.isArray(data) ? data : data?.students || [];
      }),
    enabled: !!selectedClass,
  });

  const { data: reportHistory } = useQuery({
    queryKey: ['report-hub-report-cards', selectedClass, selectedTerm],
    queryFn: () => reportEngineApi.listReports({
      reportType: 'REPORT_CARD',
      classId: selectedClass,
      termId: selectedTerm,
      limit: 100,
    }).then(r => {
      const data = r.data?.data || r.data;
      return Array.isArray(data) ? data : data?.reports || [];
    }),
    enabled: !!(selectedClass && selectedTerm),
  });

  const generatedReports = useMemo(() => {
    const unique = new Map<string, any>();
    (Array.isArray(reportHistory) ? reportHistory : []).forEach((report: any) => {
      if (report.status !== 'COMPLETED' || !report.studentId || unique.has(report.studentId)) return;
      unique.set(report.studentId, report);
    });
    return Array.from(unique.values());
  }, [reportHistory]);

  const totalStudents = Array.isArray(students) ? students.length : 0;
  const completionRate = totalStudents > 0 ? (generatedReports.length / totalStudents) * 100 : 0;
  const status = {
    studentsWithSummary: generatedReports.length,
    totalStudents,
    completionRate,
    readyForPublication: totalStudents > 0 && generatedReports.length === totalStudents,
  };

  const generateStudentMutation = useMutation({
    mutationFn: () => reportEngineApi.generatePdf({
      type: 'REPORT_CARD',
      studentId: selectedStudent,
      classId: selectedClass,
      termId: selectedTerm,
      examType: 'END_TERM',
    }),
    onSuccess: (response) => {
      if (generatedPdfUrl) URL.revokeObjectURL(generatedPdfUrl);
      setGeneratedPdfUrl(URL.createObjectURL(response.data));
      setViewerStudentId(selectedStudent);
      queryClient.invalidateQueries({ queryKey: ['report-hub-report-cards', selectedClass, selectedTerm] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to generate report card');
    },
  });

  const generateBulkMutation = useMutation({
    mutationFn: () => reportEngineApi.generateBulk({
      type: 'CLASS_REPORT',
      classId: selectedClass,
      termId: selectedTerm,
      examType: 'END_TERM',
    }),
    onSuccess: (data: any) => {
      toast.success(`${data?.length || 0} report cards generated`);
      queryClient.invalidateQueries({ queryKey: ['report-hub-report-cards', selectedClass, selectedTerm] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to generate report cards');
    },
  });

  const handleGenerateStudent = () => {
    if (!selectedStudent || !selectedTerm) {
      toast.error('Please select student and term');
      return;
    }
    setLoading(true);
    generateStudentMutation.mutate(undefined, { onSettled: () => setLoading(false) });
  };

  const handleGenerateBulk = () => {
    if (!selectedClass || !selectedTerm) {
      toast.error('Please select class and term');
      return;
    }
    setLoading(true);
    generateBulkMutation.mutate(undefined, { onSettled: () => setLoading(false) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Report Cards</h1>
        <p className="text-gray-500 mt-1">Generate and preview student report cards.</p>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={selectedClass}
              onChange={e => { setSelectedClass(e.target.value); setSelectedStudent(''); setGeneratedPdfUrl(null); setViewerStudentId(null); }}
            >
              <option value="">Select Class</option>
              {classes?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={selectedTerm}
              onChange={e => setSelectedTerm(e.target.value)}
            >
              <option value="">Select Term</option>
              {terms?.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={selectedStudent}
              onChange={e => setSelectedStudent(e.target.value)}
            >
              <option value="">Select Student</option>
              {students?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={handleGenerateStudent}
              disabled={loading || !selectedStudent}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              <i className="fa fa-file-text mr-1"></i>Generate
            </button>
            <button
              onClick={handleGenerateBulk}
              disabled={loading || !selectedClass}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
            >
              <i className="fa fa-files-o mr-1"></i>Bulk
            </button>
          </div>
        </div>

        {selectedClass && selectedTerm && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                <i className="fa fa-info-circle mr-1"></i>
                {status.studentsWithSummary}/{status.totalStudents} report cards ready
              </span>
              <span className={`font-medium ${status.readyForPublication ? 'text-green-600' : 'text-yellow-600'}`}>
                {status.completionRate.toFixed(1)}% complete
              </span>
            </div>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${status.readyForPublication ? 'bg-green-600' : 'bg-yellow-600'}`}
                style={{ width: `${status.completionRate}%` }}
              ></div>
            </div>
          </div>
        )}

        {selectedClass && selectedTerm && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-semibold text-gray-900">Generated Report Cards</h2>
                <p className="text-xs text-gray-500">Existing Report Hub cards are reused and shown once per student.</p>
              </div>
              <span className="text-xs text-gray-500">{generatedReports.length} unique card{generatedReports.length === 1 ? '' : 's'}</span>
            </div>
            {generatedReports.length === 0 ? (
              <p className="text-sm text-gray-500">No Report Hub cards have been generated for this class and term.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {generatedReports.map((report: any) => {
                  const student = students?.find((item: any) => item.id === report.studentId);
                  return (
                    <button key={report.studentId} onClick={() => setViewerStudentId(report.studentId)} className="text-left border border-gray-200 rounded-lg px-3 py-2 hover:border-blue-400 hover:bg-blue-50 transition-colors">
                      <span className="block text-sm font-medium text-gray-900">{student ? `${student.firstName} ${student.lastName}` : report.studentId}</span>
                      <span className="block text-xs text-gray-500 mt-1">Generated by {report.generatedByName || 'school staff'}</span>
                      <span className="block text-xs text-blue-600 mt-1">View report card</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {viewerStudentId && selectedTerm && (
        <ReportCardViewer
          studentId={viewerStudentId}
          termId={selectedTerm}
          termName={terms?.find((term: any) => term.id === selectedTerm)?.name}
          studentName={students?.find((student: any) => student.id === viewerStudentId) ? `${students.find((student: any) => student.id === viewerStudentId).firstName} ${students.find((student: any) => student.id === viewerStudentId).lastName}` : undefined}
          onClose={() => setViewerStudentId(null)}
        />
      )}

       {generatedPdfUrl && (
         <div className="bg-white rounded-lg shadow p-4 sm:p-6">
           <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
             <div>
               <h2 className="text-xl font-bold text-gray-900">Full Report Card</h2>
               <p className="text-sm text-gray-500">Generated through the Report Hub template and report engine.</p>
             </div>
             <div className="flex gap-2">
               <a href={generatedPdfUrl} download={`report-card-${selectedStudent}-${selectedTerm}.pdf`} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">Download PDF</a>
               <button onClick={() => window.print()} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm">Print</button>
             </div>
           </div>
           <iframe src={generatedPdfUrl} title="Full report card" className="w-full h-[75vh] min-h-[520px] rounded-lg border" />
         </div>
       )}

    </div>
  );
}
