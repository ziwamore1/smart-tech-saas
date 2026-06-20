'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subjectApi, curriculumIntelligenceApi } from '@/lib/api';

export default function TopicsPage() {
  const queryClient = useQueryClient();
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Topic modals
  const [showAddTopicModal, setShowAddTopicModal] = useState(false);
  const [showEditTopicModal, setShowEditTopicModal] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<any>(null);

  // Subtopic modals
  const [showAddSubtopicModal, setShowAddSubtopicModal] = useState(false);
  const [showEditSubtopicModal, setShowEditSubtopicModal] = useState(false);
  const [selectedSubtopic, setSelectedSubtopic] = useState<any>(null);
  const [activeTopicForSubtopic, setActiveTopicForSubtopic] = useState<string | null>(null);

  const [topicForm, setTopicForm] = useState({ name: '', code: '', description: '', sortOrder: 0 });
  const [editTopicForm, setEditTopicForm] = useState({ name: '', code: '', description: '', sortOrder: 0 });
  const [subtopicForm, setSubtopicForm] = useState({ name: '', code: '', description: '', sortOrder: 0 });
  const [editSubtopicForm, setEditSubtopicForm] = useState({ name: '', code: '', description: '', sortOrder: 0 });

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

  const { data: topicsResponse, isLoading: topicsLoading } = useQuery({
    queryKey: ['cie-topics', selectedSubjectId],
    queryFn: async () => {
      if (!selectedSubjectId) return [];
      const res = await curriculumIntelligenceApi.getTopics(selectedSubjectId);
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedSubjectId,
  });

  const topics = Array.isArray(topicsResponse) ? topicsResponse : [];

  const { data: subtopicsData } = useQuery({
    queryKey: ['subtopics', expandedTopicId],
    queryFn: async () => {
      if (!expandedTopicId) return [];
      const res = await curriculumIntelligenceApi.getSubtopics(expandedTopicId);
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!expandedTopicId,
  });

  const subtopics = Array.isArray(subtopicsData) ? subtopicsData : [];

  const filteredTopics = topics.filter((t: any) =>
    searchTerm === '' ||
    t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.code && t.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // Topic mutations
  const createTopicMutation = useMutation({
    mutationFn: (data: any) => curriculumIntelligenceApi.createTopic(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cie-topics', selectedSubjectId] });
      setShowAddTopicModal(false);
      setTopicForm({ name: '', code: '', description: '', sortOrder: 0 });
      showMessage('success', 'Topic created successfully!');
    },
    onError: (error: any) => {
      showMessage('error', error?.response?.data?.message || 'Failed to create topic.');
    },
  });

  const updateTopicMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => curriculumIntelligenceApi.updateTopic(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cie-topics', selectedSubjectId] });
      setShowEditTopicModal(false);
      setSelectedTopic(null);
      showMessage('success', 'Topic updated successfully!');
    },
    onError: (error: any) => {
      showMessage('error', error?.response?.data?.message || 'Failed to update topic.');
    },
  });

  const deleteTopicMutation = useMutation({
    mutationFn: (id: string) => curriculumIntelligenceApi.deleteTopic(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cie-topics', selectedSubjectId] });
      if (expandedTopicId === selectedTopic?.id) setExpandedTopicId(null);
      showMessage('success', 'Topic deleted successfully!');
    },
    onError: (error: any) => {
      showMessage('error', error?.response?.data?.message || 'Failed to delete topic.');
    },
  });

  // Subtopic mutations
  const createSubtopicMutation = useMutation({
    mutationFn: (data: any) => curriculumIntelligenceApi.createSubtopic(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtopics', activeTopicForSubtopic] });
      setShowAddSubtopicModal(false);
      setSubtopicForm({ name: '', code: '', description: '', sortOrder: 0 });
      showMessage('success', 'Subtopic created successfully!');
    },
    onError: (error: any) => {
      showMessage('error', error?.response?.data?.message || 'Failed to create subtopic.');
    },
  });

  const updateSubtopicMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => curriculumIntelligenceApi.updateSubtopic(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtopics', expandedTopicId] });
      setShowEditSubtopicModal(false);
      setSelectedSubtopic(null);
      showMessage('success', 'Subtopic updated successfully!');
    },
    onError: (error: any) => {
      showMessage('error', error?.response?.data?.message || 'Failed to update subtopic.');
    },
  });

  const deleteSubtopicMutation = useMutation({
    mutationFn: (id: string) => curriculumIntelligenceApi.deleteSubtopic(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtopics', expandedTopicId] });
      showMessage('success', 'Subtopic deleted successfully!');
    },
    onError: (error: any) => {
      showMessage('error', error?.response?.data?.message || 'Failed to delete subtopic.');
    },
  });

  function TopicModal({ isOpen, onClose, title, form, setForm, onSave, isPending }: any) {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <h2 className="text-2xl font-bold mb-2">{title}</h2>
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
                  placeholder="e.g., ENG-01" className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort Order</label>
                <input type="number" value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="flex gap-3 justify-end pt-4">
              <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={onSave} disabled={!form.name || isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                {isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function SubtopicModal({ isOpen, onClose, title, form, setForm, onSave, isPending }: any) {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <h2 className="text-2xl font-bold mb-2">{title}</h2>
          <p className="text-sm text-gray-500 mb-6">Subtopic</p>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort Order</label>
                <input type="number" value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="flex gap-3 justify-end pt-4">
              <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={onSave} disabled={!form.name || isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                {isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold text-gray-900">Topics & Subtopics</h1>
          <p className="text-gray-600 mt-1">Organize curriculum topics and their subtopics per subject</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            <select value={selectedSubjectId}
              onChange={(e) => { setSelectedSubjectId(e.target.value); setExpandedTopicId(null); setSearchTerm(''); }}
              className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select a subject...</option>
              {subjects.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Topics</label>
            <input type="text" value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or code..."
              disabled={!selectedSubjectId}
              className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div className="flex items-end justify-end">
            {selectedSubjectId && (
              <button onClick={() => {
                setTopicForm({ name: '', code: '', description: '', sortOrder: topics.length + 1 });
                setShowAddTopicModal(true);
              }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                + Add Topic
              </button>
            )}
          </div>
        </div>
      </div>

      {!selectedSubjectId ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">📂</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Subject</h3>
          <p className="text-gray-500">Choose a subject above to view its topics and subtopics.</p>
        </div>
      ) : topicsLoading ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading topics...</p>
        </div>
      ) : filteredTopics.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Topics Found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm ? 'Try a different search term.' : `No topics defined for ${selectedSubject?.name}.`}
          </p>
          {!searchTerm && (
            <button onClick={() => {
              setTopicForm({ name: '', code: '', description: '', sortOrder: 1 });
              setShowAddTopicModal(true);
            }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              + Add First Topic
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTopics.map((topic: any, index: number) => {
            const isExpanded = expandedTopicId === topic.id;
            const colors = [
              'border-l-blue-400', 'border-l-green-400', 'border-l-purple-400',
              'border-l-pink-400', 'border-l-indigo-400', 'border-l-amber-400',
              'border-l-teal-400', 'border-l-red-400',
            ];
            const colorClass = colors[index % colors.length];

            return (
              <div key={topic.id} className={`bg-white rounded-xl shadow-sm border-l-4 ${colorClass} overflow-hidden transition-all`}>
                <div
                  onClick={() => setExpandedTopicId(isExpanded ? null : topic.id)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                      <i className="fa fa-chevron-right text-gray-400"></i>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{topic.name}</span>
                        {topic.code && <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-500">{topic.code}</span>}
                      </div>
                      {topic.description && <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xl">{topic.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span className="bg-gray-100 px-2 py-1 rounded text-xs">#{topic.sortOrder || index + 1}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setActiveTopicForSubtopic(topic.id);
                        setSubtopicForm({ name: '', code: '', description: '', sortOrder: 1 });
                        setShowAddSubtopicModal(true);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                    >+ Subtopic</button>
                    <button
                      onClick={() => {
                        setSelectedTopic(topic);
                        setEditTopicForm({
                          name: topic.name || '', code: topic.code || '',
                          description: topic.description || '', sortOrder: topic.sortOrder || 0,
                        });
                        setShowEditTopicModal(true);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                    >✏️</button>
                    <button
                      onClick={() => { setSelectedTopic(topic); if (confirm(`Delete topic "${topic.name}"?`)) deleteTopicMutation.mutate(topic.id); }}
                      disabled={deleteTopicMutation.isPending}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                    >🗑️</button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/50">
                    {subtopics.length === 0 ? (
                      <div className="p-6 text-center text-sm text-gray-500">
                        No subtopics yet.{' '}
                        <button
                          onClick={() => {
                            setActiveTopicForSubtopic(topic.id);
                            setSubtopicForm({ name: '', code: '', description: '', sortOrder: 1 });
                            setShowAddSubtopicModal(true);
                          }}
                          className="text-blue-600 hover:underline font-medium"
                        >Add one</button>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {subtopics.map((st: any, stIndex: number) => (
                          <div key={st.id} className="flex items-center justify-between p-3 pl-14 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3 flex-1">
                              <span className="w-5 h-5 rounded-full bg-gray-200 text-xs flex items-center justify-center text-gray-600 font-medium">
                                {st.sortOrder || stIndex + 1}
                              </span>
                              <div>
                                <span className="text-sm font-medium text-gray-800">{st.name}</span>
                                {st.code && <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 ml-2">{st.code}</span>}
                                {st.description && <p className="text-xs text-gray-400 mt-0.5">{st.description}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setSelectedSubtopic(st);
                                  setEditSubtopicForm({
                                    name: st.name || '', code: st.code || '',
                                    description: st.description || '', sortOrder: st.sortOrder || 0,
                                  });
                                  setShowEditSubtopicModal(true);
                                }}
                                className="p-1.5 rounded text-xs font-medium text-amber-600 hover:bg-amber-50 transition-colors"
                              >✏️</button>
                              <button
                                onClick={() => { if (confirm(`Delete subtopic "${st.name}"?`)) deleteSubtopicMutation.mutate(st.id); }}
                                disabled={deleteSubtopicMutation.isPending}
                                className="p-1.5 rounded text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                              >🗑️</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Topic Modals */}
      <TopicModal isOpen={showAddTopicModal}
        onClose={() => setShowAddTopicModal(false)}
        title="Add Topic"
        form={topicForm} setForm={setTopicForm}
        onSave={() => createTopicMutation.mutate({ ...topicForm, subjectId: selectedSubjectId })}
        isPending={createTopicMutation.isPending} />

      <TopicModal isOpen={showEditTopicModal}
        onClose={() => { setShowEditTopicModal(false); setSelectedTopic(null); }}
        title="Edit Topic"
        form={editTopicForm} setForm={setEditTopicForm}
        onSave={() => {
          const cleanData = Object.fromEntries(Object.entries(editTopicForm).filter(([_, v]) => v !== ''));
          updateTopicMutation.mutate({ id: selectedTopic.id, data: cleanData });
        }}
        isPending={updateTopicMutation.isPending} />

      {/* Subtopic Modals */}
      <SubtopicModal isOpen={showAddSubtopicModal}
        onClose={() => setShowAddSubtopicModal(false)}
        title="Add Subtopic"
        form={subtopicForm} setForm={setSubtopicForm}
        onSave={() => createSubtopicMutation.mutate({ ...subtopicForm, topicId: activeTopicForSubtopic })}
        isPending={createSubtopicMutation.isPending} />

      <SubtopicModal isOpen={showEditSubtopicModal}
        onClose={() => { setShowEditSubtopicModal(false); setSelectedSubtopic(null); }}
        title="Edit Subtopic"
        form={editSubtopicForm} setForm={setEditSubtopicForm}
        onSave={() => {
          const cleanData = Object.fromEntries(Object.entries(editSubtopicForm).filter(([_, v]) => v !== ''));
          updateSubtopicMutation.mutate({ id: selectedSubtopic.id, data: cleanData });
        }}
        isPending={updateSubtopicMutation.isPending} />
    </div>
  );
}
