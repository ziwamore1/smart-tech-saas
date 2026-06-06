"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { timetableApi } from "@/lib/api";

type Props = {
  termId: string;
  onShowWizard?: () => void;
  onShowGenerator?: () => void;
  onShowLessonWizard?: () => void;
  onShowConflicts?: () => void;
  onLock?: () => void;
  isLocked?: boolean;
};

export default function TimetableToolbar({ 
  termId, 
  onShowWizard,
  onShowGenerator,
  onShowLessonWizard,
  onShowConflicts,
  onLock,
  isLocked = false
}: Props) {
  const router = useRouter();

  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleGenerate = async () => {
    if (!termId) {
      alert("No term selected");
      return;
    }
    try {
      setLoadingGenerate(true);
      await timetableApi.generateAllClasses(termId);
      alert("Timetable generation started");
    } catch (err) {
      alert("Generation failed");
    } finally {
      setLoadingGenerate(false);
    }
  };

  const handleExportPDF = () => {
    alert("Export to PDF feature ready for integration");
    setShowExportMenu(false);
  };

  const handlePrint = () => {
    handleExportPDF();
  };

  const handleExportPDF = () => {
    alert("Export to PDF feature ready for integration");
    setShowExportMenu(false);
  };

  const handleExportExcel = () => {
    alert("Export to Excel feature ready for integration");
    setShowExportMenu(false);
  };

  const handleExportImage = () => {
    alert("Export to Image feature ready for integration");
    setShowExportMenu(false);
  };

  return (
    <div className="flex items-center justify-between border-b px-4 py-3 bg-white shadow-sm rounded-lg">
      <div className="flex gap-2 flex-wrap">
        {onShowWizard && (
          <button
            onClick={onShowWizard}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg shadow-lg hover:shadow-xl transition flex items-center gap-2 font-medium"
          >
            <i className="fa fa-magic"></i>
            <span>Timetable Wizard</span>
          </button>
        )}

        {onShowGenerator && (
          <button
            onClick={onShowGenerator}
            className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg shadow-lg hover:shadow-xl transition flex items-center gap-2 font-medium"
          >
            <i className="fa fa-bolt"></i>
            <span>Generator</span>
          </button>
        )}

        <button
          onClick={handleGenerate}
          disabled={loadingGenerate}
          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg shadow-lg hover:shadow-xl transition disabled:opacity-50 flex items-center gap-2 font-medium"
        >
          <i className={`fa fa-${loadingGenerate ? 'spinner fa-spin' : 'robot'}`}></i>
          <span>{loadingGenerate ? "Generating..." : "Generate AI"}</span>
        </button>

        {onShowLessonWizard && (
          <button
            onClick={onShowLessonWizard}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg shadow-lg hover:shadow-xl transition flex items-center gap-2 font-medium"
          >
            <i className="fa fa-book-open"></i>
            <span>Lesson Wizard</span>
          </button>
        )}

        <button
          onClick={() => router.push("/timetable/constraints")}
          className="px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg shadow-lg hover:shadow-xl transition flex items-center gap-2 font-medium"
        >
          <i className="fa fa-sliders-h"></i>
          <span>Constraints</span>
        </button>

        {onShowConflicts && (
          <button
            onClick={onShowConflicts}
            className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg shadow-lg hover:shadow-xl transition flex items-center gap-2 font-medium"
          >
            <i className="fa fa-exclamation-triangle"></i>
            <span>Conflicts</span>
          </button>
        )}

        {onLock && (
          <button
            onClick={onLock}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 font-medium ${
              isLocked
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg hover:shadow-xl"
                : "bg-gray-200 hover:bg-gray-300 text-gray-700 shadow"
            }`}
          >
            <i className={`fa fa-${isLocked ? 'lock-open' : 'lock'}`}></i>
            <span>{isLocked ? "Unlock" : "Lock"}</span>
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <button
          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-gray-700"
          title="Undo"
        >
          ↶
        </button>

        <button
          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-gray-700"
          title="Redo"
        >
          ↷
        </button>

        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-gray-700 flex items-center gap-2"
          >
            <span>📤</span>
            <span>Export</span>
            <span className="text-xs">▼</span>
          </button>

          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-[160px]">
              <button
                onClick={handleExportPDF}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 rounded-t-lg"
              >
                📄 Export as PDF
              </button>
              <button
                onClick={handleExportExcel}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
              >
                📊 Export as Excel
              </button>
              <button
                onClick={handleExportImage}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 rounded-b-lg"
              >
                🖼️ Export as Image
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-gray-700 flex items-center gap-2"
        >
          <span>🖨️</span>
          <span>Print</span>
        </button>
      </div>
    </div>
  );
}
