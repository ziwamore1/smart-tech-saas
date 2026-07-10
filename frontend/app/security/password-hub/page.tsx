'use client';

import { useState, useEffect } from 'react';
import { identityApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Search, Shield, UserPlus, Lock, Unlock, RefreshCw, Send, Key,
  Smartphone, Monitor, AlertTriangle, CheckCircle, XCircle,
  Clock, Eye, EyeOff, Copy, Download, FileText, Loader2,
} from 'lucide-react';

export default function PasswordHubPage() {
  const { user, isSuperAdmin, isDirector } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserDetail, setShowUserDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, [roleFilter, statusFilter]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (roleFilter !== 'all') params.role = roleFilter;
      if (statusFilter !== 'all') params.accountStatus = statusFilter;
      if (search) params.search = search;
      const res = await identityApi.getPasswordHub(params);
      setUsers(res.data?.data || res.data || []);
    } catch (error: any) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string, userId: string) => {
    setActionLoading(`${action}-${userId}`);
    try {
      switch (action) {
        case 'generate':
          await identityApi.generateCredentials(userId);
          toast.success('Credentials generated and sent');
          break;
        case 'resend':
          await identityApi.resendCredentials(userId);
          toast.success('Credentials resent');
          break;
        case 'reset':
          const res = await identityApi.resetPassword(userId);
          toast.success('Password reset successfully');
          if (res.data?.newPassword) {
            navigator.clipboard.writeText(res.data.newPassword);
            toast.info('New password copied to clipboard');
          }
          break;
        case 'lock':
          await identityApi.lockAccount(userId);
          toast.success('Account locked');
          break;
        case 'unlock':
          await identityApi.unlockAccount(userId);
          toast.success('Account unlocked');
          break;
        case 'force-logout':
          await identityApi.forceLogoutUser(userId);
          toast.success('All devices logged out');
          break;
        case 'force-change':
          await identityApi.forcePasswordChange(userId);
          toast.success('Password change forced');
          break;
      }
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || `Action failed: ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      ACTIVE: { label: 'Active', className: 'text-green-600 bg-green-50 dark:bg-green-950/30' },
      LOCKED: { label: 'Locked', className: 'text-red-600 bg-red-50 dark:bg-red-950/30' },
      SUSPENDED: { label: 'Suspended', className: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30' },
      INACTIVE: { label: 'Inactive', className: 'text-muted-foreground' },
    };
    const config = variants[status] || { label: status, className: '' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  if (!isSuperAdmin && !isDirector) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-500" />
              Access Denied
            </CardTitle>
            <CardDescription>Only SuperAdmin and Director can access the Password Management Hub.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8 text-blue-600" />
            Password Management Hub
          </h1>
          <p className="text-muted-foreground mt-1">
            Centralized credential governance and identity security management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadUsers} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name, email, or username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="Student">Students</SelectItem>
                <SelectItem value="Parent">Parents</SelectItem>
                <SelectItem value="Teacher">Teachers</SelectItem>
                <SelectItem value="ClassTeacher">Class Teachers</SelectItem>
                <SelectItem value="Director">Directors</SelectItem>
                <SelectItem value="Staff">Staff</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="LOCKED">Locked</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={loadUsers} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Overview</CardTitle>
          <CardDescription>{users.length} user(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm font-medium text-muted-foreground">
                  <th className="pb-3 pr-4">User</th>
                  <th className="pb-3 pr-4">Roles</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">MFA</th>
                  <th className="pb-3 pr-4">Last Login</th>
                  <th className="pb-3 pr-4">Devices</th>
                  <th className="pb-3 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground">
                      No users found matching your criteria
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => { setSelectedUser(u); setShowUserDetail(true); }}>
                      <td className="py-3 pr-4">
                        <div>
                          <div className="font-medium">{u.firstName} {u.lastName}</div>
                          <div className="text-sm text-muted-foreground">{u.email}</div>
                          {u.username && <div className="text-xs text-muted-foreground">@{u.username}</div>}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {u.roles?.map((role: string) => (
                            <Badge key={role} variant="outline" className="text-xs">{role}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 pr-4">{getStatusBadge(u.accountStatus)}</td>
                      <td className="py-3 pr-4">
                        {u.mfaEnabled ? (
                          <Badge className="text-green-600 bg-green-50 dark:bg-green-950/30 text-xs">Enabled</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Disabled</Badge>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-sm text-muted-foreground">
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="py-3 pr-4 text-sm">{u.activeSessions || 0}</td>
                      <td className="py-3 pr-4">
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          {actionLoading === `generate-${u.id}` ? (
                            <Button size="icon" variant="outline" disabled>
                              <Loader2 className="w-4 h-4 animate-spin" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="outline" title="Generate Credentials" onClick={() => handleAction('generate', u.id)} className="hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all">
                              <Key className="w-4 h-4" />
                            </Button>
                          )}
                          {actionLoading === `reset-${u.id}` ? (
                            <Button size="icon" variant="outline" disabled>
                              <Loader2 className="w-4 h-4 animate-spin" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="outline" title="Reset Password" onClick={() => handleAction('reset', u.id)} className="hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300 transition-all">
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          )}
                          {u.accountStatus === 'LOCKED' ? (
                            actionLoading === `unlock-${u.id}` ? (
                              <Button size="icon" variant="outline" disabled>
                                <Loader2 className="w-4 h-4 animate-spin" />
                              </Button>
                            ) : (
                              <Button size="icon" variant="outline" title="Unlock Account" onClick={() => handleAction('unlock', u.id)} className="hover:bg-green-50 hover:text-green-600 hover:border-green-300 transition-all">
                                <Unlock className="w-4 h-4 text-green-500" />
                              </Button>
                            )
                          ) : (
                            actionLoading === `lock-${u.id}` ? (
                              <Button size="icon" variant="outline" disabled>
                                <Loader2 className="w-4 h-4 animate-spin" />
                              </Button>
                            ) : (
                              <Button size="icon" variant="outline" title="Lock Account" onClick={() => handleAction('lock', u.id)} className="hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all">
                                <Lock className="w-4 h-4 text-red-500" />
                              </Button>
                            )
                          )}
                          {actionLoading === `force-logout-${u.id}` ? (
                            <Button size="icon" variant="outline" disabled>
                              <Loader2 className="w-4 h-4 animate-spin" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="outline" title="Force Logout" onClick={() => handleAction('force-logout', u.id)} className="hover:bg-purple-50 hover:text-purple-600 hover:border-purple-300 transition-all">
                              <Monitor className="w-4 h-4" />
                            </Button>
                          )}
                          {actionLoading === `resend-${u.id}` ? (
                            <Button size="icon" variant="outline" disabled>
                              <Loader2 className="w-4 h-4 animate-spin" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="outline" title="Resend Credentials" onClick={() => handleAction('resend', u.id)} className="hover:bg-teal-50 hover:text-teal-600 hover:border-teal-300 transition-all">
                              <Send className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={showUserDetail} onOpenChange={setShowUserDetail}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Account Details</DialogTitle>
            <DialogDescription>Full security and credential information</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="credentials">Credentials</TabsTrigger>
                <TabsTrigger value="sessions">Sessions</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Name</label>
                    <p className="font-medium">{selectedUser.firstName} {selectedUser.lastName}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Email</label>
                    <p className="font-medium">{selectedUser.email}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Username</label>
                    <p className="font-medium">{selectedUser.username || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Phone</label>
                    <p className="font-medium">{selectedUser.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Status</label>
                    <div>{getStatusBadge(selectedUser.accountStatus)}</div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">MFA</label>
                    <p className="font-medium">{selectedUser.mfaEnabled ? 'Enabled' : 'Disabled'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Failed Attempts</label>
                    <p className="font-medium">{selectedUser.failedAttempts}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Force Change Password</label>
                    <p className="font-medium">{selectedUser.mustChangePassword ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Last Login</label>
                    <p className="font-medium">{selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString() : 'Never'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Last Password Change</label>
                    <p className="font-medium">{selectedUser.lastPasswordChange ? new Date(selectedUser.lastPasswordChange).toLocaleString() : 'Never'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Created</label>
                    <p className="font-medium">{new Date(selectedUser.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="credentials" className="space-y-4 pt-4">
                {selectedUser.lastCredential ? (
                  <div className="space-y-2">
                    <div className="flex justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="text-sm"><strong>Username:</strong> {selectedUser.lastCredential.generatedUsername}</p>
                        <p className="text-sm"><strong>Channel:</strong> {selectedUser.lastCredential.deliveryChannel}</p>
                        <p className="text-sm"><strong>Status:</strong> {selectedUser.lastCredential.deliveryStatus}</p>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <p>Generated: {new Date(selectedUser.lastCredential.generatedAt).toLocaleDateString()}</p>
                        {selectedUser.lastCredential.deliveredAt && (
                          <p>Delivered: {new Date(selectedUser.lastCredential.deliveredAt).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleAction('resend', selectedUser.id)} disabled={actionLoading === `resend-${selectedUser.id}`}>
                      {actionLoading === `resend-${selectedUser.id}` ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      Resend Credentials
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Key className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No credentials generated yet</p>
                    <Button className="mt-4" size="sm" onClick={() => handleAction('generate', selectedUser.id)} disabled={actionLoading === `generate-${selectedUser.id}`}>
                      {actionLoading === `generate-${selectedUser.id}` ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
                      Generate Credentials
                    </Button>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="sessions" className="space-y-4 pt-4">
                <div className="text-center py-8 text-muted-foreground">
                  <Monitor className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Active Sessions: {selectedUser.activeSessions || 0}</p>
                  <p>Active Devices: {selectedUser.activeDevices || 0}</p>
                  <Button className="mt-4" size="sm" variant="destructive" onClick={() => handleAction('force-logout', selectedUser.id)} disabled={actionLoading === `force-logout-${selectedUser.id}`}>
                    {actionLoading === `force-logout-${selectedUser.id}` ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Monitor className="w-4 h-4 mr-2" />}
                    Force Logout All Devices
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="security" className="space-y-4 pt-4">
                <div className="flex gap-2">
                  {selectedUser.accountStatus === 'LOCKED' ? (
                    <Button size="sm" onClick={() => handleAction('unlock', selectedUser.id)} disabled={actionLoading === `unlock-${selectedUser.id}`}>
                      {actionLoading === `unlock-${selectedUser.id}` ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Unlock className="w-4 h-4 mr-2" />}
                      Unlock Account
                    </Button>
                  ) : (
                    <Button size="sm" variant="destructive" onClick={() => handleAction('lock', selectedUser.id)} disabled={actionLoading === `lock-${selectedUser.id}`}>
                      {actionLoading === `lock-${selectedUser.id}` ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                      Lock Account
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleAction('force-change', selectedUser.id)} disabled={actionLoading === `force-change-${selectedUser.id}`}>
                    {actionLoading === `force-change-${selectedUser.id}` ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    Force Password Change
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
