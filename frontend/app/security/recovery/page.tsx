'use client';

import { useState } from 'react';
import { identityApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Key, Mail, User, Shield, ArrowLeft, CheckCircle,
  Loader2, Send, Smartphone,
} from 'lucide-react';
import Link from 'next/link';

export default function RecoveryPage() {
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [usernameEmail, setUsernameEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sent, setSent] = useState(false);

  const handleForgotPassword = async () => {
    if (!resetEmail) { toast.error('Please enter your email'); return; }
    setLoading(true);
    try {
      await identityApi.forgotPassword(resetEmail);
      setSent(true);
      toast.success('Recovery instructions sent if the account exists');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to process request');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotUsername = async () => {
    if (!usernameEmail) { toast.error('Please enter your email'); return; }
    setLoading(true);
    try {
      await identityApi.forgotUsername(usernameEmail);
      toast.success('Username sent if the account exists');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to process request');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetToken || !newPassword) { toast.error('Please fill all fields'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await identityApi.resetPasswordWithToken(resetToken, newPassword);
      toast.success('Password has been reset successfully');
      setResetToken('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Shield className="w-12 h-12 mx-auto text-blue-600" />
          <h1 className="text-2xl font-bold mt-4">Account Recovery</h1>
          <p className="text-muted-foreground">Recover access to your account</p>
        </div>

        <Link href="/login" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Login
        </Link>

        <Tabs defaultValue="forgot-password">
          <TabsList className="w-full">
            <TabsTrigger value="forgot-password" className="flex-1">Forgot Password</TabsTrigger>
            <TabsTrigger value="forgot-username" className="flex-1">Forgot Username</TabsTrigger>
            <TabsTrigger value="reset-password" className="flex-1">Reset Password</TabsTrigger>
          </TabsList>

          <TabsContent value="forgot-password">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Reset Your Password
                </CardTitle>
                <CardDescription>
                  Enter your email address and we will send you recovery instructions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sent ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
                    <p className="font-medium">Recovery email sent</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      If an account exists with that email, you will receive recovery instructions shortly.
                    </p>
                    <Button variant="outline" className="mt-4" onClick={() => setSent(false)}>
                      Send Again
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Email Address</label>
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                      />
                    </div>
                    <Button className="w-full" onClick={handleForgotPassword} disabled={loading}>
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      Send Recovery Instructions
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="forgot-username">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Recover Username
                </CardTitle>
                <CardDescription>
                  Enter your email address to receive your username.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Address</label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={usernameEmail}
                    onChange={(e) => setUsernameEmail(e.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={handleForgotUsername} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Send Username
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reset-password">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Set New Password
                </CardTitle>
                <CardDescription>
                  Enter the reset token from your email and your new password.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reset Token</label>
                  <Input
                    placeholder="Paste your reset token here"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">New Password</label>
                  <Input
                    type="password"
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Confirm Password</label>
                  <Input
                    type="password"
                    placeholder="Repeat your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={handleResetPassword} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
                  Reset Password
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
