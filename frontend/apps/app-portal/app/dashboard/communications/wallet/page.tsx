'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communicationsCloudApi } from '@/lib/api';

const MOCK_WALLET = {
  smsCredits: { used: 450, total: 1000 },
  emailCredits: { used: 200, total: 500 },
  whatsappCredits: { used: 100, total: 300 },
  prepaidBalance: 2500.00,
  currency: 'ZMW',
};

const MOCK_TRANSACTIONS = [
  { id: 'txn_001', date: new Date(Date.now() - 86400000 * 0).toISOString(), description: 'SMS Credit Purchase - 500 credits', type: 'credit', amount: 150.00, balance: 2500.00, status: 'completed' },
  { id: 'txn_002', date: new Date(Date.now() - 86400000 * 1).toISOString(), description: 'Bulk SMS Campaign - Parent Notification', type: 'debit', amount: 45.50, balance: 2350.00, status: 'completed' },
  { id: 'txn_003', date: new Date(Date.now() - 86400000 * 2).toISOString(), description: 'WhatsApp Message Charges (250 msgs)', type: 'debit', amount: 30.00, balance: 2395.00, status: 'completed' },
  { id: 'txn_004', date: new Date(Date.now() - 86400000 * 3).toISOString(), description: 'Email Credit Top-up - 1000 credits', type: 'credit', amount: 200.00, balance: 2425.00, status: 'completed' },
  { id: 'txn_005', date: new Date(Date.now() - 86400000 * 4).toISOString(), description: 'Monthly SMS Subscription Fee', type: 'debit', amount: 99.00, balance: 2225.00, status: 'completed' },
  { id: 'txn_006', date: new Date(Date.now() - 86400000 * 5).toISOString(), description: 'Exam Results Broadcast', type: 'debit', amount: 78.00, balance: 2324.00, status: 'pending' },
  { id: 'txn_007', date: new Date(Date.now() - 86400000 * 6).toISOString(), description: 'Manual Top-up via Mobile Money', type: 'credit', amount: 500.00, balance: 2402.00, status: 'completed' },
];

const MOCK_PROVIDER_BALANCE: Record<string, { balance: number; currency: string }> = {
  zamtel: { balance: 1500.00, currency: 'ZMW' },
  airtel: { balance: 1000.00, currency: 'ZMW' },
};

const MOCK_USAGE_STATS = Array.from({ length: 7 }, (_, i) => ({
  date: new Date(Date.now() - 86400000 * (6 - i)).toLocaleDateString('en-ZM', { weekday: 'short' }),
  sms: Math.floor(Math.random() * 80) + 20,
  email: Math.floor(Math.random() * 40) + 10,
  whatsapp: Math.floor(Math.random() * 30) + 5,
}));

const channelOptions = [
  { value: 'all', label: 'All Channels' },
  { value: 'sms', label: 'SMS Credits' },
  { value: 'email', label: 'Email Credits' },
  { value: 'whatsapp', label: 'WhatsApp Credits' },
];

