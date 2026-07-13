'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communicationApi } from '@/lib/api';
import {
  CommunicationType,
  Communication,
  CommunicationStats,
  CommunicationTemplate,
  PlatformAnalytics,
  RealtimeAlert,
} from '@/types/communication';

const platformIcons: Record<string, string> = {
  SMS: '📱',
  EMAIL: '📧',
  WHATSAPP: '💬',
  FACEBOOK: '📘',
  YOUTUBE: '▶️',
  LINKEDIN: '💼',
  PUSH_NOTIFICATION: '🔔',
};

const platformColors: Record<string, string> = {
  SMS: 'bg-green-500',
  EMAIL: 'bg-blue-500',
  WHATSAPP: 'bg-green-600',
  FACEBOOK: 'bg-blue-600',
  YOUTUBE: 'bg-red-600',
  LINKEDIN: 'bg-blue-700',
  PUSH_NOTIFICATION: 'bg-purple-500',
};

export default function CommunicationsPage() {
  const queryClient = useQueryClient();
  const [selectedPlatform, setSelectedPlatform] = useState<CommunicationType>('SMS');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [recipientType, setRecipientType] = useState<string>('all');
  const [scheduledAt, setScheduledAt] = useState('');

  const { data: stats, isLoading: statsLoading } = useQuery<CommunicationStats>({
    queryKey: ['communication-stats'],
    queryFn: () => communicationApi.getStats().then(res => res.data),
  });

  const { data: communications, isLoading: commsLoading } = useQuery<{ communications: Communication[]; total: number }>({
    queryKey: ['communications', selectedPlatform],
    queryFn: () => communicationApi.getAll({ type: selectedPlatform }).then(res => res.data),
  });

  const { data: platformAnalytics } = useQuery<PlatformAnalytics>({
    queryKey: ['platform-analytics', selectedPlatform],
    queryFn: () => {
      switch (selectedPlatform) {
        case 'FACEBOOK':
          return communicationApi.getFacebookAnalytics().then(res => res.data);
        case 'YOUTUBE':
          return communicationApi.getYouTubeAnalytics().then(res => res.data);
        case 'LINKEDIN':
          return communicationApi.getLinkedInAnalytics().then(res => res.data);
        case 'WHATSAPP':
          return communicationApi.getWhatsAppAnalytics().then(res => res.data);
        default:
          return communicationApi.getFacebookAnalytics().then(res => res.data);
      }
    },
    enabled: ['FACEBOOK', 'YOUTUBE', 'LINKEDIN', 'WHATSAPP'].includes(selectedPlatform),
  });

  const { data: templates } = useQuery<CommunicationTemplate[]>({
    queryKey: ['communication-templates'],
    queryFn: () => communicationApi.getTemplates().then(res => res.data),
  });

  const { data: alerts } = useQuery<RealtimeAlert[]>({
    queryKey: ['realtime-alerts'],
    queryFn: () => communicationApi.getRealtimeAlerts().then(res => res.data),
    refetchInterval: 30000,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => communicationApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] });
      queryClient.invalidateQueries({ queryKey: ['communication-stats'] });
      setShowCreateModal(false);
      setMessage('');
      setSubject('');
      setRecipientType('all');
      setScheduledAt('');
    },
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => communicationApi.send(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] });
      queryClient.invalidateQueries({ queryKey: ['communication-stats'] });
    },
  });

  const sendAlertMutation = useMutation({
    mutationFn: (data: { message: string; priority?: string }) =>
      communicationApi.sendSMSAlert(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['realtime-alerts'] });
      setShowAlertsModal(false);
    },
  });

  const handleCreateCommunication = () => {
    createMutation.mutate({
      type: selectedPlatform,
      subject: subject || undefined,
      message,
      recipientType,
      scheduledAt: scheduledAt || undefined,
    });
  };

  const applyTemplate = (template: CommunicationTemplate) => {
    setSubject(template.subject || '');
    setMessage(template.message);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Communications Center</h1>
          <p className="text-gray-600 mt-1">Manage all school communications across multiple platforms</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAlertsModal(true)}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
          >
            <span>🚨</span> Real-time Alerts
            {alerts && Array.isArray(alerts) && alerts.length > 0 && (
              <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full">
                {alerts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ⚙️ Settings
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + New Communication
          </button>
        </div>
      </div>

      {stats && stats.total !== undefined && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-blue-600">{stats.total || 0}</div>
            <div className="text-gray-600">Total Communications</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-green-600">
              {stats.byStatus?.find(s => s.status === 'SENT')?.count || 0}
            </div>
            <div className="text-gray-600">Successfully Sent</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-yellow-600">
              {stats.byStatus?.find(s => s.status === 'PENDING')?.count || 0}
            </div>
            <div className="text-gray-600">Pending</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-red-600">
              {stats.byStatus?.find(s => s.status === 'FAILED')?.count || 0}
            </div>
            <div className="text-gray-600">Failed</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          <div className="flex gap-1 p-2 overflow-x-auto">
            {(['SMS', 'EMAIL', 'WHATSAPP', 'FACEBOOK', 'YOUTUBE', 'LINKEDIN', 'PUSH_NOTIFICATION'] as CommunicationType[]).map((platform) => (
              <button
                key={platform}
                onClick={() => setSelectedPlatform(platform)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  selectedPlatform === platform
                    ? `${platformColors[platform]} text-white`
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <span className="mr-2">{platformIcons[platform]}</span>
                {platform.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {platformAnalytics && platformAnalytics.overview && (
          <div className="p-6 border-b bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600">Total Posts</div>
                <div className="text-2xl font-bold">{platformAnalytics.overview.total || 0}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Delivery Rate</div>
                <div className="text-2xl font-bold text-green-600">
                  {platformAnalytics.overview.deliveryRate || 0}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Failed</div>
                <div className="text-2xl font-bold text-red-600">
                  {platformAnalytics.overview.failureRate || 0}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Pending</div>
                <div className="text-2xl font-bold text-yellow-600">
                  {platformAnalytics.overview.pending || 0}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="p-6">
          {commsLoading ? (
            <div className="text-center py-8 text-gray-600">Loading...</div>
          ) : communications?.communications?.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              No communications found for this platform
            </div>
          ) : (
            <div className="space-y-3">
              {communications?.communications?.map((comm) => (
                <div
                  key={comm.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`${platformColors[comm.type]} text-white text-xs px-2 py-1 rounded`}>
                          {platformIcons[comm.type]} {comm.type.replace('_', ' ')}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          comm.status === 'SENT' ? 'bg-green-100 text-green-800' :
                          comm.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          comm.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {comm.status}
                        </span>
                        {comm.scheduledAt && (
                          <span className="text-xs text-gray-500">
                            📅 Scheduled: {new Date(comm.scheduledAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {comm.subject && (
                        <h3 className="font-semibold text-gray-900">{comm.subject}</h3>
                      )}
                      <p className="text-gray-700 mt-1">{comm.message}</p>
                      <div className="text-xs text-gray-500 mt-2">
                        {comm.recipientType && <span>To: {comm.recipientType}</span>}
                        <span className="ml-2">
                          {comm.createdAt && new Date(comm.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {comm.status === 'PENDING' && (
                        <button
                          onClick={() => sendMutation.mutate(comm.id)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          Send Now
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Create New Communication</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Platform
                </label>
                <div className={`px-4 py-2 rounded-lg ${platformColors[selectedPlatform]} text-white`}>
                  {platformIcons[selectedPlatform]} {selectedPlatform.replace('_', ' ')}
                </div>
              </div>

              {(templates && Array.isArray(templates) && templates.some((t: any) => t.type === selectedPlatform)) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.filter((t: any) => t.type === selectedPlatform).map((template: any) => (
                    <button
                      key={template.id}
                      onClick={() => applyTemplate(template)}
                      className="w-full text-left px-3 py-2 border rounded hover:bg-gray-50"
                    >
                      <div className="font-medium">{template.name}</div>
                      <div className="text-sm text-gray-600">{template.message.substring(0, 50)}...</div>
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject {selectedPlatform !== 'SMS' && '(Optional)'}
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Enter subject..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Enter your message..."
                />
                <div className="text-xs text-gray-500 mt-1">
                  {message.length} characters
                  {selectedPlatform === 'SMS' && message.length > 160 && (
                    <span className="text-orange-600 ml-2">
                      (Will be sent as {Math.ceil(message.length / 160)} SMS)
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipients
                </label>
                <select
                  value={recipientType}
                  onChange={(e) => setRecipientType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="all">All Users</option>
                  <option value="student">Students Only</option>
                  <option value="parent">Parents Only</option>
                  <option value="teacher">Teachers Only</option>
                  <option value="director">Directors Only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Schedule (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCommunication}
                  disabled={!message || createMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {createMutation.isPending ? 'Creating...' : scheduledAt ? 'Schedule' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Communication Settings</h2>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded p-4">
                  <h3 className="font-semibold mb-3">📱 SMS</h3>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" /> Enable SMS
                    </label>
                    <input
                      type="text"
                      placeholder="API Key"
                      className="w-full px-3 py-2 border rounded"
                    />
                    <input
                      type="text"
                      placeholder="Sender ID"
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>
                </div>

                <div className="border rounded p-4">
                  <h3 className="font-semibold mb-3">📧 Email</h3>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" /> Enable Email
                    </label>
                    <input
                      type="text"
                      placeholder="SMTP Host"
                      className="w-full px-3 py-2 border rounded"
                    />
                    <input
                      type="text"
                      placeholder="Port"
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>
                </div>

                <div className="border rounded p-4">
                  <h3 className="font-semibold mb-3">💬 WhatsApp</h3>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" /> Enable WhatsApp
                    </label>
                    <input
                      type="text"
                      placeholder="API Key"
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>
                </div>

                <div className="border rounded p-4">
                  <h3 className="font-semibold mb-3">📘 Facebook</h3>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" /> Enable Facebook
                    </label>
                    <input
                      type="text"
                      placeholder="Page ID"
                      className="w-full px-3 py-2 border rounded"
                    />
                    <input
                      type="text"
                      placeholder="Access Token"
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>
                </div>

                <div className="border rounded p-4">
                  <h3 className="font-semibold mb-3">▶️ YouTube</h3>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" /> Enable YouTube
                    </label>
                    <input
                      type="text"
                      placeholder="Channel ID"
                      className="w-full px-3 py-2 border rounded"
                    />
                    <input
                      type="text"
                      placeholder="API Key"
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>
                </div>

                <div className="border rounded p-4">
                  <h3 className="font-semibold mb-3">💼 LinkedIn</h3>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" /> Enable LinkedIn
                    </label>
                    <input
                      type="text"
                      placeholder="Page ID"
                      className="w-full px-3 py-2 border rounded"
                    />
                    <input
                      type="text"
                      placeholder="Access Token"
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAlertsModal && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">🚨 Real-time Alerts</h2>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Send Emergency SMS Alert
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg"
                  placeholder="Enter alert message..."
                />
                <button
                  onClick={() => {
                    if (message) {
                      sendAlertMutation.mutate({ message, priority: 'high' });
                      setMessage('');
                    }
                  }}
                  disabled={!message || sendAlertMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
                >
                  {sendAlertMutation.isPending ? 'Sending...' : 'Send Alert'}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {(!alerts || !Array.isArray(alerts) || alerts.length === 0) ? (
                <div className="text-center py-8 text-gray-600">
                  No active alerts
                </div>
              ) : (
                alerts.map((alert: any, index: number) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 ${
                      alert.priority === 'high' ? 'border-red-300 bg-red-50' :
                      alert.priority === 'medium' ? 'border-yellow-300 bg-yellow-50' :
                      'border-blue-300 bg-blue-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">
                        {alert.priority === 'high' ? '🔴' :
                         alert.priority === 'medium' ? '🟡' : '🔵'}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium">{alert.message}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {new Date(alert.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setShowAlertsModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
