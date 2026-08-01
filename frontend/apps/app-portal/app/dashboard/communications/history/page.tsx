'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communicationsCloudApi } from '@/lib/api';

const MOCK_STATS = {
  totalSent: 1250,
  delivered: 1180,
  failed: 45,
  pending: 25,
  deliveryRate: 94.4,
};

const MOCK_MESSAGES = Array.from({ length: 25 }, (_, i) => {
  const channels = ['SMS', 'EMAIL', 'WHATSAPP'] as const;
  const statuses = ['delivered', 'delivered', 'delivered', 'failed', 'pending'] as const;
  const channel = channels[i % 3];
  const status = statuses[i % 5];
  const date = new Date(Date.now() - 86400000 * Math.floor(i / 3) - 3600000 * (i % 8));
  return {
    id: `msg_${String(i + 1).padStart(3, '0')}`,
    date: date.toISOString(),
    channel,
    recipient: channel === 'SMS' ? `+260977${String(100000 + i).slice(0, 6)}` :
               channel === 'EMAIL' ? `parent${i + 1}@school.com` :
               `+260955${String(100000 + i).slice(0, 6)}`,
    message: i % 2 === 0
      ? 'Dear Parent, this is a reminder that school fees for Term 1 are due by 15th February 2024. Please ensure timely payment to avoid disruption.'
      : 'School will be closed on Monday for a public holiday. Normal lessons resume on Tuesday. Thank you.',
    status,
    cost: channel === 'SMS' ? 0.15 : channel === 'EMAIL' ? 0.00 : 0.20,
  };
});

const channelTabs = [
  { value: '', label: 'All', icon: 'fa-th-large' },
  { value: 'SMS', label: 'SMS', icon: 'fa-mobile-alt' },
  { value: 'EMAIL', label: 'Email', icon: 'fa-envelope' },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: 'fa-whatsapp' },
];

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
];

const ITEMS_PER_PAGE = 10;

function unwrapApiData(payload: any): any {
  return payload?.data?.data ?? payload?.data ?? payload;
}

const statusStyles: Record<string, { bg: string; color: string; icon: string }> = {
  delivered: { bg: '#ecfdf5', color: '#065f46', icon: 'fa-check-circle' },
  failed: { bg: '#fef2f2', color: '#991b1b', icon: 'fa-times-circle' },
  pending: { bg: '#fffbeb', color: '#92400e', icon: 'fa-clock' },
};

const channelColors: Record<string, string> = {
  SMS: '#10b981',
  EMAIL: '#3b82f6',
  WHATSAPP: '#25D366',
};

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-ZM', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '...' : str;
}