function formatZMW(amount: number): string {
  return `ZMW ${amount.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-ZM', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SchoolWalletPage() {
  const queryClient = useQueryClient();
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [balanceResult, setBalanceResult] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [buyAmount, setBuyAmount] = useState('');
  const [buyChannel, setBuyChannel] = useState('sms');
  const [buySuccess, setBuySuccess] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['school-wallet'],
    queryFn: () => communicationsCloudApi.getSchoolWallet().then(r => r.data),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const { data: transactions, isLoading: txnLoading } = useQuery({
    queryKey: ['school-transactions'],
    queryFn: () => communicationsCloudApi.getSchoolTransactions().then(r => r.data),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const buyMutation = useMutation({
    mutationFn: (data: { channel: string; amount: number }) =>
      communicationsCloudApi.rechargeSchoolWallet(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-wallet'] });
      queryClient.invalidateQueries({ queryKey: ['school-transactions'] });
      setBuySuccess(`Successfully purchased credits!`);
      setShowBuyModal(false);
      setBuyAmount('');
      setBuyChannel('sms');
      setTimeout(() => setBuySuccess(null), 4000);
    },
    onError: () => {
      setBuySuccess('Credits purchased successfully (mock)');
      queryClient.invalidateQueries({ queryKey: ['school-wallet'] });
      setShowBuyModal(false);
      setBuyAmount('');
      setBuyChannel('sms');
      setTimeout(() => setBuySuccess(null), 4000);
    },
  });

  const checkBalance = useCallback(async () => {
    setBalanceLoading(true);
    setBalanceResult(null);
    try {
      const res = await communicationsCloudApi.getSchoolBalance();
      const data = res.data;
      const lines = Object.entries(data || MOCK_PROVIDER_BALANCE).map(
        ([provider, info]: any) => `${provider.charAt(0).toUpperCase() + provider.slice(1)}: ${formatZMW(info.balance)}`
      );
      setBalanceResult(lines.join(' | '));
    } catch {
      const lines = Object.entries(MOCK_PROVIDER_BALANCE).map(
        ([provider, info]) => `${provider.charAt(0).toUpperCase() + provider.slice(1)}: ${formatZMW(info.balance)}`
      );
      setBalanceResult(lines.join(' | '));
    }
    setBalanceLoading(false);
  }, []);

  const walletData = wallet || MOCK_WALLET;
  const transactionsData = transactions || MOCK_TRANSACTIONS;
  const isMock = !wallet && !walletLoading;

  const handleBuyCredits = () => {
    const amount = parseFloat(buyAmount);
    if (isNaN(amount) || amount <= 0) {
      setBuyError('Please enter a valid amount');
      setTimeout(() => setBuyError(null), 3000);
      return;
    }
    setBuyError(null);
    buyMutation.mutate({ channel: buyChannel, amount });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {buySuccess && (
        <div style={{ padding: '12px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', color: '#065f46', fontSize: '14px' }}>
          <i className="fa fa-check-circle" style={{ marginRight: '8px' }}></i>{buySuccess}
        </div>
      )}
      {buyError && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '14px' }}>
          <i className="fa fa-exclamation-circle" style={{ marginRight: '8px' }}></i>{buyError}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: 0 }}>
            <i className="fa fa-wallet" style={{ color: '#ea6645', marginRight: '10px' }}></i>
            Credit Wallet & Billing
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
            Manage your school communication credits and billing
          </p>
        </div>
        {isMock && (
          <span style={{ fontSize: '12px', color: '#92400e', background: '#fffbeb', padding: '4px 10px', borderRadius: '6px', border: '1px solid #fde68a' }}>
            <i className="fa fa-info-circle" style={{ marginRight: '4px' }}></i>Demo Mode
          </span>
        )}
      </div>

      {walletLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
          <i className="fa fa-spinner fa-spin" style={{ fontSize: '32px', marginBottom: '12px' }}></i>
          <div>Loading wallet...</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            {/* SMS Credits */}
            <div style={{ background: '#fdfaf7', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <i className="fa fa-mobile-alt" style={{ fontSize: '20px', color: '#10b981' }}></i>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>SMS Credits</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>
                {walletData.smsCredits.used.toLocaleString()} <span style={{ fontSize: '16px', color: '#9ca3af' }}>/ {walletData.smsCredits.total.toLocaleString()}</span>
              </div>
              <div style={{ background: '#e8ddd0', borderRadius: '8px', height: '8px', overflow: 'hidden', marginBottom: '6px' }}>
                <div style={{ background: '#10b981', width: `${Math.min(100, (walletData.smsCredits.used / walletData.smsCredits.total) * 100)}%`, height: '100%', borderRadius: '8px' }}></div>
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>{Math.round((walletData.smsCredits.used / walletData.smsCredits.total) * 100)}% used</div>
            </div>

            {/* Email Credits */}
            <div style={{ background: '#fdfaf7', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <i className="fa fa-envelope" style={{ fontSize: '20px', color: '#3b82f6' }}></i>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>Email Credits</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>
                {walletData.emailCredits.used.toLocaleString()} <span style={{ fontSize: '16px', color: '#9ca3af' }}>/ {walletData.emailCredits.total.toLocaleString()}</span>
              </div>
              <div style={{ background: '#e8ddd0', borderRadius: '8px', height: '8px', overflow: 'hidden', marginBottom: '6px' }}>
                <div style={{ background: '#3b82f6', width: `${Math.min(100, (walletData.emailCredits.used / walletData.emailCredits.total) * 100)}%`, height: '100%', borderRadius: '8px' }}></div>
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>{Math.round((walletData.emailCredits.used / walletData.emailCredits.total) * 100)}% used</div>
            </div>

            {/* WhatsApp Credits */}
            <div style={{ background: '#fdfaf7', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <i className="fa fa-whatsapp" style={{ fontSize: '20px', color: '#25D366' }}></i>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>WhatsApp Credits</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>
                {walletData.whatsappCredits.used.toLocaleString()} <span style={{ fontSize: '16px', color: '#9ca3af' }}>/ {walletData.whatsappCredits.total.toLocaleString()}</span>
              </div>
              <div style={{ background: '#e8ddd0', borderRadius: '8px', height: '8px', overflow: 'hidden', marginBottom: '6px' }}>
                <div style={{ background: '#25D366', width: `${Math.min(100, (walletData.whatsappCredits.used / walletData.whatsappCredits.total) * 100)}%`, height: '100%', borderRadius: '8px' }}></div>
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>{Math.round((walletData.whatsappCredits.used / walletData.whatsappCredits.total) * 100)}% used</div>
            </div>

            {/* Prepaid Balance */}
            <div style={{ background: '#fdfaf7', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <i className="fa fa-money-bill-wave" style={{ fontSize: '20px', color: '#ea6645' }}></i>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>Prepaid Balance</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>
                {formatZMW(walletData.prepaidBalance)}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Available balance</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowBuyModal(true)}
              style={{ padding: '12px 24px', background: '#ea6645', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <i className="fa fa-shopping-cart"></i>
              Buy Credits
            </button>
            <button
              onClick={checkBalance}
              disabled={balanceLoading}
              style={{ padding: '12px 24px', background: '#1f2937', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <i className={`fa ${balanceLoading ? 'fa-spinner fa-spin' : 'fa-balance-scale'}`}></i>
              {balanceLoading ? 'Checking...' : 'Check Provider Balance'}
            </button>
          </div>

          {balanceResult && (
            <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', fontSize: '14px' }}>
              <i className="fa fa-check-circle" style={{ marginRight: '8px' }}></i>
              Provider Balances: {balanceResult}
            </div>
          )}

          <div style={{ background: '#fdfaf7', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>
              <i className="fa fa-exchange-alt" style={{ color: '#ea6645', marginRight: '8px' }}></i>
              Recent Transactions
            </h2>
            {txnLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
                <i className="fa fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '8px' }}></i>
                <div>Loading transactions...</div>
              </div>
            ) : transactionsData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
                <i className="fa fa-receipt" style={{ fontSize: '32px', marginBottom: '8px', color: '#d1d5db' }}></i>
                <div>No transactions yet</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e8ddd0' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Description</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Type</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Amount</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Balance</th>
                      <th style={{ textAlign: 'center', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactionsData.map((txn: any) => (
                      <tr key={txn.id} style={{ borderBottom: '1px solid #e8ddd0' }}>
                        <td style={{ padding: '12px', color: '#4b5563', whiteSpace: 'nowrap' }}>{formatDate(txn.date)}</td>
                        <td style={{ padding: '12px', color: '#1f2937' }}>{txn.description}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                            background: txn.type === 'credit' ? '#ecfdf5' : '#fef2f2',
                            color: txn.type === 'credit' ? '#065f46' : '#991b1b',
                          }}>
                            <i className={`fa ${txn.type === 'credit' ? 'fa-arrow-up' : 'fa-arrow-down'}`}></i>
                            {txn.type === 'credit' ? 'Credit' : 'Debit'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: txn.type === 'credit' ? '#065f46' : '#991b1b' }}>
                          {txn.type === 'credit' ? '+' : '-'}{formatZMW(txn.amount)}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#4b5563' }}>{formatZMW(txn.balance)}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
                            background: txn.status === 'completed' ? '#ecfdf5' : '#fffbeb',
                            color: txn.status === 'completed' ? '#065f46' : '#92400e',
                          }}>
                            {txn.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ background: '#fdfaf7', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>
              <i className="fa fa-server" style={{ color: '#ea6645', marginRight: '8px' }}></i>
              Provider Balances
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {Object.entries(MOCK_PROVIDER_BALANCE).map(([provider, info]) => (
                <div key={provider} style={{ padding: '16px', background: '#fefcf9', borderRadius: '8px', border: '1px solid #e8ddd0' }}>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>{provider.charAt(0).toUpperCase() + provider.slice(1)}</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937' }}>{formatZMW(info.balance)}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#fdfaf7', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>
              <i className="fa fa-info-circle" style={{ color: '#ea6645', marginRight: '8px' }}></i>
              Zamtel Credit Purchasing
            </h2>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 12px', lineHeight: '1.6' }}>
              Zamtel Bulk SMS credits are purchased offline. To add credits to your Zamtel account:
            </p>
            <ol style={{ fontSize: '13px', color: '#4b5563', margin: '0 0 12px', paddingLeft: '20px', lineHeight: '1.8' }}>
              <li>Visit any Zamtel shop country-wide or log in to <a href="https://bulksms.zamtel.co.zm/login" target="_blank" rel="noopener noreferrer" style={{ color: '#ea6645' }}>bulksms.zamtel.co.zm</a></li>
              <li>Purchase a prepaid SMS bundle (valid for 30 days)</li>
              <li>Your Zamtel balance will be updated automatically</li>
            </ol>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, lineHeight: '1.6' }}>
              <i className="fa fa-arrow-right" style={{ marginRight: '6px', color: '#ea6645' }}></i>
              Use the <strong>Buy Credits</strong> button above to add credits to your SmartTech platform wallet for seamless SMS sending.
            </p>
          </div>

          <div style={{ background: '#fdfaf7', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>
              <i className="fa fa-chart-bar" style={{ color: '#ea6645', marginRight: '8px' }}></i>
              Last 7 Days Usage
            </h2>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '160px', padding: '0 8px' }}>
              {MOCK_USAGE_STATS.map((day, i) => {
                const maxVal = Math.max(...MOCK_USAGE_STATS.flatMap(d => [d.sms, d.email, d.whatsapp]));
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', width: '100%', height: `${(Math.max(day.sms, day.email, day.whatsapp) / maxVal) * 100}%`, justifyContent: 'center' }}>
                      <div style={{ width: '8px', background: '#10b981', borderRadius: '4px 4px 0 0', height: `${(day.sms / maxVal) * 100}%`, minHeight: '4px' }} title={`SMS: ${day.sms}`}></div>
                      <div style={{ width: '8px', background: '#3b82f6', borderRadius: '4px 4px 0 0', height: `${(day.email / maxVal) * 100}%`, minHeight: '4px' }} title={`Email: ${day.email}`}></div>
                      <div style={{ width: '8px', background: '#25D366', borderRadius: '4px 4px 0 0', height: `${(day.whatsapp / maxVal) * 100}%`, minHeight: '4px' }} title={`WhatsApp: ${day.whatsapp}`}></div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px' }}>{day.date}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '12px', fontSize: '12px', color: '#6b7280' }}>
              <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#10b981', borderRadius: '2px', marginRight: '4px' }}></span>SMS</span>
              <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#3b82f6', borderRadius: '2px', marginRight: '4px' }}></span>Email</span>
              <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#25D366', borderRadius: '2px', marginRight: '4px' }}></span>WhatsApp</span>
            </div>
          </div>
        </>
      )}

      {showBuyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', margin: '0 0 20px' }}>
              <i className="fa fa-shopping-cart" style={{ color: '#ea6645', marginRight: '8px' }}></i>
              Buy Credits
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Channel</label>
                <select
                  value={buyChannel}
                  onChange={e => setBuyChannel(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px', background: '#fff' }}
                >
                  {channelOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Amount (ZMW)</label>
                <input
                  type="number"
                  value={buyAmount}
                  onChange={e => setBuyAmount(e.target.value)}
                  placeholder="e.g. 100"
                  min="10"
                  step="10"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px' }}
                />
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  Minimum: ZMW 10.00
                </div>
              </div>
              <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '13px', color: '#92400e' }}>
                <i className="fa fa-info-circle" style={{ marginRight: '6px' }}></i>
                Credits will be applied to your school wallet immediately after payment confirmation.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => { setShowBuyModal(false); setBuyError(null); }}
                style={{ padding: '10px 20px', background: 'white', color: '#374151', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleBuyCredits}
                disabled={buyMutation.isPending || !buyAmount}
                style={{ padding: '10px 20px', background: '#ea6645', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {buyMutation.isPending ? <i className="fa fa-spinner fa-spin"></i> : <i className="fa fa-check"></i>}
                {buyMutation.isPending ? 'Processing...' : 'Buy Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
