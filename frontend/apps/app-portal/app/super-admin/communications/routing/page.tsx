'use client';

import { useState, useEffect } from 'react';
import { communicationsCloudApi } from '@/lib/api';

const mockRules = [
  { id: 'r1', name: 'SMS Primary Route', channel: 'SMS', strategy: 'Priority', providerOrder: ['Beem Africa', 'Twilio'], conditions: [{ field: 'country', operator: 'eq', value: 'Zambia' }], isActive: true, priority: 1 },
  { id: 'r2', name: 'SMS Fallback', channel: 'SMS', strategy: 'Failover', providerOrder: ['Twilio', 'Beem Africa', 'Vonage'], conditions: [{ field: 'country', operator: 'ne', value: 'Zambia' }], isActive: true, priority: 2 },
  { id: 'r3', name: 'Email Primary', channel: 'Email', strategy: 'Priority', providerOrder: ['Zoho Mail', 'SendGrid'], conditions: [], isActive: true, priority: 1 },
  { id: 'r4', name: 'Email Bulk', channel: 'Email', strategy: 'RoundRobin', providerOrder: ['SendGrid', 'Mailgun', 'Zoho Mail'], conditions: [{ field: 'type', operator: 'eq', value: 'bulk' }], isActive: false, priority: 2 },
  { id: 'r5', name: 'WhatsApp Route', channel: 'WhatsApp', strategy: 'Priority', providerOrder: ['Twilio', 'MessageBird'], conditions: [], isActive: true, priority: 1 },
];

const channels = ['All', 'SMS', 'Email', 'WhatsApp', 'Push'];
const strategies = ['Priority', 'Failover', 'RoundRobin', 'LoadBalance'];
const operators = ['eq', 'ne', 'gt', 'lt', 'contains'];

const channelColors: Record<string, string> = {
  SMS: '#d97706', Email: '#2563eb', WhatsApp: '#059669', Push: '#8b5cf6',
};

