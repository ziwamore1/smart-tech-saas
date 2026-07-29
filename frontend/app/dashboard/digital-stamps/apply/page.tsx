'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { digitalStampApi } from '@/lib/api';
import { DigitalStamp } from '@/components/stamps/DigitalStamp';
import type { DigitalStamp as StampType } from '@/types/stamps';
import type { StampConfig } from '@/types/stamps';

export default function ApplyStampPage() {
  const { user } = useAuth();
  const userRoles = user?.allRoles || user?.roles || [];
  const isDirector = userRoles.some((r: string) => ['Director', 'Deputy Director', 'Head Teacher', 'Deputy Head'].includes(r));
  const isAdmin = userRoles.some((r: string) => ['Deputy', 'HOD', 'Lower Primary Senior Teacher', 'Upper Primary Senior Teacher'].includes(r));

  const [stamps, setStamps] = useState<StampType[]>([]);
  const [selectedStampId, setSelectedStampId] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [note, setNote] = useState('');
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    loadStamps();
  }, []);

  const loadStamps = async () => {
    try {
      const res = await digitalStampApi.getStamps();
      const data = res.data?.stamps ?? res.data ?? [];
      setStamps(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load stamps:', err);
    }
  };

  const handleApply = async () => {
    if (!documentId || !selectedStampId) {
      alert('Please enter a document ID and select a stamp');
      return;
    }

    setApplying(true);
    try {
      const res = await digitalStampApi.applyStamp({
        documentId,
        stampId: selectedStampId,
        note: note.trim() || undefined,
      });
      setResult(res.data);
      alert('Stamp applied successfully');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to apply stamp');
    } finally {
      setApplying(false);
    }
  };

  const selectedStamp = stamps.find(s => s.id === selectedStampId);

  if (!isDirector && !isAdmin) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">🔒</div>
        <h2 className="text-lg font-semibold text-gray-900">Access Denied</h2>
        <p className="text-sm text-gray-500 mt-1">Only Directors and Admins can apply official stamps</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Apply Digital Stamp</h1>
        <p className="text-sm text-gray-500 mt-1">Apply an official stamp to a document</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Document Details</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Document ID *</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={documentId}
                onChange={e => setDocumentId(e.target.value)}
                placeholder="Enter document ID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={documentType}
                onChange={e => setDocumentType(e.target.value)}
              >
                <option value="">Select type</option>
                <option value="report">Report Card</option>
                <option value="transcript">Transcript</option>
                <option value="certificate">Certificate</option>
                <option value="letter">Official Letter</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                rows={3}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Add approval note..."
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Stamp</h2>

          {stamps.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No stamps available</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 mb-4">
              {stamps.map(stamp => (
                <button
                  key={stamp.id}
                  onClick={() => setSelectedStampId(stamp.id)}
                  className={`p-3 rounded-lg border-2 text-center transition-colors ${
                    selectedStampId === stamp.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-center mb-2">
                    <DigitalStamp
                      config={{
                        id: stamp.id,
                        name: stamp.name,
                        type: (stamp.type?.toLowerCase() as any) || 'official',
                        imageUrl: stamp.imageUrl,
                        svgContent: stamp.svgContent,
                      }}
                      width={60}
                      height={60}
                    />
                  </div>
                  <p className="text-xs font-medium text-gray-900">{stamp.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{stamp.type?.toLowerCase()}</p>
                </button>
              ))}
            </div>
          )}

          {selectedStamp && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900">Preview:</p>
              <div className="flex justify-center mt-2">
                <DigitalStamp
                  config={{
                    id: selectedStamp.id,
                    name: selectedStamp.name,
                    type: (selectedStamp.type?.toLowerCase() as any) || 'official',
                    imageUrl: selectedStamp.imageUrl,
                    svgContent: selectedStamp.svgContent,
                  }}
                  width={120}
                  height={120}
                />
              </div>
            </div>
          )}

          <button
            onClick={handleApply}
            disabled={applying || !documentId || !selectedStampId}
            className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {applying ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Applying...
              </span>
            ) : 'Apply Stamp'}
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-green-800">Stamp Applied Successfully</h3>
          <p className="text-xs text-green-700 mt-1 font-mono">Verification Hash: {result.verificationHash}</p>
        </div>
      )}
    </div>
  );
}
