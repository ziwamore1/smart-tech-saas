'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportTemplateApi } from '@/lib/api';

interface ReportTemplate {
  id: string;
  name: string;
  isDefault: boolean;
  headerText?: string;
  footerText?: string;
  logoUrl?: string;
  stampUrl?: string;
  signatureUrl?: string;
  directorName?: string;
  includeLogo: boolean;
  includeStamp: boolean;
  includeSignature: boolean;
  includeUniversity: boolean;
  includeBestSix: boolean;
  includeRankings: boolean;
  includeComments: boolean;
  includeGrading: boolean;
  primaryColor: string;
  secondaryColor: string;
  remarksEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ReportTemplatesPage() {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);
  const [formData, setFormData] = useState<Partial<ReportTemplate>>({
    name: '',
    headerText: '',
    footerText: '',
    directorName: '',
    includeLogo: true,
    includeStamp: false,
    includeSignature: false,
    includeUniversity: true,
    includeBestSix: true,
    includeRankings: true,
    includeComments: true,
    includeGrading: true,
    primaryColor: '#1976d2',
    secondaryColor: '#f5f5f5',
    remarksEnabled: true,
    isDefault: false,
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['report-templates'],
    queryFn: async () => {
      const res = await reportTemplateApi.getAll();
      let data = res.data?.data || res.data || [];
      if (!Array.isArray(data)) data = [];
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => reportTemplateApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
      setMessage({ type: 'success', text: 'Template created successfully' });
      resetForm();
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to create template' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => reportTemplateApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
      setMessage({ type: 'success', text: 'Template updated successfully' });
      resetForm();
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update template' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reportTemplateApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
      setMessage({ type: 'success', text: 'Template deleted successfully' });
      setSelectedTemplate(null);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to delete template' });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      headerText: '',
      footerText: '',
      directorName: '',
      includeLogo: true,
      includeStamp: false,
      includeSignature: false,
      includeUniversity: true,
      includeBestSix: true,
      includeRankings: true,
      includeComments: true,
      includeGrading: true,
      primaryColor: '#1976d2',
      secondaryColor: '#f5f5f5',
      remarksEnabled: true,
      isDefault: false,
    });
    setEditingTemplate(null);
    setShowForm(false);
  };

  const handleEdit = (template: ReportTemplate) => {
    setEditingTemplate(template);
    setFormData({ ...template });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleUpload = async (type: 'stamp' | 'signature' | 'logo', file: File) => {
    if (!editingTemplate) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      let result;
      if (type === 'stamp') {
        result = await reportTemplateApi.uploadStamp(editingTemplate.id, formData);
      } else if (type === 'signature') {
        result = await reportTemplateApi.uploadSignature(editingTemplate.id, formData);
      } else {
        result = await reportTemplateApi.uploadLogo(editingTemplate.id, formData);
      }
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
      setMessage({ type: 'success', text: `${type} uploaded successfully` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || `Failed to upload ${type}` });
    }
  };

