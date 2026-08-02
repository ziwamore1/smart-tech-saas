'use client';

import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resultApi, classApi, termApi, subjectApi, assessmentApi, publishingApi, reportEngineApi } from '@/lib/api';

async function downloadTemplateFile(termId: string, classId: string | undefined) {
  const response = await resultApi.getTemplate(termId, { classId: classId || undefined });
  const contentType = response.headers?.['content-type'] || '';
  if (
    !contentType.includes('spreadsheetml') &&
    !contentType.includes('octet-stream')
  ) {
    throw new Error('The server returned an invalid response instead of the Excel template. Please try again.');
  }
  const blob = new Blob([response.data]);
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = 'results-template.xlsx';
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(downloadUrl);
  document.body.removeChild(a);
}

type Tab = 'upload' | 'entry' | 'assessments' | 'review' | 'publish' | 'reports';

interface UploadResultsTabProps {
  classes: any[];
  terms: any[];
  selectedClass: string;
  selectedTerm: string;
  onClassChange: (id: string) => void;
  onTermChange: (id: string) => void;
  onDownloadTemplate: () => void;
  uploadMutation: any;
  message: { type: 'success' | 'error'; text: string } | null;
}

interface ReviewResultsTabProps {
  resultsSummary: any;
  completenessCheck: any;
  summaryLoading: boolean;
  completenessLoading: boolean;
  onRefresh: () => void;
  onRecalculateGrades: () => void;
  isLocked: boolean;
  isRecalculating?: boolean;
  onUnlock?: () => void;
}

interface AssessmentTypesTabProps {
  selectedSubject: string;
  selectedTerm: string;
  assessmentTypes: any[];
  isLocked: boolean;
  onRefresh: () => void;
}

interface PublishTabProps {
  classes: any[];
  terms: any[];
  publishStatus: any[];
  isLocked: boolean;
  onPublish: (data: { classId: string; termId: string }) => void;
  resultsSummary: any;
  completenessCheck: any;
  selectedClass: string;
  selectedTerm: string;
  isPublishing: boolean;
  totalStudents?: number;
  completedReports?: number;
}

interface ReportsTabProps {
  selectedClass: string;
  selectedTerm: string;
  publishStatus: any[];
  onMessage: (msg: { type: 'success' | 'error'; text: string }) => void;
}

