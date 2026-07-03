'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import Link from 'next/link';

import '../super-admin-fix.css';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await authApi.forgotPassword(identifier);
      setSuccess(true);
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message ||
        err?.response?.message ||
        err?.message ||
        'Failed to send reset email. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#f5efe8',
      fontFamily: "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ width: '100%', maxWidth: '440px' }}>
          <div style={{
            background: '#fefcf9',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '32px 32px 24px', borderBottom: '1px solid #e8ddd0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, #ea6645, #f59e0b)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '18px'
                }}>
                  ST
                </div>
                <div>
                  <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                    Smart Tech SaaS
                  </h1>
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                    School Management System
                  </p>
                </div>
              </div>

              <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#1f2937', margin: '0 0 8px' }}>
                Forgot your password?
              </h2>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                {success
                  ? 'Check your email or phone for the reset link/code'
                  : 'Enter your email or phone number to receive a reset link/code'}
              </p>
            </div>

            <div style={{ padding: '24px 32px 32px' }}>
              {success ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    background: '#d1fae5',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px'
                  }}>
                    <i className="fa fa-check" style={{ fontSize: '32px', color: '#059669' }}></i>
                  </div>
                  <p style={{ fontSize: '14px', color: '#374151', marginBottom: '24px' }}>
                    We sent a password reset link to <strong>{identifier}</strong>
                  </p>
                  <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '24px' }}>
                    Didn&apos;t receive it? Check your spam folder or try again.
                  </p>
                  <button
                    onClick={() => setSuccess(false)}
                    style={{
                      display: 'inline-block',
                      padding: '10px 20px',
                      background: 'transparent',
                      color: '#ea6645',
                      fontSize: '14px',
                      fontWeight: '600',
                      border: '1px solid #ea6645',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      marginBottom: '16px'
                    }}
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {error && (
                    <div style={{
                      background: '#fee2e2',
                      color: '#991b1b',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <i className="fa fa-exclamation-circle"></i>
                      {error}
                    </div>
                  )}

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '6px'
                    }}>
                      Email or Phone Number
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#9ca3af'
                      }}>
                        <i className="fa fa-user"></i>
                      </span>
                      <input
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 12px 12px 40px',
                          fontSize: '14px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          outline: 'none',
                          transition: 'all 0.2s'
                        }}
                        placeholder="email@school.com or +260XXXXXXXXX"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: isLoading ? '#d1d5db' : '#ea6645',
                      color: 'white',
                      fontSize: '15px',
                      fontWeight: '600',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {isLoading ? (
                      <>
                        <i className="fa fa-spinner fa-spin"></i>
                        Sending reset link...
                      </>
                    ) : (
                      <>
                        <i className="fa fa-paper-plane"></i>
                        Send Reset Link
                      </>
                    )}
                  </button>
                </form>
              )}

              <div style={{
                marginTop: '24px',
                textAlign: 'center'
              }}>
                <Link
                  href="/login"
                  style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    textDecoration: 'none'
                  }}
                >
                  <i className="fa fa-arrow-left"></i>
                  Back to login
                </Link>
              </div>
            </div>
          </div>

          <div style={{
            marginTop: '24px',
            textAlign: 'center',
            fontSize: '13px',
            color: '#9ca3af'
          }}>
            <p style={{ margin: 0 }}>
              © 2025 Smart Tech SaaS. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
