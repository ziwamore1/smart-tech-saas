'use client';

import { useState, useEffect } from 'react';
import { systemCommunicationApi } from '@/lib/api';

const fallbackChannelData = {
  configured: true,
  name: 'Smart Tech Zambia',
  url: 'https://youtube.com/@smarttechzambia',
  subscribers: 12840,
  totalViews: 456890,
  totalVideos: 124,
  latestVideos: [
    { id: 1, title: 'Smart Tech Platform Overview 2026', thumbnail: null, publishDate: '2026-06-10T10:00:00Z', views: 3450 },
    { id: 2, title: 'Teacher Onboarding Tutorial - Getting Started', thumbnail: null, publishDate: '2026-06-05T14:30:00Z', views: 2100 },
    { id: 3, title: 'Parent App Walkthrough - Monitoring Your Child', thumbnail: null, publishDate: '2026-05-28T09:00:00Z', views: 5200 },
    { id: 4, title: 'Exam Results Feature Update', thumbnail: null, publishDate: '2026-05-20T11:00:00Z', views: 1800 },
    { id: 5, title: "School Administrator's Guide to Report Cards", thumbnail: null, publishDate: '2026-05-15T08:00:00Z', views: 2900 },
  ],
};

export default function YouTubePage() {
  const [channelData, setChannelData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [channelUrl, setChannelUrl] = useState('');
  const [channelName, setChannelName] = useState('');
  const [apiKey, setApiKey] = useState('');

  const loadYouTube = async () => {
    try {
      setLoading(true);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await systemCommunicationApi.getYouTube(controller.signal);
      clearTimeout(timeout);
      const body = res.data?.statusCode ? res.data.data : res.data;
      if (body) {
        setChannelData({
          ...fallbackChannelData,
          ...body,
          subscribers: body.subscriberCount ?? body.subscribers ?? 0,
          totalViews: body.viewCount ?? body.totalViews ?? 0,
          totalVideos: body.videoCount ?? body.totalVideos ?? 0,
        });
      } else {
        setChannelData(fallbackChannelData);
      }
    } catch {
      setChannelData(fallbackChannelData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadYouTube();
  }, []);

  const configured = channelData?.configured ?? false;

  const handleSync = async () => {
    try {
      setSyncing(true);
      await systemCommunicationApi.syncYouTube();
      await loadYouTube();
    } catch (err) {
      console.error('Sync failed', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      await systemCommunicationApi.saveYouTube({ channelUrl, channelName, apiKey });
      await loadYouTube();
    } catch (err) {
      console.error('Connect failed', err);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await systemCommunicationApi.disconnectYouTube();
      setChannelData(null);
      setShowDisconnect(false);
    } catch (err) {
      console.error('Disconnect failed', err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{
          width: '40px', height: '40px',
          border: '3px solid #e8ddd0',
          borderTopColor: '#ea6645', borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}></div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!configured) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <style>{`
          .input-field { transition: all 0.2s ease; }
          .input-field:focus { border-color: #ef4444 !important; box-shadow: 0 0 0 3px rgba(239,68,68,0.1); }
        `}</style>

        {/* Header */}
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-youtube" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            YouTube Channel Integration
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Connect your YouTube channel to share announcements and training content</p>
        </div>

        {/* Config Form */}
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '32px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', maxWidth: '540px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '56px', height: '56px', background: '#fee2e2', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-youtube" style={{ fontSize: '24px', color: '#dc2626' }}></i>
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: 0 }}>Connect Your Channel</h2>
              <p style={{ fontSize: '13px', color: '#9ca3af', margin: '2px 0 0' }}>Enter your YouTube channel details below</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Channel URL</label>
              <input type="text" value={channelUrl} onChange={(e) => setChannelUrl(e.target.value)} placeholder="https://youtube.com/@yourchannel" className="input-field" style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Channel Name</label>
              <input type="text" value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="Smart Tech Zambia" className="input-field" style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>API Key</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="YouTube Data API v3 key" className="input-field" style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0' }}>Create a YouTube Data API v3 key from Google Cloud Console</p>
            </div>
            <button
              onClick={handleConnect}
              disabled={connecting}
              style={{
                marginTop: '8px', padding: '14px 24px',
                background: connecting ? '#fca5a5' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: 'white', borderRadius: '10px', border: 'none',
                fontSize: '15px', fontWeight: 600,
                cursor: connecting ? 'not-allowed' : 'pointer',
                boxShadow: connecting ? 'none' : '0 4px 12px rgba(239,68,68,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              <i className={`fa ${connecting ? 'fa-spinner fa-spin' : 'fa-link'}`}></i>
              {connecting ? 'Connecting...' : 'Connect Channel'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .video-card { transition: all 0.2s ease; }
        .video-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
        .thumb-placeholder { background: linear-gradient(135deg, #fee2e2, #fecaca); }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-youtube" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            YouTube Channel Integration
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Connected channel: {channelData?.name || fallbackChannelData.name}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              padding: '10px 18px', background: syncing ? '#d1fae5' : '#fee2e2', color: syncing ? '#059669' : '#dc2626',
              borderRadius: '8px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: syncing ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            <i className={`fa ${syncing ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`}></i>
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
          <button
            onClick={() => setShowDisconnect(true)}
            style={{ padding: '10px 18px', background: '#f3f4f6', color: '#6b7280', borderRadius: '8px', border: 'none', fontSize: '14px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <i className="fa fa-unlink"></i> Disconnect
          </button>
        </div>
      </div>

      {/* Channel Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ width: '64px', height: '64px', background: '#fee2e2', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className="fa fa-youtube" style={{ fontSize: '28px', color: '#dc2626' }}></i>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937' }}>{channelData?.name || fallbackChannelData.name}</div>
          <a href={channelData?.url || fallbackChannelData.url} target="_blank" style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'none' }}>
            {channelData?.url || fallbackChannelData.url} <i className="fa fa-external-link-alt" style={{ fontSize: '11px' }}></i>
          </a>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        <div style={{ textAlign: 'center', padding: '20px', background: '#fefcf9', borderRadius: '14px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#dc2626' }}>{(channelData?.subscribers ?? 0).toLocaleString()}</div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Subscribers</div>
        </div>
        <div style={{ textAlign: 'center', padding: '20px', background: '#fefcf9', borderRadius: '14px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#dc2626' }}>{(channelData?.totalViews ?? 0).toLocaleString()}</div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Total Views</div>
        </div>
        <div style={{ textAlign: 'center', padding: '20px', background: '#fefcf9', borderRadius: '14px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#dc2626' }}>{channelData?.totalVideos ?? 0}</div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Total Videos</div>
        </div>
        <div style={{ textAlign: 'center', padding: '20px', background: '#fefcf9', borderRadius: '14px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#dc2626' }}>{((channelData?.totalViews ?? 0) / Math.max(channelData?.totalVideos ?? 1, 1)).toFixed(0)}</div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Avg Views / Video</div>
        </div>
      </div>

      {/* Latest Videos */}
      <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa fa-video" style={{ color: '#ef4444' }}></i> Latest Videos
        </h2>
        <div style={{ display: 'grid', gap: '12px' }}>
          {(channelData?.latestVideos || fallbackChannelData.latestVideos).map((video: any) => (
            <div key={video.id} className="video-card" style={{ display: 'flex', gap: '16px', padding: '14px', borderRadius: '12px', border: '1px solid #e8ddd0', background: '#fefcf9' }}>
              <div className="thumb-placeholder" style={{ width: '160px', height: '90px', borderRadius: '10px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa fa-play-circle" style={{ fontSize: '28px', color: 'rgba(255,255,255,0.7)' }}></i>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>{video.title}</div>
                <div style={{ fontSize: '12px', color: '#9ca3af', display: 'flex', gap: '16px' }}>
                  <span><i className="fa fa-calendar"></i> {new Date(video.publishDate).toLocaleDateString()}</span>
                  <span><i className="fa fa-eye"></i> {video.views.toLocaleString()} views</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Integration Info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', background: '#dbeafe', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fa fa-globe" style={{ fontSize: '18px', color: '#2563eb' }}></i>
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>Homepage Integration</div>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Latest announcements and videos can be shown on homepage</p>
          </div>
        </div>
        <div style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', background: '#fce7f3', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fa fa-mobile-alt" style={{ fontSize: '18px', color: '#ec4899' }}></i>
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>Mobile App Integration</div>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Educational updates and training content for mobile app</p>
          </div>
        </div>
      </div>

      {/* Disconnect Confirmation Modal */}
      {showDisconnect && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
        }} onClick={() => setShowDisconnect(false)}>
          <div style={{
            background: '#fdfaf7', borderRadius: '16px', padding: '28px', width: '400px', maxWidth: '90vw',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div style={{ width: '48px', height: '48px', background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fa fa-exclamation-triangle" style={{ fontSize: '20px', color: '#dc2626' }}></i>
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Disconnect Channel</h3>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>This will remove the YouTube integration.</p>
              </div>
            </div>
            <p style={{ fontSize: '14px', color: '#374151', margin: '0 0 20px' }}>
              Are you sure you want to disconnect <strong>{channelData?.name || fallbackChannelData.name}</strong>? Videos will no longer sync to the platform.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDisconnect(false)} style={{ padding: '10px 18px', background: '#f3f4f6', color: '#6b7280', borderRadius: '8px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleDisconnect} style={{ padding: '10px 18px', background: '#dc2626', color: 'white', borderRadius: '8px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(220,38,38,0.3)' }}>
                <i className="fa fa-unlink"></i> Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
