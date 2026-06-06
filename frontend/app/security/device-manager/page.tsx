'use client';

import { useState, useEffect } from 'react';
import { identityApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Smartphone, Monitor, Globe, Laptop, Tablet,
  Trash2, LogOut, AlertTriangle, Loader2, Clock,
} from 'lucide-react';

export default function DeviceManagerPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsRes, devicesRes] = await Promise.all([
        identityApi.getActiveSessions(),
        identityApi.getDevices(),
      ]);
      setSessions(sessionsRes.data?.data || sessionsRes.data || []);
      setDevices(devicesRes.data?.data || devicesRes.data || []);
    } catch (error: any) {
      toast.error('Failed to load session data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutAll = async () => {
    setActionLoading('logout-all');
    try {
      await identityApi.logoutAllDevices();
      toast.success('All devices logged out');
      loadData();
    } catch (error: any) {
      toast.error('Failed to logout devices');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    setActionLoading(`remove-${deviceId}`);
    try {
      await identityApi.removeDevice(deviceId);
      toast.success('Device removed');
      loadData();
    } catch (error: any) {
      toast.error('Failed to remove device');
    } finally {
      setActionLoading(null);
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'SMARTPHONE': case 'MOBILE': case 'PHONE': return <Smartphone className="w-5 h-5" />;
      case 'TABLET': return <Tablet className="w-5 h-5" />;
      case 'LAPTOP': return <Laptop className="w-5 h-5" />;
      case 'DESKTOP': case 'PC': return <Monitor className="w-5 h-5" />;
      default: return <Globe className="w-5 h-5" />;
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Smartphone className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">Device & Session Manager</h1>
            <p className="text-muted-foreground">Manage active sessions and registered devices</p>
          </div>
        </div>
        <Button variant="destructive" onClick={handleLogoutAll} disabled={actionLoading === 'logout-all'}>
          {actionLoading === 'logout-all' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
          Logout All Devices
        </Button>
      </div>

      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">Active Sessions ({sessions.length})</TabsTrigger>
          <TabsTrigger value="devices">Registered Devices ({devices.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4 pt-4">
          {sessions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                <Monitor className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No active sessions</p>
              </CardContent>
            </Card>
          ) : (
            sessions.map((session: any) => (
              <Card key={session.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {getDeviceIcon(session.deviceType || 'WEB')}
                      <div>
                        <p className="font-medium">{session.browser || 'Unknown Browser'} on {session.os || 'Unknown OS'}</p>
                        <p className="text-sm text-muted-foreground">
                          IP: {session.ipAddress || 'Unknown'} {session.location ? `- ${session.location}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          Last active: {session.lastActivity ? new Date(session.lastActivity).toLocaleString() : 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <Badge variant={session.deviceType === 'MOBILE' ? 'default' : 'secondary'}>
                      {session.deviceType || 'WEB'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="devices" className="space-y-4 pt-4">
          {devices.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                <Smartphone className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No registered devices</p>
              </CardContent>
            </Card>
          ) : (
            devices.map((device: any) => (
              <Card key={device.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {getDeviceIcon(device.deviceType)}
                      <div>
                        <p className="font-medium">{device.deviceName || 'Unknown Device'}</p>
                        <p className="text-sm text-muted-foreground">
                          {device.platform} {device.os ? `- ${device.os}` : ''} {device.browser ? `- ${device.browser}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          Last used: {device.lastUsedAt ? new Date(device.lastUsedAt).toLocaleString() : 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {device.isTrusted && <Badge className="text-green-600 bg-green-50 dark:bg-green-950/30">Trusted</Badge>}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRemoveDevice(device.deviceId)}
                        disabled={actionLoading === `remove-${device.deviceId}`}
                      >
                        {actionLoading === `remove-${device.deviceId}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