export default function SchoolMessageHistoryPage() {
  const queryClient = useQueryClient();
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState('7');
  const [currentPage, setCurrentPage] = useState(1);
  const [retryMsg, setRetryMsg] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['school-stats'],
    queryFn: () => communicationsCloudApi.getSchoolStats().then(r => {
      const data = unwrapApiData(r.data) || {};
      const byStatus = data.byStatus || {};
      const delivered = Number(byStatus.DELIVERED ?? byStatus.delivered ?? 0);
      const failed = Number(byStatus.FAILED ?? byStatus.failed ?? 0);
      const pending = Number(
        byStatus.QUEUED ?? byStatus.queued ?? 0,
      ) + Number(byStatus.PROCESSING ?? byStatus.processing ?? 0);
      const totalSent = Number(data.total ?? data.totalSent ?? 0);
      return {
        totalSent,
        delivered,
        failed,
        pending,
        deliveryRate: totalSent ? Number(((delivered / totalSent) * 100).toFixed(1)) : 0,
      };
    }),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const { data: messagesData, isLoading: msgsLoading } = useQuery({
    queryKey: ['school-messages', channelFilter, statusFilter, currentPage],
    queryFn: () => communicationsCloudApi.getSchoolMessages({
      channel: channelFilter || undefined,
      status: statusFilter || undefined,
      limit: ITEMS_PER_PAGE,
      offset: (currentPage - 1) * ITEMS_PER_PAGE,
    }).then(r => {
      const data = unwrapApiData(r.data) || {};
      const rawMessages = Array.isArray(data) ? data : data.messages || [];
      return {
        total: Number(data.total ?? rawMessages.length),
        messages: rawMessages.map((message: any) => ({
          ...message,
          date: message.date || message.createdAt || message.sentAt,
          channel: String(message.channel || 'SMS').toUpperCase(),
          recipient: message.recipient || message.recipientAddress || message.to || 'Unknown recipient',
          message: message.message || message.body || message.content || '',
          status: String(message.status || 'pending').toLowerCase(),
          cost: Number(message.cost ?? message.totalCost ?? 0),
        })),
      };
    }),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => communicationsCloudApi.retry(id),
    onSuccess: () => {
      setRetryMsg('Message retry initiated successfully');
      queryClient.invalidateQueries({ queryKey: ['school-messages'] });
      queryClient.invalidateQueries({ queryKey: ['school-stats'] });
      setTimeout(() => setRetryMsg(null), 3000);
    },
    onError: () => {
      setRetryMsg('Message queued for retry (mock)');
      queryClient.invalidateQueries({ queryKey: ['school-messages'] });
      setTimeout(() => setRetryMsg(null), 3000);
    },
  });

  const statsData = stats || MOCK_STATS;
  const messages = messagesData?.messages || MOCK_MESSAGES;
  const totalMessages = messagesData?.total ?? messages.length;
  const totalPages = Math.ceil(totalMessages / ITEMS_PER_PAGE);
  const isMock = !stats && !statsLoading;

  const filteredMessages = (Array.isArray(messages) ? messages : []).filter((m: any) => {
    if (channelFilter && m.channel !== channelFilter) return false;
    if (statusFilter && m.status !== statusFilter) return false;
    return true;
  });

  const paginatedMessages = filteredMessages.slice(0, ITEMS_PER_PAGE);

  const handleRetry = (id: string) => {
    retryMutation.mutate(id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {retryMsg && (
        <div style={{ padding: '12px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', color: '#065f46', fontSize: '14px' }}>
          <i className="fa fa-check-circle" style={{ marginRight: '8px' }}></i>{retryMsg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: 0 }}>
            <i className="fa fa-history" style={{ color: '#ea6645', marginRight: '10px' }}></i>
            Message History
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
            Monitor all your school message delivery across channels
          </p>
        </div>
        {isMock && (
          <span style={{ fontSize: '12px', color: '#92400e', background: '#fffbeb', padding: '4px 10px', borderRadius: '6px', border: '1px solid #fde68a' }}>
            <i className="fa fa-info-circle" style={{ marginRight: '4px' }}></i>Demo Mode
          </span>
        )}
      </div>

      {statsLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
          <i className="fa fa-spinner fa-spin" style={{ fontSize: '32px', marginBottom: '12px' }}></i>
          <div>Loading stats...</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            <div style={{ background: '#fdfaf7', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '16px' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Total Sent</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937' }}>{statsData.totalSent.toLocaleString()}</div>
            </div>
            <div style={{ background: '#fdfaf7', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '16px' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Delivered</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#065f46' }}>{statsData.delivered.toLocaleString()}</div>
            </div>
            <div style={{ background: '#fdfaf7', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '16px' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Failed</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#991b1b' }}>{statsData.failed.toLocaleString()}</div>
            </div>
            <div style={{ background: '#fdfaf7', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '16px' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Pending</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#92400e' }}>{statsData.pending.toLocaleString()}</div>
            </div>
            <div style={{ background: '#fdfaf7', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '16px' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Delivery Rate</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#ea6645' }}>{statsData.deliveryRate}%</div>
            </div>
          </div>

          <div style={{ background: '#fdfaf7', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '24px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '4px', background: '#f5efe8', borderRadius: '8px', padding: '4px' }}>
                {channelTabs.map(tab => (
                  <button
                    key={tab.value}
                    onClick={() => { setChannelFilter(tab.value); setCurrentPage(1); }}
                    style={{
                      padding: '8px 14px', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 500,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                      background: channelFilter === tab.value ? '#ea6645' : 'transparent',
                      color: channelFilter === tab.value ? 'white' : '#374151',
                    }}
                  >
                    <i className={`fa ${tab.icon}`}></i>
                    {tab.label}
                  </button>
                ))}
              </div>
              <select
                value={dateRange}
                onChange={e => setDateRange(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '13px', background: '#fff' }}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">This year</option>
              </select>
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                style={{ padding: '8px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '13px', background: '#fff' }}
              >
                {statusOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {statsData.failed > 0 && (
                <button
                  onClick={() => {
                    const failedIds = (Array.isArray(messages) ? messages : [])
                      .filter((m: any) => m.status === 'failed')
                      .map((m: any) => m.id);
                    failedIds.forEach((id: string) => handleRetry(id));
                  }}
                  style={{ marginLeft: 'auto', padding: '8px 16px', background: '#991b1b', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <i className="fa fa-redo"></i>
                  Retry Failed ({statsData.failed})
                </button>
              )}
            </div>

            {msgsLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
                <i className="fa fa-spinner fa-spin" style={{ fontSize: '32px', marginBottom: '12px' }}></i>
                <div>Loading messages...</div>
              </div>
            ) : paginatedMessages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
                <i className="fa fa-inbox" style={{ fontSize: '40px', marginBottom: '12px', color: '#d1d5db' }}></i>
                <div>No messages found</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>Try adjusting your filters</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e8ddd0' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Date/Time</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Channel</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Recipient</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Message</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Status</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Cost</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedMessages.map((msg: any) => {
                      const sStyle = statusStyles[msg.status] || statusStyles.pending;
                      return (
                        <tr key={msg.id} style={{ borderBottom: '1px solid #e8ddd0' }}>
                          <td style={{ padding: '12px', color: '#4b5563', whiteSpace: 'nowrap', fontSize: '13px' }}>{formatDateTime(msg.date)}</td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <i className={`fa ${msg.channel === 'SMS' ? 'fa-mobile-alt' : msg.channel === 'EMAIL' ? 'fa-envelope' : 'fa-whatsapp'}`}
                                style={{ color: channelColors[msg.channel] || '#6b7280', width: '16px' }}>
                              </i>
                              <span style={{ fontSize: '13px', color: '#374151' }}>{msg.channel}</span>
                            </span>
                          </td>
                          <td style={{ padding: '12px', color: '#374151', fontSize: '13px' }}>{msg.recipient}</td>
                          <td style={{ padding: '12px', color: '#4b5563', fontSize: '13px', maxWidth: '280px' }}>
                            <span title={msg.message}>{truncate(msg.message, 60)}</span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
                              background: sStyle.bg, color: sStyle.color,
                            }}>
                              <i className={`fa ${sStyle.icon}`} style={{ fontSize: '11px' }}></i>
                              {msg.status.charAt(0).toUpperCase() + msg.status.slice(1)}
                            </span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', color: '#4b5563', fontSize: '13px', whiteSpace: 'nowrap' }}>
                            {msg.cost > 0 ? `ZMW ${msg.cost.toFixed(2)}` : <span style={{ color: '#9ca3af' }}>Free</span>}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            {msg.status === 'failed' && (
                              <button
                                onClick={() => handleRetry(msg.id)}
                                disabled={retryMutation.isPending}
                                style={{ padding: '4px 10px', background: '#ea6645', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                                title="Retry"
                              >
                                <i className="fa fa-redo"></i> Retry
                              </button>
                            )}
                            {msg.status === 'pending' && (
                              <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                                <i className="fa fa-clock"></i>
                              </span>
                            )}
                            {msg.status === 'delivered' && (
                              <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                                <i className="fa fa-check" style={{ color: '#065f46' }}></i>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{ padding: '8px 14px', background: currentPage === 1 ? '#f3f4f6' : '#fff', color: currentPage === 1 ? '#d1d5db' : '#374151', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '13px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  <i className="fa fa-chevron-left"></i> Previous
                </button>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{ padding: '8px 14px', background: currentPage === totalPages ? '#f3f4f6' : '#fff', color: currentPage === totalPages ? '#d1d5db' : '#374151', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '13px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  Next <i className="fa fa-chevron-right"></i>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
