'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subjectApi, curriculumIntelligenceApi } from '@/lib/api';

const BLOOM_LEVELS = ['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE'] as const;

const BLOOM_COLORS: Record<string, string> = {
  REMEMBER: 'bg-blue-100 text-blue-700',
  UNDERSTAND: 'bg-green-100 text-green-700',
  APPLY: 'bg-orange-100 text-orange-700',
  ANALYZE: 'bg-purple-100 text-purple-700',
  EVALUATE: 'bg-red-100 text-red-700',
  CREATE: 'bg-pink-100 text-pink-700',
};

export default function CompetenciesPage() {
  const queryClient = useQueryClient();
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [filterEocId, setFilterEocId] = useState('');
  const [filterTopicId, setFilterTopicId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCompetency, setSelectedCompetency] = useState<any>(null);

  const [form, setForm] = useState({
    name: '', code: '', description: '', category: '',
    bloomLevel: '', topicId: '', subtopicId: '', eocId: '',
  });

  const [editForm, setEditForm] = useState({
    name: '', code: '', description: '', category: '',
    bloomLevel: '', topicId: '', subtopicId: '', eocId: '',
  });

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // Data
  const { data: subjectsResponse } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await subjectApi.getAll();
      return res.data?.data || res.data || [];
    },
  });
  const subjects = Array.isArray(subjectsResponse?.data) ? subjectsResponse.data :
    Array.isArray(subjectsResponse) ? subjectsResponse : [];

  const selectedSubject = subjects.find((s: any) => s.id === selectedSubjectId);

  const { data: eocsResponse } = useQuery({
    queryKey: ['eocs', selectedSubjectId],
    queryFn: async () => {
      if (!selectedSubjectId) return [];
      const res = await curriculumIntelligenceApi.getEocs(selectedSubjectId);
      const d = res.data?.data || res.data;
      return Array.isArray(d) ? d : [];
    },
    enabled: !!selectedSubjectId,
  });
  const eocs = Array.isArray(eocsResponse) ? eocsResponse : [];

  const { data: topicsResponse } = useQuery({
    queryKey: ['cie-topics', selectedSubjectId],
    queryFn: async () => {
      if (!selectedSubjectId) return [];
      const res = await curriculumIntelligenceApi.getTopics(selectedSubjectId);
      const d = res.data?.data || res.data;
      return Array.isArray(d) ? d : [];
    },
    enabled: !!selectedSubjectId,
  });
  const topics = Array.isArray(topicsResponse) ? topicsResponse : [];

  const { data: competenciesResponse, isLoading: loading } = useQuery({
    queryKey: ['competencies', selectedSubjectId, filterEocId, filterTopicId],
    queryFn: async () => {
      if (!selectedSubjectId) return [];
      const params: any = { subjectId: selectedSubjectId };
      if (filterEocId) params.eocId = filterEocId;
      if (filterTopicId) params.topicId = filterTopicId;
      const res = await curriculumIntelligenceApi.getCompetencies(params);
      const d = res.data?.data || res.data;
      return Array.isArray(d) ? d : [];
    },
    enabled: !!selectedSubjectId,
  });
  const competencies = Array.isArray(competenciesResponse) ? competenciesResponse : [];

  const filtered = competencies.filter((c: any) =>
    searchTerm === '' ||
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.code && c.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => curriculumIntelligenceApi.createCompetency(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competencies', selectedSubjectId] });
      setShowAddModal(false);
      setForm({ name: '', code: '', description: '', category: '', bloomLevel: '', topicId: '', subtopicId: '', eocId: '' });
      showMessage('success', 'Competency created successfully!');
    },
    onError: (error: any) => showMessage('error', error?.response?.data?.message || 'Failed to create.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => curriculumIntelligenceApi.updateCompetency(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competencies', selectedSubjectId] });
      setShowEditModal(false);
      setSelectedCompetency(null);
      showMessage('success', 'Competency updated successfully!');
    },
    onError: (error: any) => showMessage('error', error?.response?.data?.message || 'Failed to update.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => curriculumIntelligenceApi.deleteCompetency(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competencies', selectedSubjectId] });
      showMessage('success', 'Competency deleted successfully!');
    },
    onError: (error: any) => showMessage('error', error?.response?.data?.message || 'Failed to delete.'),
  });

  const eocMap = new Map(eocs.map((e: any) => [e.id, e]));
  const topicMap = new Map(topics.map((t: any) => [t.id, t]));

  return (
    <div className="space-y-6">
      {message && (
        <div className={`px-4 py-3 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>{message.text}</div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Competencies</h1>
          <p className="text-gray-600 mt-1">Define measurable skills and knowledge per subject</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            <select value={selectedSubjectId}
              onChange={(e) => { setSelectedSubjectId(e.target.value); setFilterEocId(''); setFilterTopicId(''); setSearchTerm(''); }}
              className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select a subject...</option>
              {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">EoC Filter</label>
            <select value={filterEocId} onChange={(e) => setFilterEocId(e.target.value)}
              disabled={!selectedSubjectId}
              className="w-full px-3 py-2 border rounded-lg">
              <option value="">All Constructs</option>
              {eocs.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Topic Filter</label>
            <select value={filterTopicId} onChange={(e) => setFilterTopicId(e.target.value)}
              disabled={!selectedSubjectId}
              className="w-full px-3 py-2 border rounded-lg">
              <option value="">All Topics</option>
              {topics.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex items-end justify-end gap-2">
            <input type="text" value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..." disabled={!selectedSubjectId}
              className="flex-1 px-3 py-2 border rounded-lg" />
            {selectedSubjectId && (
              <button onClick={() => {
                setForm({ name: '', code: '', description: '', category: '', bloomLevel: '', topicId: '', subtopicId: '', eocId: '' });
                setShowAddModal(true);
              }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap">
                + Add
              </button>
            )}
          </div>
        </div>
      </div>

      {!selectedSubjectId ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Subject</h3>
          <p className="text-gray-500">Choose a subject above to view its competencies.</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading competencies...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Competencies Found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || filterEocId || filterTopicId ? 'Try different filters.' : `No competencies defined for ${selectedSubject?.name}.`}
          </p>
          {!searchTerm && !filterEocId && !filterTopicId && (
            <button onClick={() => { setForm({ name: '', code: '', description: '', category: '', bloomLevel: '', topicId: '', subtopicId: '', eocId: '' }); setShowAddModal(true); }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">+ Add First Competency</button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b text-sm text-gray-600">
            <span className="font-semibold">{selectedSubject?.name}</span> — {filtered.length} competencies
            {(filterEocId || filterTopicId) && <span className="text-gray-400 ml-2">(filtered)</span>}
          </div>
          <div className="divide-y divide-gray-100">
            {filtered.map((comp: any) => (
              <div key={comp.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{comp.name}</span>
                      {comp.code && <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{comp.code}</span>}
                      {comp.bloomLevel && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BLOOM_COLORS[comp.bloomLevel] || 'bg-gray-100 text-gray-600'}`}>
                          {comp.bloomLevel}
                        </span>
                      )}
                    </div>
                    {comp.description && <p className="text-sm text-gray-500 mt-1">{comp.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      {comp.eocId && eocMap.has(comp.eocId) && (
                        <span><i className="fa fa-puzzle-piece mr-1 text-purple-400"></i>{eocMap.get(comp.eocId).name}</span>
                      )}
                      {comp.topicId && topicMap.has(comp.topicId) && (
                        <span><i className="fa fa-folder mr-1 text-cyan-400"></i>{topicMap.get(comp.topicId).name}</span>
                      )}
                      {comp.category && <span><i className="fa fa-tag mr-1"></i>{comp.category}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <button onClick={() => {
                      setSelectedCompetency(comp);
                      setEditForm({
                        name: comp.name || '', code: comp.code || '', description: comp.description || '',
                        category: comp.category || '', bloomLevel: comp.bloomLevel || '',
                        topicId: comp.topicId || '', subtopicId: comp.subtopicId || '', eocId: comp.eocId || '',
                      });
                      setShowEditModal(true);
                    }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-600 hover:bg-amber-100">✏️ Edit</button>
                    <button onClick={() => { if (confirm(`Delete "${comp.name}"?`)) deleteMutation.mutate(comp.id); }}
                      disabled={deleteMutation.isPending}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-2">Add Competency</h2>
            <p className="text-sm text-gray-500 mb-6">{selectedSubject?.name}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                <input type="text" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Code</label>
                  <input type="text" value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bloom Level</label>
                  <select value={form.bloomLevel}
                    onChange={(e) => setForm({ ...form, bloomLevel: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg">
                    <option value="">Select level...</option>
                    {BLOOM_LEVELS.map((bl) => <option key={bl} value={bl}>{bl}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Element of Construct</label>
                  <select value={form.eocId}
                    onChange={(e) => setForm({ ...form, eocId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg">
                    <option value="">None</option>
                    {eocs.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
                  <select value={form.topicId}
                    onChange={(e) => setForm({ ...form, topicId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg">
                    <option value="">None</option>
                    {topics.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <input type="text" value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g., Knowledge, Skills, Values"
                  className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={() => createMutation.mutate({ ...form, subjectId: selectedSubjectId })}
                  disabled={!form.name || createMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedCompetency && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-2">Edit Competency</h2>
            <p className="text-sm text-gray-500 mb-6">{selectedSubject?.name}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                <input type="text" value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Code</label>
                  <input type="text" value={editForm.code}
                    onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bloom Level</label>
                  <select value={editForm.bloomLevel}
                    onChange={(e) => setEditForm({ ...editForm, bloomLevel: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg">
                    <option value="">Select level...</option>
                    {BLOOM_LEVELS.map((bl) => <option key={bl} value={bl}>{bl}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Element of Construct</label>
                  <select value={editForm.eocId}
                    onChange={(e) => setEditForm({ ...editForm, eocId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg">
                    <option value="">None</option>
                    {eocs.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
                  <select value={editForm.topicId}
                    onChange={(e) => setEditForm({ ...editForm, topicId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg">
                    <option value="">None</option>
                    {topics.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <input type="text" value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={2} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button onClick={() => { setShowEditModal(false); setSelectedCompetency(null); }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={() => {
                  const cleanData = Object.fromEntries(Object.entries(editForm).filter(([_, v]) => v !== ''));
                  updateMutation.mutate({ id: selectedCompetency.id, data: cleanData });
                }}
                  disabled={!editForm.name || updateMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
