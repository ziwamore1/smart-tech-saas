'use client';

import { useState, useEffect } from 'react';
import { communicationsCloudApi } from '@/lib/api';

const mockWallet = {
  platform: { sms: 12450, email: -1, whatsapp: 8230, push: -1 },
  schools: [
    { id: 'sch1', name: 'Lusaka Primary School', sms: 1200, email: -1, whatsapp: 450, push: -1 },
    { id: 'sch2', name: 'Ndola Girls Secondary', sms: 3400, email: -1, whatsapp: 890, push: -1 },
    { id: 'sch3', name: 'Kitwe Boys High', sms: 2100, email: -1, whatsapp: 320, push: -1 },
    { id: 'sch4', name: 'Mongu High School', sms: 780, email: -1, whatsapp: 150, push: -1 },
  ],
};

const mockTransactions = [
  { id: 'tx1', type: 'Recharge', amount: 5000, currency: 'ZMW', channel: 'SMS', description: 'SMS credit top-up', status: 'Completed', createdAt: '2026-07-01T10:30:00Z' },
  { id: 'tx2', type: 'Usage', amount: 1250, currency: 'ZMW', channel: 'SMS', description: 'Bulk fee reminder campaign', status: 'Completed', createdAt: '2026-06-28T08:15:00Z' },
  { id: 'tx3', type: 'Recharge', amount: 10000, currency: 'ZMW', channel: 'WhatsApp', description: 'WhatsApp template messages', status: 'Completed', createdAt: '2026-06-25T14:00:00Z' },
  { id: 'tx4', type: 'Usage', amount: 345, currency: 'ZMW', channel: 'SMS', description: 'Attendance alerts', status: 'Completed', createdAt: '2026-06-22T11:45:00Z' },
  { id: 'tx5', type: 'Recharge', amount: 2000, currency: 'ZMW', channel: 'SMS', description: 'Monthly SMS top-up', status: 'Pending', createdAt: '2026-07-02T09:00:00Z' },
  { id: 'tx6', type: 'Usage', amount: 780, currency: 'ZMW', channel: 'WhatsApp', description: 'Parent engagement campaign', status: 'Completed', createdAt: '2026-06-20T16:30:00Z' },
];

const mockPricing = [
  { channel: 'SMS', local: 0.35, international: 0.85, unit: 'per SMS' },
  { channel: 'Email', local: 0, international: 0, unit: 'free (unlimited)' },
  { channel: 'WhatsApp', local: 0.55, international: 0.95, unit: 'per message' },
  { channel: 'Push', local: 0, international: 0, unit: 'free (unlimited)' },
];

const statusBadge = (status: string) => {
  const m: Record<string, { bg: string; color: string }> = {
    Completed: { bg: '#d1fae5', color: '#059669' },
    Pending: { bg: '#fef3c7', color: '#d97706' },
    Failed: { bg: '#fee2e2', color: '#dc2626' },
    Refunded: { bg: '#e0e7ff', color: '#4338ca' },
  };
  return m[status] || { bg: '#f3f4f6', color: '#6b7280' };
};

