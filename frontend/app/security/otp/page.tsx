'use client';

import { useState, useEffect } from 'react';
import { identityApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Smartphone, Mail, MessageSquare, Shield, CheckCircle,
  Loader2, Send, Key, Clock,
} from 'lucide-react';

export default function OtpPage() {
  const [loading, setLoading] = useState(false);
  const [purpose, setPurpose] = useState('PASSWORD_RESET');
  const [channel, setChannel] = useState('EMAIL');
  const [recipient, setRecipient] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'send' | 'verify'>('send');
  const [verified, setVerified] = useState(false);

  const handleSendOtp = async () => {
    if (!recipient) { toast.error('Please enter recipient'); return; }
    setLoading(true);
    try {
      await identityApi.sendOtp(purpose, channel as 'EMAIL' | 'SMS' | 'WHATSAPP', recipient);
      toast.success('OTP sent successfully');
      setStep('verify');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length < 6) { toast.error('Please enter a valid 6-digit OTP'); return; }
    setLoading(true);
    try {
      const res = await identityApi.verifyOtp(otpCode, purpose);
      const data = res.data?.data || res.data;
      if (data?.valid || data?.message?.includes('success')) {
        setVerified(true);
        toast.success('OTP verified successfully');
      } else {
        toast.error(data?.message || 'Invalid OTP');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('send');
    setVerified(false);
    setOtpCode('');
    setRecipient('');
  };

  const channelIcons: Record<string, any> = {
    EMAIL: Mail,
    SMS: MessageSquare,
    WHATSAPP: Smartphone,
  };
  const ChannelIcon = channelIcons[channel] || Mail;

  return (
    <div className="container mx-auto p-6 max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">OTP Verification</h1>
          <p className="text-muted-foreground">One-Time Password verification for secure actions</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            {step === 'send' ? 'Send OTP' : verified ? 'Verified' : 'Verify OTP'}
          </CardTitle>
          <CardDescription>
            {step === 'send'
              ? 'Choose delivery method and send a one-time password'
              : verified
                ? 'OTP has been verified successfully'
                : 'Enter the OTP code sent to your device'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {verified ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <p className="font-medium text-lg">OTP Verified Successfully</p>
              <p className="text-sm text-muted-foreground mt-2">
                Your identity has been confirmed.
              </p>
              <Button variant="outline" className="mt-6" onClick={reset}>
                Send Another OTP
              </Button>
            </div>
          ) : step === 'send' ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Purpose</label>
                <Select value={purpose} onValueChange={setPurpose}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PASSWORD_RESET">Password Reset</SelectItem>
                    <SelectItem value="ACCOUNT_VERIFICATION">Account Verification</SelectItem>
                    <SelectItem value="EMAIL_CHANGE">Email Change</SelectItem>
                    <SelectItem value="PHONE_CHANGE">Phone Change</SelectItem>
                    <SelectItem value="DEVICE_VERIFICATION">Device Verification</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Delivery Channel</label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="SMS">SMS</SelectItem>
                    <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Recipient</label>
                <Input
                  type={channel === 'EMAIL' ? 'email' : 'tel'}
                  placeholder={channel === 'EMAIL' ? 'your@email.com' : '+260XXXXXXXXX'}
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                />
              </div>

              <Button className="w-full" onClick={handleSendOtp} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Send OTP via {channel}
              </Button>
            </>
          ) : (
            <>
              <div className="flex justify-center py-4">
                <div className="bg-muted rounded-full p-4">
                  <ChannelIcon className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                A 6-digit OTP has been sent to {recipient} via {channel}
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">Enter OTP Code</label>
                <Input
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleVerifyOtp} disabled={loading || otpCode.length < 6}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                  Verify OTP
                </Button>
                <Button variant="ghost" onClick={reset}>
                  Change Recipient
                </Button>
              </div>
              <div className="text-center">
                <Button variant="link" size="sm" onClick={handleSendOtp} disabled={loading}>
                  <Send className="w-3 h-3 mr-1" /> Resend OTP
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
