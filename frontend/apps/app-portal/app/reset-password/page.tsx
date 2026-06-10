'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';
import Link from 'next/link';

import '../super-admin-fix.css';

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError('Invalid or missing reset token. Please request a new password reset link.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (!token) {
      setError('Invalid reset token. Please request a new password reset link.');
      return;
    }

    setIsLoading(true);

    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message ||
        err?.response?.message ||
        err?.message ||
        'Failed to reset password. The link may have expired.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = (pwd: string) => {
    if (pwd.length === 0) return { label: '', color: '#d1d5db', width: '0%' };
    if (pwd.length < 8) return { label: 'Weak', color: '#ef4444', width: '33%' };
    if (pwd.length < 12 || !/[A-Z]/.test(pwd) || !/[0-9]/.test(pwd)) return { label: 'Medium', color: '#f59e0b', width: '66%' };
    return { label: 'Strong', color: '#059669', width: '100%' };
  };

  const strength = passwordStrength(password);

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
                Reset your password
              </h2>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                {success ? 'Password reset successful!' : 'Enter your new password below'}
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
                  <p style={{ fontSize: '14px', color: '#374151', marginBottom: '8px' }}>
                    Your password has been reset successfully!
                  </p>
                  <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '24px' }}>
                    Redirecting to login...
                  </p>
                  <Link
                    href="/login"
                    style={{
                      display: 'inline-block',
                      padding: '12px 24px',
                      background: '#ea6645',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '600',
                      borderRadius: '8px',
                      textDecoration: 'none'
                    }}
                  >
                    Go to login
                  </Link>
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
                      New Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#9ca3af'
                      }}>
                        <i className="fa fa-lock"></i>
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 40px 12px 40px',
                          fontSize: '14px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          outline: 'none',
                          transition: 'all 0.2s'
                        }}
                        placeholder="Enter new password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#9ca3af'
                        }}
                      >
                        <i className={`fa fa-${showPassword ? 'eye-slash' : 'eye'}`}></i>
                      </button>
                    </div>
                    {password && (
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ height: '4px', background: '#e8ddd0', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: strength.width,
                            background: strength.color,
                            borderRadius: '2px',
                            transition: 'all 0.3s'
                          }}></div>
                        </div>
                        <p style={{ fontSize: '12px', color: strength.color, marginTop: '4px' }}>
                          {strength.label}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '6px'
                    }}>
                      Confirm Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#9ca3af'
                      }}>
                        <i className="fa fa-lock"></i>
                      </span>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 12px 12px 40px',
                          fontSize: '14px',
                          border: confirmPassword && confirmPassword !== password ? '1px solid #ef4444' : '1px solid #d1d5db',
                          borderRadius: '8px',
                          outline: 'none',
                          transition: 'all 0.2s'
                        }}
                        placeholder="Confirm new password"
                        required
                      />
                    </div>
                    {confirmPassword && confirmPassword !== password && (
                      <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>
                        Passwords do not match
                      </p>
                    )}
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
                        Resetting password...
                      </>
                    ) : (
                      <>
                        <i className="fa fa-key"></i>
                        Reset Password
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
