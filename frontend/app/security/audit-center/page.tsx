'use client';

import { useState, useEffect } from 'react';
import { identityApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Shield, Search, RefreshCw, Clock, User, AlertTriangle,
  CheckCircle, XCircle, Lock, Key, LogIn, LogOut, Smartphone,
  Loader2, FileText, Download,
} from 'lucide-react';

const ACTION_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  LOGIN_SUCCESS: { label: 'Login Success', icon: LogIn, color: 'text-green-600' },
  LOGIN_FAILED: { label: 'Login Failed', icon: AlertTriangle, color: 'text-red-600' },
  PASSWORD_CHANGED: { label: 'Password Changed', icon: Key, color: 'text-blue-600' },
  PASSWORD_RESET_BY_ADMIN: { label: 'Password Reset (Admin)', icon: Key, color: 'text-yellow-600' },
  PASSWORD_RESET_COMPLETED: { label: 'Password Reset Completed', icon: Key, color: 'text-green-600' },
  PASSWORD_RESET_REQUESTED: { label: 'Password Reset Requested', icon: Key, color: 'text-orange-600' },
  PASSWORD_CHANGE_FORCED: { label: 'Password Change Forced', icon: Key, color: 'text-red-600' },
  PASSWORD_SET: { label: 'Password Set', icon: Key, color: 'text-blue-600' },
  ACCOUNT_LOCKED: { label: 'Account Locked', icon: Lock, color: 'text-red-600' },
  ACCOUNT_LOCKED_BY_ADMIN: { label: 'Account Locked (Admin)', icon: Lock, color: 'text-red-600' },
  ACCOUNT_UNLOCKED_BY_ADMIN: { label: 'Account Unlocked (Admin)', icon: Lock, color: 'text-green-600' },
  MFA_ENABLED: { label: 'MFA Enabled', icon: Shield, color: 'text-blue-600' },
  MFA_DISABLED: { label: 'MFA Disabled', icon: Shield, color: 'text-gray-600' },
  CREDENTIALS_GENERATED: { label: 'Credentials Generated', icon: Key, color: 'text-blue-600' },
  OTP_SENT: { label: 'OTP Sent', icon: Smartphone, color: 'text-purple-600' },
  OTP_VERIFIED: { label: 'OTP Verified', icon: CheckCircle, color: 'text-green-600' },
  PROFILE_UPDATED: { label: 'Profile Updated', icon: User, color: 'text-blue-600' },
  FORCE_LOGOUT_ALL: { label: 'Force Logout All', icon: LogOut, color: 'text-red-600' },
  DEVICE_REMOVED: { label: 'Device Removed', icon: Smartphone, color: 'text-red-600' },
};

export default function AuditCenterPage() {
  const { user, isSuperAdmin, isDirector } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const limit = 50;

  useEffect(() => {
    loadLogs();
  }, [page, actionFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (actionFilter !== 'all') params.action = actionFilter;
      const res = await identityApi.getAuditLogs(params);
      const data = res.data?.data || res.data;
      setLogs(data.logs || data || []);
      setTotal(data.total || 0);
    } catch (error: any) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionDisplay = (action: string, log: any) => {
    const config = ACTION_LABELS[action];
    if (config) {
      const Icon = config.icon;
      return (
        <div className={`flex items-center gap-2 ${config.color}`}>
          <Icon className="w-4 h-4" />
          <span>{config.label}</span>
        </div>
      );
    }
    return <span>{action}</span>;
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">Audit Center</h1>
            <p className="text-muted-foreground">Security audit trail and activity monitoring</p>
          </div>
        </div>
        <Button variant="outline" onClick={loadLogs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="LOGIN_SUCCESS">Login Success</SelectItem>
                <SelectItem value="LOGIN_FAILED">Login Failed</SelectItem>
                <SelectItem value="PASSWORD_CHANGED">Password Changed</SelectItem>
                <SelectItem value="PASSWORD_RESET_BY_ADMIN">Password Reset (Admin)</SelectItem>
                <SelectItem value="ACCOUNT_LOCKED">Account Locked</SelectItem>
                <SelectItem value="ACCOUNT_LOCKED_BY_ADMIN">Account Locked (Admin)</SelectItem>
                <SelectItem value="ACCOUNT_UNLOCKED_BY_ADMIN">Account Unlocked (Admin)</SelectItem>
                <SelectItem value="CREDENTIALS_GENERATED">Credentials Generated</SelectItem>
                <SelectItem value="MFA_ENABLED">MFA Enabled</SelectItem>
                <SelectItem value="MFA_DISABLED">MFA Disabled</SelectItem>
                <SelectItem value="FORCE_LOGOUT_ALL">Force Logout</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{total} total events</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm font-medium text-muted-foreground sticky top-0 bg-card">
                  <th className="p-4">Action</th>
                  <th className="p-4">User</th>
                  <th className="p-4">Details</th>
                  <th className="p-4">IP Address</th>
                  <th className="p-4">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-muted-foreground">
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log: any) => (
                    <tr key={log.id} className="border-b hover:bg-muted/50">
                      <td className="p-4">{getActionDisplay(log.action, log)}</td>
                      <td className="p-4">
                        {log.user ? (
                          <div>
                            <div className="text-sm font-medium">{log.user.firstName} {log.user.lastName}</div>
                            <div className="text-xs text-muted-foreground">{log.user.email}</div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">{log.userId}</span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground max-w-xs truncate">{log.details || '-'}</td>
                      <td className="p-4 text-sm text-muted-foreground font-mono">{log.ipAddress || '-'}</td>
                      <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(log.createdAt).toLocaleString()}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
