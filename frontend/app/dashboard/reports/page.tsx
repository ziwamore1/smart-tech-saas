'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { classApi, termApi, studentApi, publishingApi } from '@/lib/api';
import { api } from '@/lib/api';

type ReportType = 'student-report' | 'class-summary' | 'class-report-cards' | 'transcript';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType | ''>('student-report');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<any>(null);

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await classApi.getAll();
      let data = res.data?.data || res.data?.classes || res.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        if (data.result) data = data.result;
        if (data.items) data = data.items;
      }
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: termsData } = useQuery({
    queryKey: ['terms'],
    queryFn: async () => {
      const res = await termApi.getAll();
      let data = res.data?.data || res.data?.terms || res.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        if (data.result) data = data.result;
        if (data.items) data = data.items;
      }
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: studentsData, refetch: refetchStudents } = useQuery({
    queryKey: ['students', selectedClass],
    queryFn: async () => {
      try {
        const res = await studentApi.getAll({ classId: selectedClass });
        let data = res.data?.data?.data || res.data?.data || res.data?.students || res.data;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          if (data.result) data = data.result;
          if (data.items) data = data.items;
        }
        return Array.isArray(data) ? data : [];
      } catch (error: any) {
        console.error('Students API error:', error.response?.data || error.message);
        return [];
      }
    },
    enabled: !!selectedClass,
  });

  const { data: completenessData, refetch: refetchCompleteness } = useQuery({
    queryKey: ['completeness', selectedClass, selectedTerm],
    queryFn: () => publishingApi.checkCompleteness(selectedClass, selectedTerm).then(res => res.data),
    enabled: !!selectedClass && !!selectedTerm,
    refetchInterval: false,
  });

  const classes = Array.isArray(classesData) ? classesData : [];
  const terms = Array.isArray(termsData) ? termsData : [];
  const students: any = studentsData || [];

  const termInfo = terms.find((t: any) => t.id === selectedTerm);
  const isResultsLocked = termInfo?.resultsLocked || false;

  useEffect(() => {
    if (selectedClass && selectedTerm) {
      refetchCompleteness();
    }
  }, [selectedClass, selectedTerm]);

  const handleGenerateReport = async () => {
    if (!selectedClass || !selectedTerm) {
      setError('Please select both class and term');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (reportType === 'student-report') {
        if (!selectedStudent) {
          setError('Please select a student');
          setLoading(false);
          return;
        }
        const response = await api.get(`/report-card/${selectedStudent}/${selectedTerm}/pdf`, {
          responseType: 'blob',
        });
        const url = URL.createObjectURL(new Blob([response.data]));
        setPreviewUrl(url);
        setSuccessMessage('Report card generated successfully!');
      } else if (reportType === 'class-report-cards') {
        const response = await api.get(`/report-card/class/${selectedClass}/term/${selectedTerm}/pdf`, {
          responseType: 'blob',
        });
        const url = URL.createObjectURL(new Blob([response.data]));
        setPreviewUrl(url);
        setSuccessMessage('Class report cards generated successfully!');
      } else if (reportType === 'transcript') {
        console.log('Transcript - selectedStudent:', selectedStudent);
        console.log('Transcript - students list:', students);
        if (!selectedStudent) {
          setError('Please select a student');
          setLoading(false);
          return;
        }
        try {
          const response = await api.get(`/report-card/transcript/${selectedStudent}/pdf`, {
            responseType: 'blob',
          });
          const url = URL.createObjectURL(new Blob([response.data]));
          setPreviewUrl(url);
          setSuccessMessage('Transcript generated successfully!');
        } catch (transcriptErr: any) {
          console.error('Transcript error:', transcriptErr.response?.data || transcriptErr.message);
          throw transcriptErr;
        }
      } else if (reportType === 'class-summary') {
        const response = await publishingApi.getClassSummaryPdf(selectedClass, selectedTerm);
        const url = URL.createObjectURL(new Blob([response.data]));
        setPreviewUrl(url);
        setSuccessMessage('Class summary report generated successfully!');
      }
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Failed to generate report';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    if (previewUrl) {
      const link = document.createElement('a');
      link.href = previewUrl;
      link.download = `report-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDownloadZip = async () => {
    if (!selectedClass || !selectedTerm) {
      setError('Please select both class and term');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/publishing/download-zip', {
        params: { classId: selectedClass, termId: selectedTerm },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `report-cards-${selectedClass}-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccessMessage('ZIP file downloaded successfully!');
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Failed to download ZIP';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePublishResults = async () => {
    if (!selectedClass || !selectedTerm) {
      setError('Please select both class and term');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await publishingApi.publish(selectedClass, selectedTerm);
      setSuccessMessage('Results published successfully!');
      refetchCompleteness();
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Failed to publish results';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const reportTypes = [
    { 
      id: 'student-report', 
      name: 'Student Report Card', 
      icon: '📝', 
      description: 'Generate individual student report cards',
      requiresStudent: true,
    },
    { 
      id: 'class-summary', 
      name: 'Class Summary', 
      icon: '📋', 
      description: 'View class performance summary and statistics',
      requiresStudent: false,
    },
    { 
      id: 'class-report-cards', 
      name: 'Class Report Cards (PDF)', 
      icon: '📄', 
      description: 'Generate PDF for entire class',
      requiresStudent: false,
    },
    { 
      id: 'transcript', 
      name: 'Student Transcript', 
      icon: '📜', 
      description: 'Academic transcript for a student',
      requiresStudent: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">Generate and download school reports</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Link
            href="/dashboard/result-analytics"
            className="px-3 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 flex items-center gap-1"
          >
            <span>📊</span> Result Analytics
          </Link>
          <Link
            href="/dashboard/analytics-enhanced"
            className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 flex items-center gap-1"
          >
            <span>📈</span> Enhanced Analytics
          </Link>
          <Link
            href="/dashboard/teacher-performance"
            className="px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 flex items-center gap-1"
          >
            <span>👨‍🏫</span> Teacher Performance
          </Link>
          <Link
            href="/dashboard/certificate-designer"
            className="px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 flex items-center gap-1"
          >
            Certificates
          </Link>
          <Link
            href="/dashboard/template-builder"
            className="px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 flex items-center gap-1"
          >
            Templates
          </Link>
          <Link
            href="/dashboard/reports/templates"
            className="px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 flex items-center gap-1"
          >
            Settings
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportTypes.map((report) => (
          <div
            key={report.id}
            className={`bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow ${
              reportType === report.id ? 'ring-2 ring-blue-600' : ''
            }`}
            onClick={() => {
              setReportType(report.id as ReportType);
              setPreviewUrl(null);
              setError(null);
              setSuccessMessage(null);
            }}
          >
            <div className="text-4xl mb-4">{report.icon}</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{report.name}</h3>
            <p className="text-sm text-gray-600">{report.description}</p>
          </div>
        ))}
      </div>

      {reportType && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-6">
            {reportTypes.find(r => r.id === reportType)?.name}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setSelectedStudent('');
                  setPreviewUrl(null);
                }}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select Class</option>
                {classes.map((cls: any) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Term</label>
              <select
                value={selectedTerm}
                onChange={(e) => {
                  setSelectedTerm(e.target.value);
                  setPreviewUrl(null);
                }}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select Term</option>
                {terms.map((term: any) => (
                  <option key={term.id} value={term.id}>
                    {term.name} {term.academicYear?.name && `(${term.academicYear.name})`}
                  </option>
                ))}
              </select>
            </div>

            {reportTypes.find(r => r.id === reportType)?.requiresStudent && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Student</label>
                <select
                  value={selectedStudent}
                  onChange={(e) => {
                    setSelectedStudent(e.target.value);
                    setPreviewUrl(null);
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                  disabled={!selectedClass}
                >
                  <option value="">Select Student</option>
                  {students.map((student: Student) => (
                    <option key={student.id} value={student.id}>
                      {student.firstName} {student.lastName} ({student.admissionNumber})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {selectedClass && selectedTerm && completenessData && !isResultsLocked && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-yellow-800">Results Status</p>
                  <p className="text-sm text-yellow-700">
                    {completenessData.completeStudents} of {completenessData.totalStudents} students have complete results
                    ({completenessData.percentageComplete}% complete)
                  </p>
                </div>
                <button
                  onClick={handlePublishResults}
                  disabled={loading || completenessData.percentageComplete < 100}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    completenessData.percentageComplete === 100
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {loading ? 'Publishing...' : 'Publish Results'}
                </button>
              </div>
              {completenessData.incompleteStudents?.length > 0 && (
                <div className="mt-3 text-sm text-yellow-700">
                  <p className="font-medium">Incomplete:</p>
                  <ul className="list-disc list-inside">
                    {completenessData.incompleteStudents.slice(0, 3).map((s: any) => (
                      <li key={s.studentId}>
                        {s.studentName} - {s.missingSubjects} subject(s) missing
                      </li>
                    ))}
                    {completenessData.incompleteStudents.length > 3 && (
                      <li>...and {completenessData.incompleteStudents.length - 3} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {selectedClass && selectedTerm && isResultsLocked && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-medium text-green-800">Results Published</p>
              <p className="text-sm text-green-700">Results for this class and term have been published.</p>
            </div>
          )}

          <div className="flex items-end gap-2 mb-6">
            <button
              onClick={handleGenerateReport}
              disabled={loading || (!selectedClass || !selectedTerm)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
            {previewUrl && (
              <>
                <button
                  onClick={handleDownloadPdf}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Download PDF
                </button>
                <button
                  onClick={() => window.open(previewUrl, '_blank')}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Print
                </button>
              </>
            )}
          </div>

          {reportType === 'class-report-cards' && selectedClass && selectedTerm && isResultsLocked && (
            <div className="mb-6">
              <button
                onClick={handleDownloadZip}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300"
              >
                <span>📦</span>
                {loading ? 'Preparing...' : 'Download All as ZIP'}
              </button>
            </div>
          )}

          {previewUrl ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <span className="text-sm text-gray-600">Report Preview</span>
              </div>
              <iframe
                src={previewUrl}
                className="w-full h-[600px]"
                title="Report Preview"
              />
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <div className="text-6xl mb-4">📄</div>
              <p className="text-gray-600">Select options and click "Generate" to preview report</p>
            </div>
          )}
        </div>
      )}

      {reportType === 'class-summary' && selectedClass && selectedTerm && (
        <ClassSummarySection 
          classId={selectedClass} 
          termId={selectedTerm} 
        />
      )}
    </div>
  );
}

function ClassSummarySection({ classId, termId }: { classId: string; termId: string }) {
  const { data: summaryData, isLoading } = useQuery({
    queryKey: ['results-summary', classId, termId],
    queryFn: async () => {
      const res = await publishingApi.getResultsSummary(classId, termId);
      let data = res.data?.data || res.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        if (data.result) data = data.result;
        if (data.items) data = data.items;
      }
      return data;
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading summary...</div>;
  }

  if (!summaryData) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Class Summary</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">{summaryData.totalStudents}</div>
          <div className="text-sm text-gray-600">Total Students</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">{summaryData.totalSubjects}</div>
          <div className="text-sm text-gray-600">Subjects</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-600">{summaryData.resultsEntered}</div>
          <div className="text-sm text-gray-600">Results Entered</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-orange-600">{summaryData.percentageComplete}%</div>
          <div className="text-sm text-gray-600">Complete</div>
        </div>
      </div>

      <h4 className="font-medium mb-2">Subjects</h4>
      <div className="flex flex-wrap gap-2 mb-4">
        {summaryData.subjects?.map((subject: string) => (
          <span key={subject} className="px-3 py-1 bg-gray-100 rounded-full text-sm">
            {subject}
          </span>
        ))}
      </div>

      <h4 className="font-medium mb-2">Students with Results</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Student</th>
              <th className="px-4 py-2 text-left">Admission No</th>
              <th className="px-4 py-2 text-right">Results</th>
              <th className="px-4 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {summaryData.students?.slice(0, 10).map((student: any) => (
              <tr key={student.studentId} className="border-b">
                <td className="px-4 py-2">{student.studentName}</td>
                <td className="px-4 py-2">{student.admissionNumber}</td>
                <td className="px-4 py-2 text-right">
                  {student.resultsEntered}/{student.totalSubjects}
                </td>
                <td className="px-4 py-2 text-right">
                  {student.resultsEntered === student.totalSubjects ? (
                    <span className="text-green-600">Complete</span>
                  ) : (
                    <span className="text-red-600">Incomplete</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


