'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

import '../super-admin-fix.css';

function LoginForm() {
  const [loginMode, setLoginMode] = useState<'email' | 'phone' | 'student'>('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginAsSuperAdmin, setLoginAsSuperAdmin] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const registered = searchParams.get('registered');
  const successMessage = searchParams.get('message');
  const schoolId = searchParams.get('school');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(identifier, password, loginAsSuperAdmin, schoolId || undefined);
      
      if (loginAsSuperAdmin) {
        router.push('/super-admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const errorMessage = 
        err?.response?.data?.message || 
        err?.response?.message || 
        err?.message || 
        'Login failed. Please check your credentials.';
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
                {loginAsSuperAdmin ? 'System Owner Login' : 'Welcome back'}
              </h2>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                {loginAsSuperAdmin 
                  ? 'Sign in to manage schools and system settings' 
                  : 'Sign in to access your school dashboard'}
              </p>
            </div>

            <div style={{ padding: '24px 32px 32px' }}>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {successMessage && registered === 'true' && (
                  <div style={{
                    background: '#dcfce7',
                    color: '#166534',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <i className="fa fa-check-circle"></i>
                    {successMessage}
                  </div>
                )}
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
                    {loginMode === 'email' ? 'Email Address' : loginMode === 'phone' ? 'Phone Number' : 'Admission Number'}
                  </label>
                  {!loginAsSuperAdmin && (
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', background: '#f3f4f6', borderRadius: '8px', padding: '4px' }}>
                      {[
                        { mode: 'email' as const, label: 'Email', icon: 'fa-envelope' },
                        { mode: 'phone' as const, label: 'Phone', icon: 'fa-phone' },
                        { mode: 'student' as const, label: 'Student No.', icon: 'fa-graduation-cap' },
                      ].map((opt) => (
                        <button
                          key={opt.mode}
                          type="button"
                          onClick={() => { setLoginMode(opt.mode); setIdentifier(''); }}
                          style={{
                            flex: 1,
                            padding: '8px',
                            fontSize: '12px',
                            fontWeight: loginMode === opt.mode ? '600' : '500',
                            color: loginMode === opt.mode ? '#ea6645' : '#6b7280',
                            background: loginMode === opt.mode ? '#fefcf9' : 'transparent',
                            border: loginMode === opt.mode ? '1px solid #e8ddd0' : '1px solid transparent',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            transition: 'all 0.2s'
                          }}
                        >
                          <i className={`fa ${opt.icon}`} style={{ fontSize: '11px' }}></i>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af'
                    }}>
                      <i className={`fa fa-${loginMode === 'email' ? 'envelope' : loginMode === 'phone' ? 'phone' : 'graduation-cap'}`}></i>
                    </span>
                    <input
                      type={loginMode === 'email' ? 'email' : 'text'}
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
                      placeholder={
                        loginMode === 'email' ? 'you@school.com' :
                        loginMode === 'phone' ? '+260XXXXXXXXX' :
                        'e.g. STD/2025/001'
                      }
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    color: '#374151', 
                    marginBottom: '6px' 
                  }}>
                    Password
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
                      placeholder="Enter your password"
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
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    fontSize: '14px',
                    color: '#6b7280',
                    cursor: 'pointer'
                  }}>
                    <input type="checkbox" style={{ width: '16px', height: '16px' }} />
                    Remember me
                  </label>
                  <Link href="/forgot-password" style={{ fontSize: '14px', color: '#ea6645', textDecoration: 'none' }}>
                    Forgot password?
                  </Link>
                </div>

                <div style={{
                  padding: '12px',
                  background: loginAsSuperAdmin ? '#fef3c7' : '#f3f4f6',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: loginAsSuperAdmin ? '#f59e0b' : '#e8ddd0'
                }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    color: loginAsSuperAdmin ? '#92400e' : '#6b7280'
                  }}>
                    <input 
                      type="checkbox" 
                      checked={loginAsSuperAdmin}
                      onChange={(e) => setLoginAsSuperAdmin(e.target.checked)}
                      style={{ width: '16px', height: '16px' }} 
                    />
                    <i className={`fa ${loginAsSuperAdmin ? 'fa-user-shield' : 'fa-user'}`}></i>
                    Login as System Owner
                  </label>
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
                      Signing in...
                    </>
                  ) : (
                    <>
                      <i className="fa fa-sign-in"></i>
                      Sign In
                    </>
                  )}
                </button>
              </form>

              <div style={{ 
                marginTop: '24px', 
                paddingTop: '24px', 
                borderTop: '1px solid #e8ddd0',
                textAlign: 'center'
              }}>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 12px' }}>
                  Don&apos;t have an account?
                </p>
                <Link 
                  href={loginAsSuperAdmin ? '/super-admin-register' : '/register'} 
                  style={{
                    display: 'inline-block',
                    padding: '10px 20px',
                    background: 'transparent',
                    color: '#ea6645',
                    fontSize: '14px',
                    fontWeight: '600',
                    border: '1px solid #ea6645',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  {loginAsSuperAdmin ? 'Register as System Owner' : 'Register Your School'}
                </Link>
              </div>

              <div style={{ 
                marginTop: '24px', 
                textAlign: 'center' 
              }}>
                <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 12px' }}>
                  Back to
                </p>
                <Link 
                  href="/" 
                  style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa fa-home"></i>
                  Home Page
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
