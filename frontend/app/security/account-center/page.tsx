'use client';

import { useState, useEffect } from 'react';
import { identityApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  User, Shield, Mail, Phone, Key, Smartphone, Monitor,
  Clock, CheckCircle, XCircle, AlertTriangle, Save, Eye, EyeOff,
  Loader2,
} from 'lucide-react';

export default function AccountCenterPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accountData, setAccountData] = useState<any>(null);
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadAccountData();
  }, []);

  const loadAccountData = async () => {
    setLoading(true);
    try {
      const res = await identityApi.getAccountCenter();
      const data = res.data?.data || res.data;
      setAccountData(data);
      if (data?.profile) {
        setProfileForm({
          firstName: data.profile.firstName || '',
          lastName: data.profile.lastName || '',
          email: data.profile.email || '',
          phone: data.profile.phone || '',
        });
      }
    } catch (error: any) {
      toast.error('Failed to load account data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    setSaving(true);
    try {
      await identityApi.updateProfile(profileForm);
      toast.success('Profile updated successfully');
      loadAccountData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSaving(true);
    try {
      await identityApi.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      toast.success('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <User className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">Account Center</h1>
          <p className="text-muted-foreground">Manage your profile, security, and login credentials</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">First Name</label>
                <Input value={profileForm.firstName} onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Last Name</label>
                <Input value={profileForm.lastName} onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone</label>
              <Input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
            </div>
            <Button onClick={handleUpdateProfile} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security Overview</CardTitle>
            <CardDescription>Your account security status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Account Status</span>
              <Badge className={accountData?.security?.accountStatus === 'ACTIVE' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50 dark:bg-red-950/30'}>
                {accountData?.security?.accountStatus || 'Unknown'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">MFA Status</span>
              <Badge variant={accountData?.security?.mfaEnabled ? 'default' : 'secondary'}>
                {accountData?.security?.mfaEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Force Password Change</span>
              {accountData?.security?.mustChangePassword ? (
                <Badge className="text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30">Required</Badge>
              ) : (
                <Badge variant="secondary">No</Badge>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Failed Attempts</span>
              <span className="text-sm font-medium">{accountData?.security?.failedAttempts || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Last Login</span>
              <span className="text-sm">{accountData?.security?.lastLogin ? new Date(accountData.security.lastLogin).toLocaleDateString() : 'Never'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Last Password Change</span>
              <span className="text-sm">{accountData?.security?.lastPasswordChange ? new Date(accountData.security.lastPasswordChange).toLocaleDateString() : 'Never'}</span>
            </div>
            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1"><Monitor className="w-3 h-3" /> Active Sessions</span>
                <span className="font-medium">{accountData?.sessions?.activeSessions || 0}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="flex items-center gap-1"><Smartphone className="w-3 h-3" /> Active Devices</span>
                <span className="font-medium">{accountData?.sessions?.activeDevices || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your login password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Current Password</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">New Password</label>
            <Input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Confirm New Password</label>
            <Input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            />
          </div>
          <Button onClick={handleChangePassword} disabled={saving || !passwordForm.currentPassword || !passwordForm.newPassword}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
            Change Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
