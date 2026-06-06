'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { subscriptionApi } from '@/lib/api';

interface SubscriptionPlan {
  id: string;
  name: string;
  tier: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  limits: {
    students: number;
    teachers: number;
    classes: number;
    storage: number;
  };
  isActive: boolean;
}

const DEFAULT_PLANS: SubscriptionPlan[] = [
  { id: '1', name: 'Basic', tier: 'BASIC', price: 0, currency: 'USD', interval: 'monthly', features: ['Basic features'], limits: { students: 100, teachers: 20, classes: 10, storage: 5 }, isActive: true },
  { id: '2', name: 'Standard', tier: 'STANDARD', price: 49, currency: 'USD', interval: 'monthly', features: ['Standard features'], limits: { students: 500, teachers: 50, classes: 30, storage: 20 }, isActive: true },
  { id: '3', name: 'Premium', tier: 'PREMIUM', price: 99, currency: 'USD', interval: 'monthly', features: ['Premium features'], limits: { students: 1000, teachers: 100, classes: 50, storage: 50 }, isActive: true },
];

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  BASIC: { bg: '#f3f4f6', text: '#6b7280', border: '#e8ddd0' },
  STANDARD: { bg: '#dbeafe', text: '#2563eb', border: '#bfdbfe' },
  PREMIUM: { bg: '#f3e8ff', text: '#9333ea', border: '#e9d5ff' },
};