function UploadResultsTab({
  classes,
  terms,
  selectedClass,
  selectedTerm,
  onClassChange,
  onTermChange,
  onDownloadTemplate,
  uploadMutation,
  message,
}: UploadResultsTabProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !selectedTerm) return;
    uploadMutation.mutate({ termId: selectedTerm, file: selectedFile });
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Upload Results from Excel</h2>
        
        {message && (
          <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Class *</label>
            <select
              value={selectedClass}
              onChange={(e) => onClassChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Select Class</option>
              {classes.map((cls: any) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Term *</label>
            <select
              value={selectedTerm}
              onChange={(e) => onTermChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Select Term</option>
              {terms.map((term: any) => (
                <option key={term.id} value={term.id}>{term.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="text-4xl mb-2">📄</div>
            {selectedFile ? (
              <div>
                <p className="font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-gray-900">Click to select Excel file</p>
                <p className="text-sm text-gray-500">Supports .xlsx and .xls files</p>
              </div>
            )}
          </label>
          {selectedFile && (
            <button
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="mt-2 text-sm text-red-600 hover:text-red-800"
            >
              Remove file
            </button>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onDownloadTemplate}
            disabled={!selectedTerm}
            className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50"
          >
            📥 Download Template
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || !selectedTerm || uploadMutation.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {uploadMutation.isPending ? 'Uploading...' : '📤 Upload Results'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold mb-3">Instructions:</h3>
        <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
          <li>Select the class and term for the results you want to upload</li>
          <li>Click "Download Template" to get the Excel file with student data</li>
          <li>Fill in the scores for each student and subject in the template</li>
          <li>Enter <strong>X</strong> or <strong>A</strong> in a score cell to mark a student absent for that subject</li>
          <li>Save the Excel file and upload it using the "Upload Results" button</li>
          <li>After upload, go to "Review Results" tab to verify the entries</li>
          <li>Once all results are complete, go to "Publish Results" to publish</li>
        </ol>
      </div>

      <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
        <h3 className="font-medium text-yellow-800 mb-2">⚠️ Important Notes:</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>Scores must be between 0 and 100</li>
          <li>Student admission numbers in the Excel must match existing students</li>
          <li>Subject names must match the subjects assigned to the class</li>
          <li>Existing results will be updated if the same student/subject combination exists</li>
        </ul>
      </div>
    </div>
  );
}

function AssessmentTypesTab({ selectedSubject, selectedTerm, assessmentTypes, isLocked, onRefresh }: AssessmentTypesTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newType, setNewType] = useState({ name: '', maxScore: 100, weight: 0 });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: { name: string; maxScore: number; weight: number; subjectId: string; termId: string }) => {
      console.log('Creating assessment type:', data);
      return assessmentApi.createType(data);
    },
    onSuccess: () => {
      onRefresh();
      setShowAddForm(false);
      setNewType({ name: '', maxScore: 100, weight: 0 });
      setMessage({ type: 'success', text: 'Assessment type added!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      console.error('Failed to create assessment type:', error);
      setMessage({ type: 'error', text: error.response?.data?.message || error.message || 'Failed to add type' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => assessmentApi.deleteType(id),
    onSuccess: () => {
      onRefresh();
      setMessage({ type: 'success', text: 'Assessment type deleted!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to delete' });
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const totalWeight = assessmentTypes.reduce((sum: number, t: any) => sum + t.weight, 0);
  const isComplete = Math.abs(totalWeight - 1.0) < 0.001;
  const canAddType = selectedSubject && selectedTerm && !isLocked;

  if (!selectedTerm) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">
          Select a term to manage assessment types
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {message && (
        <div className={`mx-4 mt-4 px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="p-4 border-b flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Assessment Types</h2>
          <p className="text-sm text-gray-500">
            Total Weight: {(totalWeight * 100).toFixed(1)}% {isComplete ? '✓ Complete' : '⚠ Must equal 100%'}
          </p>
          {!selectedSubject && (
            <p className="text-xs text-yellow-600 mt-1">Select a subject above to add new types</p>
          )}
        </div>
        {canAddType && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add Assessment Type
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="p-4 bg-gray-50 border-b">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
              <input
                type="text"
                value={newType.name}
                onChange={(e) => setNewType({ ...newType, name: e.target.value })}
                placeholder="e.g., End of Term Exam"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Score *</label>
              <input
                type="number"
                min="1"
                value={newType.maxScore > 0 ? newType.maxScore : ''}
                placeholder="e.g., 100"
                onChange={(e) => {
                  const val = e.target.value;
                  setNewType({ ...newType, maxScore: val ? Number(val) : 0 });
                }}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Weight (%) *</label>
              <input
                type="number"
                step="1"
                min="1"
                max="100"
                value={newType.weight > 0 ? Math.round(newType.weight * 100) : ''}
                placeholder="e.g., 20"
                onChange={(e) => {
                  const val = e.target.value;
                  setNewType({ ...newType, weight: val ? Number(val) / 100 : 0 });
                }}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={() => createMutation.mutate({ ...newType, subjectId: selectedSubject, termId: selectedTerm })}
                disabled={!newType.name || newType.maxScore <= 0 || newType.weight <= 0 || createMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {createMutation.isPending ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {assessmentTypes.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No assessment types defined. Add types that sum to 100%.
        </div>
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Max Score</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Weight</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {assessmentTypes.map((type: any) => (
              <tr key={type.id} className="border-t">
                <td className="py-3 px-4 font-medium">{type.name}</td>
                <td className="py-3 px-4">{type.maxScore}</td>
                <td className="py-3 px-4">{(type.weight * 100).toFixed(1)}%</td>
                <td className="py-3 px-4">
                  {!isLocked && (
                    <button
                      onClick={() => {
                        if (confirm('Delete this assessment type?')) {
                          deleteMutation.mutate(type.id);
                        }
                      }}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="p-4 bg-blue-50 border-t">
        <h3 className="font-medium mb-2">Common Assessment Setup Examples:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>Simple (Exam only):</strong> End of Term Exam = 100%</li>
          <li>• <strong>Standard:</strong> CAT = 20%, Mid-Term = 20%, End of Term = 60%</li>
          <li>• <strong>Detailed:</strong> Assignment = 10%, CAT = 15%, Project = 15%, Exam = 60%</li>
          <li>• <strong>With Mock:</strong> Class Work = 20%, Mock Exam = 30%, Final Exam = 50%</li>
        </ul>
      </div>
    </div>
  );
}

function ReviewResultsTab({
  resultsSummary, 
  completenessCheck, 
  summaryLoading, 
  completenessLoading,
  onRefresh,
  onRecalculateGrades,
  isLocked,
  isRecalculating,
  onUnlock
}: ReviewResultsTabProps) {
  if (!resultsSummary && !completenessCheck) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">
          Select a class and term to review results
        </div>
      </div>
    );
  }

  if (summaryLoading || completenessLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  const percentageComplete = resultsSummary?.percentageComplete || completenessCheck?.percentageComplete || 0;
  const isComplete = completenessCheck?.isComplete || false;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Results Review - {resultsSummary?.className}</h2>
          <div className="flex gap-2">
            <button
              onClick={onRecalculateGrades}
              disabled={isLocked || isRecalculating}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              title="Calculate grades for all results"
            >
              {isRecalculating ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Calculating...
                </>
              ) : (
                <>
                  📊 Calculate Grades
                </>
              )}
            </button>
            <button
              onClick={onRefresh}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">
              {resultsSummary?.totalStudents || 0}
            </div>
            <div className="text-sm text-gray-600">Total Students</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-600">
              {resultsSummary?.totalSubjects || 0}
            </div>
            <div className="text-sm text-gray-600">Subjects</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-orange-600">
              {resultsSummary?.resultsEntered || 0}
            </div>
            <div className="text-sm text-gray-600">Results Entered</div>
          </div>
          <div className={`rounded-lg p-4 ${isComplete ? 'bg-green-50' : 'bg-yellow-50'}`}>
            <div className={`text-2xl font-bold ${isComplete ? 'text-green-600' : 'text-yellow-600'}`}>
              {percentageComplete}%
            </div>
            <div className="text-sm text-gray-600">Complete</div>
          </div>
        </div>

        {resultsSummary?.isPublished && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-medium">
              ✓ Results Published on {new Date(resultsSummary.publishedAt).toLocaleDateString()}
            </p>
          </div>
        )}

        {(resultsSummary?.resultsLocked) && !resultsSummary?.isPublished && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <p className="text-red-800 font-medium">
              🔒 Results are locked but not yet published
            </p>
            {onUnlock ? (
              <button
                onClick={onUnlock}
                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
              >
                Unlock
              </button>
            ) : null}
          </div>
        )}

        <div className="mb-4">
          <h3 className="font-medium mb-2">Progress Bar</h3>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className={`h-4 rounded-full transition-all ${
                isComplete ? 'bg-green-500' : percentageComplete > 50 ? 'bg-blue-500' : 'bg-yellow-500'
              }`}
              style={{ width: `${percentageComplete}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {resultsSummary?.resultsEntered || 0} of {resultsSummary?.expectedResults || 0} expected results entered
            {!isComplete && ` (${completenessCheck?.totalStudents - completenessCheck?.completeStudents || 0} students missing)`}
          </p>
        </div>

        {completenessCheck?.message && (
          <div className={`p-4 rounded-lg ${isComplete ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'}`}>
            <p className="font-medium">{completenessCheck.message}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Subject Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {resultsSummary?.subjects?.map((subject: string, index: number) => {
            const subjectResults = resultsSummary?.students?.reduce((count: number, student: any) => {
              return count + (student.results?.filter((r: any) => r.subjectName === subject).length || 0);
            }, 0) || 0;
            const expected = resultsSummary?.totalStudents || 0;
            const isSubjectComplete = subjectResults >= expected;
            
            return (
              <div
                key={index}
                className={`p-3 rounded-lg border ${isSubjectComplete ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}
              >
                <div className="font-medium text-sm">{subject}</div>
                <div className="text-xs text-gray-600">
                  {subjectResults}/{expected} entered
                </div>
              </div>
            );
          })}
        </div>
        {(!resultsSummary?.subjects || resultsSummary.subjects.length === 0) && (
          <p className="text-gray-500">No teaching assignments found for this class</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Students Status</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Student</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700">Results</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {resultsSummary?.students?.map((student: any) => {
                const isStudentComplete = student.resultsEntered >= student.totalSubjects;
                return (
                  <tr key={student.studentId} className="border-t">
                    <td className="py-3 px-4">
                      <div className="font-medium">{student.studentName}</div>
                      <div className="text-sm text-gray-500">{student.admissionNumber}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {student.resultsEntered}/{student.totalSubjects}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {isStudentComplete ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Complete</span>
                      ) : (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
                          Missing {student.totalSubjects - student.resultsEntered}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(!resultsSummary?.students || resultsSummary.students.length === 0) && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-gray-500">
                    No students enrolled in this class
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {completenessCheck?.incompleteStudents?.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 text-red-600">Students with Missing Results</h3>
          <div className="space-y-3">
            {completenessCheck.incompleteStudents.map((student: any, index: number) => (
              <div key={index} className="p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="font-medium">{student.studentName}</div>
                <div className="text-sm text-red-700">
                  Missing {student.missingSubjects?.length || 0} subjects: 
                  {student.missingSubjects?.map((s: any) => s.name).join(', ') || 'None specified'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLocked && isComplete && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">Ready to Publish</h3>
          <p className="text-gray-600 mb-4">
            All results are complete. You can now publish these results so that students and parents can view them.
          </p>
          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            Go to Publish Tab
          </button>
        </div>
      )}
    </div>
  );
}

function PublishTab({ classes, terms, publishStatus, isLocked, onPublish, resultsSummary, completenessCheck, selectedClass, selectedTerm, isPublishing, totalStudents, completedReports }: PublishTabProps) {
  const percentageComplete = resultsSummary?.percentageComplete || completenessCheck?.percentageComplete || 0;
  const isComplete = completenessCheck?.isComplete || false;

  const publishSteps = [
    { id: 1, label: 'Validating results', icon: '✓' },
    { id: 2, label: 'Generating report cards', icon: '📄' },
    { id: 3, label: 'Publishing to portal', icon: '🚀' },
    { id: 4, label: 'Locking results', icon: '🔒' },
  ];

  const currentStep = isPublishing ? 2 : 0;
  const reportProgress = totalStudents && completedReports !== undefined 
    ? Math.round((completedReports / totalStudents) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {selectedClass && selectedTerm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Results Status: {resultsSummary?.className}</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{resultsSummary?.totalStudents || 0}</div>
              <div className="text-sm text-gray-600">Students</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">{resultsSummary?.totalSubjects || 0}</div>
              <div className="text-sm text-gray-600">Subjects</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">{resultsSummary?.resultsEntered || 0}</div>
              <div className="text-sm text-gray-600">Results Entered</div>
            </div>
            <div className={`rounded-lg p-4 ${isComplete ? 'bg-green-50' : 'bg-yellow-50'}`}>
              <div className={`text-2xl font-bold ${isComplete ? 'text-green-600' : 'text-yellow-600'}`}>{percentageComplete}%</div>
              <div className="text-sm text-gray-600">{isComplete ? 'Complete' : 'Incomplete'}</div>
            </div>
          </div>

          {resultsSummary?.isPublished && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
              <p className="text-green-800 font-medium">
                ✓ Results Published on {new Date(resultsSummary.publishedAt).toLocaleDateString()}
              </p>
            </div>
          )}

          {!isComplete && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
              <p className="text-red-800 font-medium">
                ⚠ Results not complete. {completenessCheck?.totalStudents - completenessCheck?.completeStudents || 0} student(s) still have missing subjects.
              </p>
            </div>
          )}

          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                isComplete ? 'bg-green-500' : percentageComplete > 50 ? 'bg-blue-500' : 'bg-yellow-500'
              }`}
              style={{ width: `${percentageComplete}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {resultsSummary?.resultsEntered || 0} of {resultsSummary?.expectedResults || 0} expected results
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Publish Class Results</h2>
        
        {isPublishing && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="animate-spin text-2xl">⚙️</div>
              <div>
                <h3 className="font-semibold text-blue-800">Publishing in progress...</h3>
                <p className="text-sm text-blue-600">
                  Please wait while we generate report cards and publish results.
                </p>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between text-sm text-blue-700 mb-1">
                <span>Report Card Generation</span>
                <span>{completedReports || 0} / {totalStudents || 0} students</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-3">
                <div
                  className="h-3 rounded-full bg-blue-600 transition-all duration-300 ease-out"
                  style={{ width: `${reportProgress}%` }}
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {publishSteps.map((step, index) => (
                  <div key={step.id} className="flex items-center">
                    <div className={`flex items-center gap-1 px-2 py-1 rounded ${
                      index < 2 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <span>{index < 2 ? '✓' : step.icon}</span>
                      <span className="text-xs">{step.label}</span>
                    </div>
                    {index < publishSteps.length - 1 && (
                      <div className={`w-6 h-0.5 ${index < 1 ? 'bg-blue-600' : 'bg-gray-200'}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {!selectedClass || !selectedTerm ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
            Please select a class and term from the filters above to publish results.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Selected Term</label>
                <div className="px-3 py-2 border rounded-lg bg-gray-50">
                  {terms.find((t: any) => t.id === selectedTerm)?.name || 'N/A'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Selected Class</label>
                <div className="px-3 py-2 border rounded-lg bg-gray-50">
                  {classes.find((c: any) => c.id === selectedClass)?.name || 'N/A'}
                </div>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => selectedClass && selectedTerm && onPublish({ classId: selectedClass, termId: selectedTerm })}
                  disabled={!selectedClass || !selectedTerm || isLocked || !isComplete || isPublishing}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  title={!isComplete ? 'Complete all results before publishing' : ''}
                >
                  {isPublishing ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Publishing...
                    </>
                  ) : (
                    <>
                      🚀 Publish Results
                    </>
                  )}
                </button>
              </div>
            </div>

            {isLocked && !isPublishing && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                <p className="text-yellow-800">
                  Results are locked. Unpublish from the term management to allow edits.
                </p>
              </div>
            )}

            {!isComplete && !isPublishing && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                <p className="text-yellow-800">
                  Results must be 100% complete before publishing. Go to "Review Results" tab to see which students have missing subjects.
                </p>
              </div>
            )}

            {isComplete && !resultsSummary?.isPublished && !isLocked && !isPublishing && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-medium">
                  ✓ All results are complete. You can publish these results now.
                </p>
              </div>
            )}
          </>
        )}

        <div className="mt-6">
          <h3 className="font-medium mb-2">Publishing Guidelines:</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>1. Ensure all student results are entered for the class</li>
            <li>2. Verify assessment types sum to 100% for each subject</li>
            <li>3. Check that results are complete before publishing</li>
            <li>4. Once published, results are locked and cannot be edited</li>
            <li>5. Students and parents can view results in their portal</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function ReportsTab({ selectedClass, selectedTerm, publishStatus, onMessage }: ReportsTabProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const termStatus = publishStatus.find((p: any) => p.termId === selectedTerm && p.classId === selectedClass);

  const handleDownloadClassReports = async () => {
    if (!selectedClass || !selectedTerm) return;
    setLoading('class');
    try {
      const response = await reportEngineApi.generatePdf({
        type: 'CLASS_REPORT',
        classId: selectedClass,
        termId: selectedTerm,
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `class-reports-${selectedTerm}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      onMessage({ type: 'success', text: 'Class reports downloaded successfully' });
    } catch (error: any) {
      onMessage({ type: 'error', text: error.response?.data?.message || 'Failed to download class reports' });
    } finally {
      setLoading(null);
    }
  };

  const handleDownloadZip = async () => {
    if (!selectedClass || !selectedTerm) return;
    setLoading('zip');
    try {
      const response = await publishingApi.downloadZip(selectedClass, selectedTerm);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `all-reports-${selectedTerm}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      onMessage({ type: 'success', text: 'Reports ZIP downloaded successfully' });
    } catch (error: any) {
      onMessage({ type: 'error', text: error.response?.data?.message || 'Failed to download ZIP' });
    } finally {
      setLoading(null);
    }
  };

  const handleViewAnalytics = () => {
    window.location.href = `/dashboard/result-analytics?classId=${selectedClass}&termId=${selectedTerm}`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Generate Reports</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-2">Report Cards</h3>
          <p className="text-sm text-gray-600 mb-4">
            Download report cards PDF for all students in the selected class.
          </p>
          <button
            onClick={handleDownloadClassReports}
            disabled={!selectedClass || !selectedTerm || !termStatus?.published || loading === 'class'}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading === 'class' ? 'Generating...' : 'Download Class Reports PDF'}
          </button>
          {!termStatus?.published && selectedClass && selectedTerm && (
            <p className="text-xs text-red-500 mt-2">Publish results first to generate reports</p>
          )}
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-2">Class Summary</h3>
          <p className="text-sm text-gray-600 mb-4">
            Generate a summary report showing class performance across subjects.
          </p>
          <button
            onClick={handleViewAnalytics}
            disabled={!selectedClass || !selectedTerm}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            View Class Summary
          </button>
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-2">Download All Reports (ZIP)</h3>
          <p className="text-sm text-gray-600 mb-4">
            Download all report cards as a ZIP file for the selected class.
          </p>
          <button
            onClick={handleDownloadZip}
            disabled={!selectedClass || !selectedTerm || !termStatus?.published || loading === 'zip'}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading === 'zip' ? 'Generating...' : 'Download ZIP'}
          </button>
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-2">Analytics Dashboard</h3>
          <p className="text-sm text-gray-600 mb-4">
            View detailed analytics and performance charts.
          </p>
          <button
            onClick={handleViewAnalytics}
            disabled={!selectedClass || !selectedTerm}
            className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            View Analytics
          </button>
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-2">Professional Report Hub</h3>
          <p className="text-sm text-gray-600 mb-4">
            Generate branded report cards, transcripts, certificates, and class reports using the current templates.
          </p>
          <button
            onClick={() => { window.location.href = '/dashboard/report-hub'; }}
            className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            Open Report Hub
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('entry');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{
    studentId: string;
    subjectId: string;
    resultId?: string | null;
    score?: number | null;
  } | null>(null);

  const { data: classesData = [], isLoading: classesLoading, error: classesError } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await classApi.getAll();
      let data = res.data;
      if (data?.data) data = data.data;
      if (data?.classes) data = data.classes;
      if (data?.result) data = data.result;
      if (!Array.isArray(data)) data = [];
      return data;
    },
  });

  const classes = Array.isArray(classesData) ? classesData : [];

  const { data: termsData = [], isLoading: termsLoading, error: termsError } = useQuery({
    queryKey: ['terms'],
    queryFn: async () => {
      const res = await termApi.getAll();
      let data = res.data;
      if (data?.data) data = data.data;
      if (data?.terms) data = data.terms;
      if (data?.result) data = data.result;
      if (!Array.isArray(data)) data = [];
      return data;
    },
  });

  const terms = Array.isArray(termsData) ? termsData : [];

  const { data: subjectsData = [], isLoading: subjectsLoading, error: subjectsError } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await subjectApi.getAll();
      let data = res.data;
      if (data?.data) data = data.data;
      if (data?.subjects) data = data.subjects;
      if (data?.result) data = data.result;
      if (!Array.isArray(data)) data = [];
      return data;
    },
  });

  const subjects = Array.isArray(subjectsData) ? subjectsData : [];

  const { data: resultsData = [], isLoading: resultsLoading, refetch: refetchResults } = useQuery({
    queryKey: ['results', selectedClass, selectedTerm, selectedSubject],
    queryFn: async () => {
      const res = await resultApi.getAll({ classId: selectedClass, termId: selectedTerm, subjectId: selectedSubject || undefined });
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedClass && !!selectedTerm,
  });

  const results = Array.isArray(resultsData) ? resultsData : [];

  // Pivot results into one row per student, one column per subject so the
  // table stays compact even with many students and subjects.
  const subjectColumns = useMemo(() => {
    const order = new Map<string, number>();
    (Array.isArray(subjectsData) ? subjectsData : []).forEach((s: any, i: number) => {
      if (s?.id) order.set(s.id, i);
    });
    const map = new Map<string, { id: string; name: string; code?: string }>();
    for (const r of results) {
      const sid = r.subject?.id;
      if (sid && !map.has(sid))
        map.set(sid, {
          id: sid,
          name: r.subject?.name || 'Subject',
          code: r.subject?.code || undefined,
        });
    }
    return [...map.values()].sort(
      (a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [results, subjectsData]);

  const studentRows = useMemo(() => {
    const byStudent = new Map<string, { student: any; cells: Map<string, any> }>();
    for (const r of results) {
      const sid = r.student?.id;
      if (!sid) continue;
      if (!byStudent.has(sid)) byStudent.set(sid, { student: r.student, cells: new Map() });
      byStudent.get(sid)!.cells.set(r.subject?.id, r);
    }
    return [...byStudent.values()];
  }, [results]);

  const { data: assessmentTypesData = [], refetch: refetchAssessments } = useQuery({
    queryKey: ['assessment-types', selectedSubject || 'all', selectedTerm],
    queryFn: async () => {
      const res = await assessmentApi.getTypes({ subjectId: selectedSubject || undefined, termId: selectedTerm });
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedTerm,
  });

  const assessmentTypes = Array.isArray(assessmentTypesData) ? assessmentTypesData : [];

  const { data: classAssessments } = useQuery({
    queryKey: ['class-assessments', selectedClass, selectedSubject, selectedTerm],
    queryFn: () => {
      if (selectedClass && selectedSubject && selectedTerm) {
        return assessmentApi.getClassDashboard(selectedClass, selectedSubject, selectedTerm).then(res => res.data);
      }
      return Promise.resolve(null);
    },
    enabled: !!selectedClass && !!selectedSubject && !!selectedTerm,
  });

  const { data: publishStatusData = [] } = useQuery({
    queryKey: ['publish-status'],
    queryFn: async () => {
      const res = await publishingApi.getStatus();
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: resultsSummary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['results-summary', selectedClass, selectedTerm],
    queryFn: async () => {
      if (!selectedClass || !selectedTerm) return null;
      const res = await publishingApi.getResultsSummary(selectedClass, selectedTerm);
      return res.data?.data || res.data;
    },
    enabled: !!selectedClass && !!selectedTerm,
  });

  const { data: completenessCheck, isLoading: completenessLoading, refetch: refetchCompleteness } = useQuery({
    queryKey: ['completeness-check', selectedClass, selectedTerm],
    queryFn: async () => {
      if (!selectedClass || !selectedTerm) return null;
      const res = await publishingApi.checkCompleteness(selectedClass, selectedTerm);
      return res.data?.data || res.data;
    },
    enabled: !!selectedClass && !!selectedTerm,
  });

  const publishStatus = Array.isArray(publishStatusData) ? publishStatusData : [];

  const currentTerm = terms.find((t: any) => t.id === selectedTerm);
  const isLocked = currentTerm?.resultsLocked ?? false;

  const createResultMutation = useMutation({
    mutationFn: (data: { studentId: string; subjectId: string; termId: string; score: number }) =>
      resultApi.create(data),
    onSuccess: () => {
      refetchResults();
      setMessage({ type: 'success', text: 'Result saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save result' });
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const updateResultMutation = useMutation({
    mutationFn: ({ id, score }: { id: string; score: number }) => resultApi.update(id, score),
    onSuccess: () => {
      refetchResults();
      setEditingResult(null);
      setMessage({ type: 'success', text: 'Result updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update result' });
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const deleteResultMutation = useMutation({
    mutationFn: (id: string) => resultApi.delete(id),
    onSuccess: () => {
      refetchResults();
      setMessage({ type: 'success', text: 'Result deleted successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to delete result' });
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ termId, file }: { termId: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await resultApi.uploadExcel(termId, formData);
      return res.data;
    },
    onSuccess: (data) => {
      refetchResults();
      refetchSummary();
      refetchCompleteness();
      const errs = Array.isArray(data?.errors) ? data.errors : [];
      const base = `Upload successful! ${data?.resultsInserted || 0} inserted, ${data?.resultsUpdated || 0} updated, ${data?.resultsAbsent || 0} marked absent.`;
      const text = errs.length
        ? `${base} ${errs.length} item(s) skipped: ${errs.slice(0, 3).join('; ')}${errs.length > 3 ? '...' : ''}`
        : base;
      setMessage({ type: errs.length ? 'error' : 'success', text });
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to upload results' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const publishMutation = useMutation({
    mutationFn: ({ classId, termId }: { classId: string; termId: string }) =>
      publishingApi.publish(classId, termId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publish-status'] });
      setMessage({ type: 'success', text: 'Results published successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to publish results' });
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const recalculateGradesMutation = useMutation({
    mutationFn: ({ classId, termId }: { classId: string; termId: string }) =>
      resultApi.recalculateGrades(classId, termId),
    onSuccess: (response: any) => {
      refetchResults();
      setMessage({ type: 'success', text: `Grades calculated for ${response?.data?.resultsUpdated || 0} results!` });
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to calculate grades' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const recalculatePointsMutation = useMutation({
    mutationFn: ({ classId, termId }: { classId: string; termId: string }) =>
      resultApi.recalculatePoints(classId, termId),
    onSuccess: (response: any) => {
      refetchResults();
      setMessage({ type: 'success', text: `Points calculated for ${response?.data?.resultsUpdated || 0} results!` });
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to calculate points' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const tabs = [
    { key: 'upload' as Tab, label: 'Upload Results', icon: '📤' },
    { key: 'entry' as Tab, label: 'View Results', icon: '📝' },
    { key: 'review' as Tab, label: 'Review Results', icon: '👁️' },
    { key: 'assessments' as Tab, label: 'Assessment Types', icon: '📋' },
    { key: 'publish' as Tab, label: 'Publish Results', icon: '🚀' },
    { key: 'reports' as Tab, label: 'Reports', icon: '📊' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Results Management</h1>
          <p className="text-gray-600 mt-1">Manage student results, assessments, and publishing</p>
        </div>
        {isLocked && (
          <div className="flex items-center gap-2">
            <span className="px-4 py-2 bg-red-100 text-red-800 rounded-lg font-medium">
              🔒 Results Locked
            </span>
            <button
              onClick={async () => {
                if (confirm('Unlock results for editing? This will also unpublish results.')) {
                  try {
                    await publishingApi.unpublish(selectedClass, selectedTerm);
                    alert('Results unlocked');
                    refetchSummary();
                  } catch (err: any) {
                    alert('Failed to unlock: ' + (err.response?.data?.message || err.message));
                  }
                }
              }}
              className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
            >
              Unlock
            </button>
          </div>
        )}
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="flex gap-2 border-b overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 font-medium transition-colors whitespace-nowrap ${activeTab === tab.key ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class *</label>
            {classesLoading ? (
              <div className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500">Loading...</div>
            ) : classesError ? (
              <div className="w-full px-3 py-2 border border-red-300 rounded-lg bg-red-50 text-red-600 text-sm">
                Error loading classes
              </div>
            ) : (
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select Class</option>
                {classes.map((cls: any) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Term *</label>
            {termsLoading ? (
              <div className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500">Loading...</div>
            ) : termsError ? (
              <div className="w-full px-3 py-2 border border-red-300 rounded-lg bg-red-50 text-red-600 text-sm">
                Error loading terms
              </div>
            ) : (
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select Term</option>
                {terms.map((term: any) => (
                  <option key={term.id} value={term.id}>{term.name} {term.isCurrent ? '(Current)' : ''}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            {subjectsLoading ? (
              <div className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500">Loading...</div>
            ) : subjectsError ? (
              <div className="w-full px-3 py-2 border border-red-300 rounded-lg bg-red-50 text-red-600 text-sm">
                Error loading subjects
              </div>
            ) : (
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">All Subjects</option>
                {subjects.map((subject: any) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'upload' && (
        <UploadResultsTab
          classes={classes}
          terms={terms}
          selectedClass={selectedClass}
          selectedTerm={selectedTerm}
          onClassChange={setSelectedClass}
          onTermChange={setSelectedTerm}
          onDownloadTemplate={async () => {
            if (!selectedTerm) return;
            try {
              await downloadTemplateFile(selectedTerm, selectedClass);
            } catch (error: any) {
              console.error('Download error:', error);
              setMessage({ type: 'error', text: error.response?.data?.message || error.message || 'Failed to download template' });
              setTimeout(() => setMessage(null), 5000);
            }
          }}
          uploadMutation={uploadMutation}
          message={message}
        />
      )}

      {activeTab === 'entry' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="text-xl font-semibold">Student Results</h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!selectedClass || !selectedTerm) return;
                  if (confirm('This will calculate grades for all results in this class. Continue?')) {
                    recalculateGradesMutation.mutate({ classId: selectedClass, termId: selectedTerm });
                  }
                }}
                disabled={!selectedClass || !selectedTerm || isLocked || recalculateGradesMutation.isPending}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                title="Calculate grades for all results"
              >
                {recalculateGradesMutation.isPending ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Calculating...
                  </>
                ) : (
                  <>
                    📊 Calculate All Grades
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  if (!selectedClass || !selectedTerm) return;
                  if (confirm('This will recalculate grades and points for all results in this class. Continue?')) {
                    recalculatePointsMutation.mutate({ classId: selectedClass, termId: selectedTerm });
                  }
                }}
                disabled={!selectedClass || !selectedTerm || isLocked || recalculatePointsMutation.isPending}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                title="Calculate grades and points for all results"
              >
                {recalculatePointsMutation.isPending ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Calculating...
                  </>
                ) : (
                  <>
                    ⭐ Calculate All Points
                  </>
                )}
              </button>
              <button
                onClick={async () => {
                  if (!selectedTerm) return;
                  try {
                    await downloadTemplateFile(selectedTerm, selectedClass);
                  } catch (error: any) {
                    console.error('Download error:', error);
                    setMessage({ type: 'error', text: error.response?.data?.message || error.message || 'Failed to download template' });
                    setTimeout(() => setMessage(null), 5000);
                  }
                }}
                disabled={!selectedTerm}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Download Template
              </button>
            </div>
          </div>

          {resultsLoading ? (
            <div className="text-center py-12">Loading results...</div>
          ) : !selectedClass || !selectedTerm ? (
            <div className="text-center py-12 text-gray-500">Select a class and term to view results</div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No results found. {isLocked ? 'Results are locked.' : 'You can add results below.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-700 sticky left-0 bg-gray-50 z-10 min-w-[190px]">
                      Student
                    </th>
                    {subjectColumns.map((subject) => (
                      <th key={subject.id} title={subject.name} className="text-center py-3 px-2 font-medium text-gray-700 min-w-[92px]">
                        {subject.code || subject.name}
                      </th>
                    ))}
                    <th className="text-center py-3 px-3 font-medium text-gray-700">Total Points</th>
                  </tr>
                </thead>
                <tbody>
                  {studentRows.map((row) => {
                    const totalPoints = [...row.cells.values()].reduce(
                      (sum, r: any) => sum + (r.points ?? r.computed?.points ?? 0),
                      0,
                    );
                    return (
                      <tr key={row.student?.id} className="border-t hover:bg-gray-50">
                        <td className="py-2 px-4 font-medium sticky left-0 bg-white z-10">
                          {row.student?.firstName} {row.student?.lastName}
                        </td>
                        {subjectColumns.map((subject) => {
                          const result = row.cells.get(subject.id);
                          const isEditingThis =
                            editingCell &&
                            editingCell.studentId === row.student?.id &&
                            editingCell.subjectId === subject.id;
                          const canEdit = !isLocked;

                          if (!result) {
                            return (
                              <td key={subject.id} className="text-center py-2 px-2">
                                {canEdit ? (
                                  <button
                                    onClick={() =>
                                      setEditingCell({
                                        studentId: row.student?.id,
                                        subjectId: subject.id,
                                        resultId: null,
                                        score: null,
                                      })
                                    }
                                    className="text-gray-400 hover:text-blue-600 text-xs"
                                    title={`Add score for ${subject.name}`}
                                  >
                                    +
                                  </button>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                            );
                          }

                          const isAbsent =
                            result.isAbsent || result.absentCode || result.computed?.isAbsent;

                          if (isEditingThis) {
                            return (
                              <td key={subject.id} className="text-center py-2 px-2">
                                <div className="flex justify-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    autoFocus
                                    value={editingCell?.score ?? result.score ?? ''}
                                    onChange={(e) =>
                                      editingCell && setEditingCell({ ...editingCell, score: Number(e.target.value) })
                                    }
                                    className="w-16 px-1 py-0.5 border rounded text-center"
                                  />
                                  <button
                                    onClick={() => {
                                      const score = editingCell?.score;
                                      if (score === null || score === undefined || isNaN(score)) return;
                                      if (result.id) {
                                        updateResultMutation.mutate({ id: result.id, score });
                                      } else {
                                        createResultMutation.mutate({
                                          studentId: row.student?.id,
                                          subjectId: subject.id,
                                          termId: selectedTerm,
                                          score,
                                        });
                                      }
                                      setEditingCell(null);
                                    }}
                                    className="px-1.5 py-0.5 bg-green-600 text-white rounded text-xs"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingCell(null)}
                                    className="px-1.5 py-0.5 border rounded text-xs"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </td>
                            );
                          }

                          return (
                            <td key={subject.id} className="text-center py-2 px-2">
                              <div className="flex flex-col items-center group">
                                {isAbsent ? (
                                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                                    ABSENT
                                  </span>
                                ) : (
                                  <span className={`font-mono font-semibold ${result.score >= 75 ? 'text-green-700' : result.score >= 60 ? 'text-blue-700' : result.score >= 50 ? 'text-yellow-700' : 'text-red-700'}`}>
                                    {result.score?.toFixed(1) ?? '-'}
                                  </span>
                                )}
                                <span className="text-[10px] text-gray-400">
                                  {isAbsent ? '' : result.grade ? `Grade ${result.grade}` : ''}
                                </span>
                                {canEdit && (
                                  <span className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() =>
                                        setEditingCell({
                                          studentId: row.student?.id,
                                          subjectId: subject.id,
                                          resultId: result.id,
                                          score: result.score,
                                        })
                                      }
                                      className="text-blue-600 text-[10px] hover:underline"
                                    >
                                      edit
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (confirm('Delete this result?')) {
                                          deleteResultMutation.mutate(result.id);
                                        }
                                      }}
                                      className="text-red-600 text-[10px] hover:underline"
                                    >
                                      del
                                    </button>
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td className="text-center py-2 px-3 font-semibold">{totalPoints}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'review' && (
        <ReviewResultsTab
          resultsSummary={resultsSummary}
          completenessCheck={completenessCheck}
          summaryLoading={summaryLoading}
          completenessLoading={completenessLoading}
          onRefresh={() => {
            refetchSummary();
            refetchCompleteness();
          }}
          onRecalculateGrades={() => {
            if (selectedClass && selectedTerm) {
              recalculateGradesMutation.mutate({ classId: selectedClass, termId: selectedTerm });
            }
          }}
          isLocked={isLocked}
          isRecalculating={recalculateGradesMutation.isPending}
          onUnlock={async () => {
            if (confirm('Unlock results for editing? This will also unpublish results.')) {
              try {
                await publishingApi.unpublish(selectedClass, selectedTerm);
                alert('Results unlocked');
                refetchSummary();
              } catch (err: any) {
                alert('Failed to unlock: ' + (err.response?.data?.message || err.message));
              }
            }
          }}
        />
      )}

      {activeTab === 'assessments' && (
        <AssessmentTypesTab
          selectedSubject={selectedSubject}
          selectedTerm={selectedTerm}
          assessmentTypes={assessmentTypes}
          isLocked={isLocked}
          onRefresh={refetchAssessments}
        />
      )}

      {activeTab === 'publish' && (
        <PublishTab
          classes={classes}
          terms={terms}
          publishStatus={publishStatus}
          isLocked={isLocked}
          onPublish={publishMutation.mutate}
          resultsSummary={resultsSummary}
          completenessCheck={completenessCheck}
          selectedClass={selectedClass}
          selectedTerm={selectedTerm}
          isPublishing={publishMutation.isPending}
          totalStudents={resultsSummary?.totalStudents}
          completedReports={0}
        />
      )}

      {activeTab === 'reports' && (
        <ReportsTab
          selectedClass={selectedClass}
          selectedTerm={selectedTerm}
          publishStatus={publishStatus}
          onMessage={setMessage}
        />
      )}
    </div>
  );
}