  const selectedTemplateData = Array.isArray(templates) ? templates.find((t: ReportTemplate) => t.id === selectedTemplate) : null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Report Templates</h1>
          <p className="text-gray-600">Customize and manage your report card templates</p>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message.text}
            <button onClick={() => setMessage(null)} className="float-right font-bold">&times;</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Templates</h2>
                <button
                  onClick={() => { resetForm(); setShowForm(true); }}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  + New
                </button>
              </div>

              {isLoading ? (
                <div className="text-center py-4 text-gray-500">Loading...</div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No templates yet. Create your first template.
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template: ReportTemplate) => (
                    <div
                      key={template.id}
                      onClick={() => setSelectedTemplate(template.id)}
                      className={`p-3 rounded-lg cursor-pointer border ${
                        selectedTemplate === template.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{template.name}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(template.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        {template.isDefault && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            Default
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            {showForm ? (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">
                  {editingTemplate ? 'Edit Template' : 'Create New Template'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Template Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Director Name
                      </label>
                      <input
                        type="text"
                        value={formData.directorName || ''}
                        onChange={(e) => setFormData({ ...formData, directorName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Primary Color
                      </label>
                      <input
                        type="color"
                        value={formData.primaryColor}
                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Secondary Color
                      </label>
                      <input
                        type="color"
                        value={formData.secondaryColor}
                        onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                        className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Header Text
                    </label>
                    <textarea
                      value={formData.headerText || ''}
                      onChange={(e) => setFormData({ ...formData, headerText: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      rows={2}
                      placeholder="Text displayed at the top of the report"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Footer Text
                    </label>
                    <textarea
                      value={formData.footerText || ''}
                      onChange={(e) => setFormData({ ...formData, footerText: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      rows={2}
                      placeholder="Text displayed at the bottom of the report"
                    />
                  </div>

                  {editingTemplate && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Upload Logo
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUpload('logo', file);
                          }}
                          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        {editingTemplate.logoUrl && (
                          <img
                            src={editingTemplate.logoUrl}
                            alt="Logo"
                            className="mt-2 h-16 object-contain"
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Upload Stamp
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUpload('stamp', file);
                          }}
                          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        {editingTemplate.stampUrl && (
                          <img
                            src={editingTemplate.stampUrl}
                            alt="Stamp"
                            className="mt-2 h-16 object-contain"
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Upload Signature
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUpload('signature', file);
                          }}
                          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        {editingTemplate.signatureUrl && (
                          <img
                            src={editingTemplate.signatureUrl}
                            alt="Signature"
                            className="mt-2 h-16 object-contain"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Include in Report</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.includeLogo}
                          onChange={(e) => setFormData({ ...formData, includeLogo: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm">Logo</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.includeStamp}
                          onChange={(e) => setFormData({ ...formData, includeStamp: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm">Stamp</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.includeSignature}
                          onChange={(e) => setFormData({ ...formData, includeSignature: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm">Signature</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.includeRankings}
                          onChange={(e) => setFormData({ ...formData, includeRankings: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm">Rankings</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.includeComments}
                          onChange={(e) => setFormData({ ...formData, includeComments: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm">Comments</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.includeGrading}
                          onChange={(e) => setFormData({ ...formData, includeGrading: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm">Grading Legend</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.includeBestSix}
                          onChange={(e) => setFormData({ ...formData, includeBestSix: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm">Best Six Points</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.includeUniversity}
                          onChange={(e) => setFormData({ ...formData, includeUniversity: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm">University Eligible</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.remarksEnabled}
                          onChange={(e) => setFormData({ ...formData, remarksEnabled: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm">Subject Remarks</span>
                      </label>
                    </div>
                  </div>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isDefault}
                      onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium">Set as default template</span>
                  </label>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {createMutation.isPending || updateMutation.isPending
                        ? 'Saving...'
                        : editingTemplate
                        ? 'Update Template'
                        : 'Create Template'}
                    </button>
                  </div>
                </form>
              </div>
            ) : selectedTemplateData ? (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-xl font-semibold">{selectedTemplateData.name}</h2>
                    {selectedTemplateData.isDefault && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        Default Template
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(selectedTemplateData)}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    {!selectedTemplateData.isDefault && (
                      <button
                        onClick={() => {
                          if (confirm('Delete this template?')) {
                            deleteMutation.mutate(selectedTemplateData.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Primary Color</p>
                    <div className="flex items-center mt-1">
                      <div
                        className="w-6 h-6 rounded border mr-2"
                        style={{ backgroundColor: selectedTemplateData.primaryColor }}
                      />
                      <span className="text-sm font-mono">{selectedTemplateData.primaryColor}</span>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Secondary Color</p>
                    <div className="flex items-center mt-1">
                      <div
                        className="w-6 h-6 rounded border mr-2"
                        style={{ backgroundColor: selectedTemplateData.secondaryColor }}
                      />
                      <span className="text-sm font-mono">{selectedTemplateData.secondaryColor}</span>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Director Name</p>
                    <p className="text-sm font-medium mt-1">
                      {selectedTemplateData.directorName || 'Not set'}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Last Updated</p>
                    <p className="text-sm font-medium mt-1">
                      {new Date(selectedTemplateData.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {selectedTemplateData.logoUrl && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-2">Logo</p>
                      <img
                        src={selectedTemplateData.logoUrl}
                        alt="Logo"
                        className="h-16 object-contain"
                      />
                    </div>
                  )}
                  {selectedTemplateData.stampUrl && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-2">Stamp</p>
                      <img
                        src={selectedTemplateData.stampUrl}
                        alt="Stamp"
                        className="h-16 object-contain"
                      />
                    </div>
                  )}
                  {selectedTemplateData.signatureUrl && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-2">Signature</p>
                      <img
                        src={selectedTemplateData.signatureUrl}
                        alt="Signature"
                        className="h-16 object-contain"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Included Sections</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {selectedTemplateData.includeLogo && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                        Logo
                      </span>
                    )}
                    {selectedTemplateData.includeStamp && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                        Stamp
                      </span>
                    )}
                    {selectedTemplateData.includeSignature && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                        Signature
                      </span>
                    )}
                    {selectedTemplateData.includeRankings && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                        Rankings
                      </span>
                    )}
                    {selectedTemplateData.includeComments && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                        Comments
                      </span>
                    )}
                    {selectedTemplateData.includeGrading && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                        Grading Legend
                      </span>
                    )}
                    {selectedTemplateData.includeBestSix && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                        Best Six Points
                      </span>
                    )}
                    {selectedTemplateData.includeUniversity && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                        University Eligible
                      </span>
                    )}
                    {selectedTemplateData.remarksEnabled && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                        Subject Remarks
                      </span>
                    )}
                  </div>
                </div>

                {(selectedTemplateData.headerText || selectedTemplateData.footerText) && (
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedTemplateData.headerText && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Header Text</p>
                        <p className="text-sm bg-gray-50 p-2 rounded">{selectedTemplateData.headerText}</p>
                      </div>
                    )}
                    {selectedTemplateData.footerText && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Footer Text</p>
                        <p className="text-sm bg-gray-50 p-2 rounded">{selectedTemplateData.footerText}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-500">
                  Select a template to view details or create a new one
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