export default function RoutingRulesPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    channel: 'SMS',
    strategy: 'Priority',
    providerOrder: [''],
    conditions: [{ field: '', operator: 'eq' as string, value: '' }],
    isActive: true,
    priority: 1,
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await communicationsCloudApi.getRoutingRules();
      const body = res.data?.statusCode ? res.data.data : res.data;
      setRules(Array.isArray(body) ? body : body?.rules || []);
    } catch {
      setRules(mockRules);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingRule(null);
    setForm({ name: '', channel: 'SMS', strategy: 'Priority', providerOrder: [''], conditions: [{ field: '', operator: 'eq', value: '' }], isActive: true, priority: rules.length + 1 });
    setShowModal(true);
  };

  const openEdit = (rule: any) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      channel: rule.channel,
      strategy: rule.strategy,
      providerOrder: rule.providerOrder?.length ? rule.providerOrder : [''],
      conditions: rule.conditions?.length ? rule.conditions : [{ field: '', operator: 'eq', value: '' }],
      isActive: rule.isActive,
      priority: rule.priority,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, conditions: form.conditions.filter(c => c.field && c.value) };
      if (editingRule) {
        await communicationsCloudApi.updateRoutingRule(editingRule.id, payload);
      } else {
        await communicationsCloudApi.createRoutingRule(payload);
      }
      setShowModal(false);
      fetchRules();
    } catch {
      if (editingRule) {
        setRules(prev => prev.map(r => r.id === editingRule.id ? { ...r, ...form } : r));
      } else {
        setRules(prev => [...prev, { id: `r_${Date.now()}`, ...form }]);
      }
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule: any) => {
    try {
      await communicationsCloudApi.toggleRoutingRule(rule.id, !rule.isActive);
    } catch {}
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, isActive: !r.isActive } : r));
  };

  const addProvider = () => setForm(f => ({ ...f, providerOrder: [...f.providerOrder, ''] }));
  const removeProvider = (i: number) => setForm(f => ({ ...f, providerOrder: f.providerOrder.filter((_, idx) => idx !== i) }));
  const updateProvider = (i: number, v: string) => setForm(f => {
    const updated = [...f.providerOrder];
    updated[i] = v;
    return { ...f, providerOrder: updated };
  });

  const addCondition = () => setForm(f => ({ ...f, conditions: [...f.conditions, { field: '', operator: 'eq', value: '' }] }));
  const removeCondition = (i: number) => setForm(f => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }));
  const updateCondition = (i: number, key: string, v: string) => setForm(f => {
    const updated = [...f.conditions];
    (updated[i] as any)[key] = v;
    return { ...f, conditions: updated };
  });

  const filtered = channelFilter === 'All' ? rules : rules.filter(r => r.channel === channelFilter);

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
        .rule-row { transition: all 0.2s ease; }
        .rule-row:hover { background: #f5efe8; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #f97316, #fb923c)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa fa-route" style={{ fontSize: '24px', color: 'white' }}></i>
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0' }}>Routing Rules</h1>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '2px 0 0' }}>Configure message routing across providers</p>
          </div>
        </div>
        <button onClick={openCreate} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #ea6645, #f97316)', color: 'white', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(234,102,69,0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa fa-plus"></i> New Rule
        </button>
      </div>

      {/* Channel Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: '#fdfaf7', padding: '4px', borderRadius: '10px', border: '1px solid #e8ddd0', width: 'fit-content' }}>
        {channels.map((ch) => (
          <button key={ch} onClick={() => setChannelFilter(ch)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: channelFilter === ch ? '#ea6645' : 'transparent', color: channelFilter === ch ? 'white' : '#6b7280', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
            {ch === 'All' ? 'All Channels' : <><i className={`fa ${ch === 'SMS' ? 'fa-comment-dots' : ch === 'Email' ? 'fa-envelope' : ch === 'WhatsApp' ? 'fa-whatsapp' : 'fa-bell'}`} style={{ marginRight: '6px' }}></i>{ch}</>}
          </button>
        ))}
      </div>

      {/* Rules Table */}
      <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
            <i className="fa fa-route" style={{ fontSize: '40px', display: 'block', marginBottom: '12px', opacity: 0.4 }}></i>
            <p style={{ margin: '0', fontSize: '14px' }}>No routing rules found</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e8ddd0' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Priority</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Channel</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Strategy</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Providers</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Active</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.sort((a, b) => a.priority - b.priority).map((rule) => (
                  <tr key={rule.id} className="rule-row" style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', color: '#6b7280', fontWeight: 500 }}>#{rule.priority}</td>
                    <td style={{ padding: '10px 12px', color: '#1f2937', fontWeight: 600 }}>{rule.name}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: `${channelColors[rule.channel] || '#6b7280'}20`, color: channelColors[rule.channel] || '#6b7280' }}>{rule.channel}</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#6b7280' }}>{rule.strategy}</td>
                    <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: '12px' }}>{(rule.providerOrder || []).join(', ')}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button onClick={() => toggleActive(rule)} style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: rule.isActive ? '#10b981' : '#d1d5db', cursor: 'pointer', position: 'relative', transition: 'all 0.2s' }}>
                        <span style={{ position: 'absolute', top: '2px', width: '20px', height: '20px', borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', left: rule.isActive ? '22px' : '2px', transition: 'all 0.2s' }}></span>
                      </button>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button onClick={() => openEdit(rule)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e8ddd0', background: '#fdfaf7', color: '#6b7280', fontSize: '12px', cursor: 'pointer' }}>
                        <i className="fa fa-edit"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fefcf9', borderRadius: '20px', width: '600px', maxWidth: '90vw', maxHeight: '85vh', overflow: 'auto', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: '0' }}>{editingRule ? 'Edit Rule' : 'Create Rule'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#6b7280', cursor: 'pointer' }}><i className="fa fa-times"></i></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Rule Name</label>
                <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. SMS Primary Route" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Channel</label>
                  <select value={form.channel} onChange={(e) => setForm(f => ({ ...f, channel: e.target.value }))} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '14px', outline: 'none' }}>
                    <option value="SMS">SMS</option>
                    <option value="Email">Email</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Push">Push</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Strategy</label>
                  <select value={form.strategy} onChange={(e) => setForm(f => ({ ...f, strategy: e.target.value }))} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '14px', outline: 'none' }}>
                    {strategies.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Priority</label>
                <input type="number" value={form.priority} onChange={(e) => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 1 }))} style={{ width: '80px', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '14px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Provider Order</label>
                {form.providerOrder.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                    <input value={p} onChange={(e) => updateProvider(i, e.target.value)} placeholder={`Provider ${i + 1}`} style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '13px', outline: 'none' }} />
                    {i > 0 && <button onClick={() => removeProvider(i)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}><i className="fa fa-times"></i></button>}
                  </div>
                ))}
                <button onClick={addProvider} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px dashed #e8ddd0', background: 'transparent', color: '#6b7280', fontSize: '12px', cursor: 'pointer' }}><i className="fa fa-plus"></i> Add Provider</button>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Conditions <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></label>
                {form.conditions.map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                    <input value={c.field} onChange={(e) => updateCondition(i, 'field', e.target.value)} placeholder="Field (e.g. country)" style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '13px', outline: 'none' }} />
                    <select value={c.operator} onChange={(e) => updateCondition(i, 'operator', e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '13px', outline: 'none' }}>
                      {operators.map(op => <option key={op} value={op}>{op}</option>)}
                    </select>
                    <input value={c.value} onChange={(e) => updateCondition(i, 'value', e.target.value)} placeholder="Value" style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '13px', outline: 'none' }} />
                    {i > 0 && <button onClick={() => removeCondition(i)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}><i className="fa fa-times"></i></button>}
                  </div>
                ))}
                <button onClick={addCondition} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px dashed #e8ddd0', background: 'transparent', color: '#6b7280', fontSize: '12px', cursor: 'pointer' }}><i className="fa fa-plus"></i> Add Condition</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="activeToggle" checked={form.isActive} onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))} style={{ accentColor: '#ea6645' }} />
                <label htmlFor="activeToggle" style={{ fontSize: '14px', color: '#374151' }}>Active</label>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button onClick={handleSave} disabled={saving || !form.name} style={{ flex: 1, padding: '12px', background: saving ? '#9ca3af' : 'linear-gradient(135deg, #ea6645, #f97316)', color: 'white', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: saving || !form.name ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}
                </button>
                <button onClick={() => setShowModal(false)} style={{ padding: '12px 20px', background: '#f3f4f6', color: '#6b7280', borderRadius: '10px', border: '1px solid #e8ddd0', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