export default function CreditsPage() {
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [pricing, setPricing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchool, setSelectedSchool] = useState<string | 'platform'>('platform');
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeChannel, setRechargeChannel] = useState('SMS');
  const [showRecharge, setShowRecharge] = useState(false);
  const [recharging, setRecharging] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [txRes, pRes] = await Promise.all([
          communicationsCloudApi.getTransactions('platform'),
          communicationsCloudApi.getPricing(),
        ]);
        const txBody = txRes.data?.statusCode ? txRes.data.data : txRes.data;
        const pBody = pRes.data?.statusCode ? pRes.data.data : pRes.data;
        setTransactions(Array.isArray(txBody) ? txBody : txBody?.transactions || []);
        setPricing(Array.isArray(pBody) ? pBody : pBody?.pricing || []);
        setWallet(mockWallet);
      } catch {
        setWallet(mockWallet);
        setTransactions(mockTransactions);
        setPricing(mockPricing);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleRecharge = async () => {
    if (!rechargeAmount || parseFloat(rechargeAmount) <= 0) return;
    setRecharging(true);
    try {
      const ownerId = selectedSchool === 'platform' ? 'platform' : selectedSchool;
      const ownerType = selectedSchool === 'platform' ? 'platform' : 'school';
      await communicationsCloudApi.rechargeWallet(`${ownerType}_${ownerId}`, { amount: parseFloat(rechargeAmount), channel: rechargeChannel });
      setShowRecharge(false);
      setRechargeAmount('');
    } catch {
      setShowRecharge(false);
    } finally {
      setRecharging(false);
    }
  };

  const formatBalance = (val: number) => val === -1 ? 'Unlimited' : val.toLocaleString();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .tx-row { transition: all 0.2s ease; }
        .tx-row:hover { background: #f5efe8; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="fa fa-coins" style={{ fontSize: '24px', color: 'white' }}></i>
        </div>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0' }}>Credits & Billing</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '2px 0 0' }}>Manage platform and school communication credits</p>
        </div>
      </div>

      {/* Wallet Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>View Wallet:</span>
        <select value={selectedSchool} onChange={(e) => setSelectedSchool(e.target.value)} style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '14px', outline: 'none', minWidth: '220px' }}>
          <option value="platform">Platform Wallet</option>
          {wallet?.schools?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Wallet Overview */}
      {selectedSchool === 'platform' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {[
            { channel: 'SMS', label: 'SMS Credits', balance: wallet?.platform?.sms ?? 0, icon: 'fa-comment-dots', color: '#d97706', bg: '#fef3c7' },
            { channel: 'Email', label: 'Email Balance', balance: wallet?.platform?.email ?? 0, icon: 'fa-envelope', color: '#2563eb', bg: '#dbeafe' },
            { channel: 'WhatsApp', label: 'WhatsApp Credits', balance: wallet?.platform?.whatsapp ?? 0, icon: 'fa-whatsapp', color: '#059669', bg: '#d1fae5' },
            { channel: 'Push', label: 'Push Credits', balance: wallet?.platform?.push ?? 0, icon: 'fa-bell', color: '#8b5cf6', bg: '#f5f3ff' },
          ].map((item) => (
            <div key={item.channel} style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`fa ${item.icon}`} style={{ fontSize: '20px', color: item.color }}></i>
                </div>
                <div>
                  <p style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0' }}>{formatBalance(item.balance)}</p>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '0' }}>{item.label}</p>
                </div>
              </div>
              <button onClick={() => { setRechargeChannel(item.channel); setShowRecharge(true); }} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: `1px solid ${item.color}`, background: `${item.bg}`, color: item.color, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                <i className="fa fa-plus-circle"></i> Recharge
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {(() => {
            const school = wallet?.schools?.find((s: any) => s.id === selectedSchool);
            if (!school) return null;
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {[
                  { channel: 'SMS', label: 'SMS Credits', balance: school.sms ?? 0, icon: 'fa-comment-dots', color: '#d97706', bg: '#fef3c7' },
                  { channel: 'Email', label: 'Email Balance', balance: school.email ?? 0, icon: 'fa-envelope', color: '#2563eb', bg: '#dbeafe' },
                  { channel: 'WhatsApp', label: 'WhatsApp Credits', balance: school.whatsapp ?? 0, icon: 'fa-whatsapp', color: '#059669', bg: '#d1fae5' },
                  { channel: 'Push', label: 'Push Credits', balance: school.push ?? 0, icon: 'fa-bell', color: '#8b5cf6', bg: '#f5f3ff' },
                ].map((item) => (
                  <div key={item.channel} style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className={`fa ${item.icon}`} style={{ fontSize: '20px', color: item.color }}></i>
                      </div>
                      <div>
                        <p style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0' }}>{formatBalance(item.balance)}</p>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0' }}>{item.label}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Transaction History + Pricing */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Transactions */}
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-exchange-alt" style={{ color: '#f59e0b' }}></i> Transaction History
          </h2>
          {transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
              <i className="fa fa-receipt" style={{ fontSize: '40px', display: 'block', marginBottom: '12px', opacity: 0.4 }}></i>
              <p style={{ margin: '0', fontSize: '14px' }}>No transactions yet</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e8ddd0' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Description</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Type</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Channel</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Amount</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const badge = statusBadge(tx.status);
                    return (
                      <tr key={tx.id} className="tx-row" style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: '12px' }}>{new Date(tx.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '10px 12px', color: '#1f2937', fontWeight: 500 }}>{tx.description}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: tx.type === 'Recharge' ? '#dbeafe' : '#fef3c7', color: tx.type === 'Recharge' ? '#2563eb' : '#d97706' }}>{tx.type}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#6b7280' }}>{tx.channel}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: tx.type === 'Recharge' ? '#059669' : '#dc2626' }}>
                          {tx.type === 'Recharge' ? '+' : '-'}{tx.amount.toLocaleString()} {tx.currency}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: badge.bg, color: badge.color }}>{tx.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pricing Table */}
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-tags" style={{ color: '#059669' }}></i> Pricing
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(pricing.length > 0 ? pricing : mockPricing).map((p: any) => (
              <div key={p.channel} style={{ padding: '14px', borderRadius: '12px', border: '1px solid #e8ddd0', background: '#fdfaf7' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: p.channel === 'SMS' ? '#fef3c7' : p.channel === 'Email' ? '#dbeafe' : p.channel === 'WhatsApp' ? '#d1fae5' : '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className={`fa ${p.channel === 'SMS' ? 'fa-comment-dots' : p.channel === 'Email' ? 'fa-envelope' : p.channel === 'WhatsApp' ? 'fa-whatsapp' : 'fa-bell'}`} style={{ fontSize: '14px', color: p.channel === 'SMS' ? '#d97706' : p.channel === 'Email' ? '#2563eb' : p.channel === 'WhatsApp' ? '#059669' : '#8b5cf6' }}></i>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{p.channel}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                  <span>Local</span>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{p.local === 0 ? 'Free' : `ZMW ${p.local.toFixed(2)}`}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280' }}>
                  <span>International</span>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{p.international === 0 ? 'Free' : `ZMW ${p.international.toFixed(2)}`}</span>
                </div>
                <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>{p.unit}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recharge Modal */}
      {showRecharge && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fefcf9', borderRadius: '20px', width: '400px', maxWidth: '90vw', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: '0' }}>Recharge Wallet</h2>
              <button onClick={() => setShowRecharge(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#6b7280', cursor: 'pointer' }}><i className="fa fa-times"></i></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '12px 16px', borderRadius: '10px', background: '#fdfaf7', border: '1px solid #e8ddd0' }}>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Channel</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className={`fa ${rechargeChannel === 'SMS' ? 'fa-comment-dots' : rechargeChannel === 'Email' ? 'fa-envelope' : rechargeChannel === 'WhatsApp' ? 'fa-whatsapp' : 'fa-bell'}`} style={{ color: rechargeChannel === 'SMS' ? '#d97706' : rechargeChannel === 'Email' ? '#2563eb' : rechargeChannel === 'WhatsApp' ? '#059669' : '#8b5cf6' }}></i>
                  {rechargeChannel === 'Email' ? 'Email (Unlimited)' : `${rechargeChannel} Credits`}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Amount (ZMW)</label>
                <input type="number" value={rechargeAmount} onChange={(e) => setRechargeAmount(e.target.value)} placeholder="e.g. 1000" min="1" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button onClick={handleRecharge} disabled={recharging || !rechargeAmount} style={{ flex: 1, padding: '12px', background: recharging ? '#9ca3af' : 'linear-gradient(135deg, #f59e0b, #fbbf24)', color: 'white', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: recharging || !rechargeAmount ? 'not-allowed' : 'pointer' }}>
                  {recharging ? 'Processing...' : 'Recharge Now'}
                </button>
                <button onClick={() => setShowRecharge(false)} style={{ padding: '12px 20px', background: '#f3f4f6', color: '#6b7280', borderRadius: '10px', border: '1px solid #e8ddd0', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