export default function SubscriptionPlansPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<SubscriptionPlan[]>(DEFAULT_PLANS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadPlans();
    }
  }, [isAuthenticated]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await subscriptionApi.getPlans();
      if (response.data?.data && Array.isArray(response.data.data)) {
        setPlans(response.data.data);
      } else if (Array.isArray(response.data)) {
        setPlans(response.data);
      }
    } catch (error) {
      console.error('Failed to load plans:', error);
      setPlans(DEFAULT_PLANS);
    } finally {
      setLoading(false);
    }
  };

  const handleEditPlan = async (planId: string, updates: Partial<SubscriptionPlan>) => {
    try {
      setSaving(true);
      await subscriptionApi.updatePlan(planId, updates);
      setPlans(plans.map(p => p.id === planId ? { ...p, ...updates } : p));
      setMessage({ type: 'success', text: 'Plan updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to update plan:', error);
      setMessage({ type: 'error', text: 'Failed to update plan' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
      setEditingPlan(null);
    }
  };

  const handleToggleActive = async (planId: string) => {
    try {
      setSaving(true);
      const plan = plans.find(p => p.id === planId);
      if (!plan) return;
      await subscriptionApi.updatePlan(planId, { isActive: !plan.isActive });
      setPlans(plans.map(p => p.id === planId ? { ...p, isActive: !p.isActive } : p));
      setMessage({ type: 'success', text: `Plan ${plan.isActive ? 'deactivated' : 'activated'}!` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to toggle plan:', error);
      setMessage({ type: 'error', text: 'Failed to toggle plan' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f5efe8'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'linear-gradient(135deg, #0d9488, #0f766e)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 700,
            fontSize: '18px'
          }}>
            <i className="fa fa-credit-card"></i>
          </div>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e8ddd0',
            borderTopColor: '#0d9488',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const editing = editingPlan ? plans.find(p => p.id === editingPlan) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .plan-card { transition: all 0.3s ease; }
        .plan-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.12); }
      `}</style>
      
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              background: 'linear-gradient(135deg, #0d9488, #0f766e)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <i className="fa fa-credit-card" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Subscription Plans
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Manage pricing plans and features</p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '10px',
          background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: message.type === 'success' ? '#065f46' : '#991b1b',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '14px',
          fontWeight: 500
        }}>
          <i className={`fa ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
          {message.text}
        </div>
      )}

      {/* Plans Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px'
      }}>
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="plan-card"
            style={{
              background: '#fefcf9',
              borderRadius: '20px',
              padding: '28px',
              border: plan.tier === 'PREMIUM' ? '2px solid #9333ea' : plan.tier === 'STANDARD' ? '2px solid #2563eb' : '1px solid #e8ddd0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {plan.tier === 'PREMIUM' && (
              <div style={{
                position: 'absolute',
                top: '16px',
                right: '-24px',
                background: 'linear-gradient(135deg, #9333ea, #7c3aed)',
                color: 'white',
                padding: '4px 32px',
                fontSize: '11px',
                fontWeight: 700,
                transform: 'rotate(45deg)',
                textTransform: 'uppercase'
              }}>
                Popular
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <span style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: '20px',
                  background: TIER_COLORS[plan.tier]?.bg || '#f3f4f6',
                  color: TIER_COLORS[plan.tier]?.text || '#6b7280',
                  border: `1px solid ${TIER_COLORS[plan.tier]?.border || '#e8ddd0'}`,
                  display: 'inline-block',
                  marginBottom: '8px'
                }}>
                  {plan.tier === 'PREMIUM' && '💎 '}{plan.tier === 'STANDARD' && '⭐ '}{plan.tier}
                </span>
                <h3 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{plan.name}</h3>
              </div>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <span style={{ fontSize: '36px', fontWeight: 700, color: '#1f2937' }}>${plan.price}</span>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>/{plan.interval}</span>
            </div>
            <div style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #f3f4f6' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Limits</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa fa-user-graduate" style={{ fontSize: '14px', color: '#2563eb' }}></i>
                  <span style={{ fontSize: '14px', color: '#374151' }}>{plan.limits?.students || 0} students</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa fa-chalkboard-teacher" style={{ fontSize: '14px', color: '#7c3aed' }}></i>
                  <span style={{ fontSize: '14px', color: '#374151' }}>{plan.limits?.teachers || 0} teachers</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa fa-school" style={{ fontSize: '14px', color: '#059669' }}></i>
                  <span style={{ fontSize: '14px', color: '#374151' }}>{plan.limits?.classes || 0} classes</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa fa-hdd" style={{ fontSize: '14px', color: '#d97706' }}></i>
                  <span style={{ fontSize: '14px', color: '#374151' }}>{plan.limits?.storage || 0} GB</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setEditingPlan(plan.id)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#f3f4f6',
                  borderRadius: '10px',
                  border: 'none',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <i className="fa fa-edit" style={{ fontSize: '12px', marginRight: '6px' }}></i>
                Edit
              </button>
              <button
                onClick={() => handleToggleActive(plan.id)}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: plan.isActive ? '#fee2e2' : '#d1fae5',
                  borderRadius: '10px',
                  border: 'none',
                  color: plan.isActive ? '#dc2626' : '#059669',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                <i className={`fa ${plan.isActive ? 'fa-ban' : 'fa-check'}`} style={{ fontSize: '12px', marginRight: '6px' }}></i>
                {plan.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#fefcf9',
            borderRadius: '16px',
            padding: '28px',
            maxWidth: '480px',
            width: '90%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', margin: '0 0 20px' }}>
              Edit Plan: {editing.name}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Plan Name</label>
                <input
                  type="text"
                  defaultValue={editing.name}
                  id={`name-${editing.id}`}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Price (USD)</label>
                <input
                  type="number"
                  defaultValue={editing.price}
                  id={`price-${editing.id}`}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Student Limit</label>
                <input
                  type="number"
                  defaultValue={editing.limits?.students || 100}
                  id={`students-${editing.id}`}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => setEditingPlan(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#fefcf9',
                  border: '1px solid #d1d5db',
                  borderRadius: '10px',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const name = (document.getElementById(`name-${editing.id}`) as HTMLInputElement)?.value;
                  const price = parseFloat((document.getElementById(`price-${editing.id}`) as HTMLInputElement)?.value) || 0;
                  const students = parseInt((document.getElementById(`students-${editing.id}`) as HTMLInputElement)?.value) || 100;
                  handleEditPlan(editing.id, { name, price, limits: { ...editing.limits, students } });
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'linear-gradient(135deg, #0d9488, #0f766e)',
                  borderRadius: '10px',
                  border: 'none',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}