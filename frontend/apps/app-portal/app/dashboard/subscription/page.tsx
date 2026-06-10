'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { subscriptionApi } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function SubscriptionPage() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'mobilemoney'>('card');
  const [phone, setPhone] = useState('');
  const [network, setNetwork] = useState<'MTN' | 'AIRTEL' | 'ZAMTEL'>('MTN');
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: plansData, isLoading: loadingPlans } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => subscriptionApi.getPlans(),
  });

  const { data: currentSubscription } = useQuery({
    queryKey: ['current-subscription'],
    queryFn: () => subscriptionApi.getMySubscription(),
  });

  const { data: subscriptionStatus } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: () => subscriptionApi.checkStatus(),
  });

  const plans = Array.isArray(plansData?.data) ? plansData.data : 
               Array.isArray(plansData) ? plansData : [];
  const subscription = currentSubscription?.data || currentSubscription;
  const status = subscriptionStatus?.data || subscriptionStatus;

  const createPaymentMutation = useMutation({
    mutationFn: (planId: string) => subscriptionApi.createPayment({
      planId,
      paymentMethod,
      phone: paymentMethod === 'mobilemoney' ? phone : undefined,
      network: paymentMethod === 'mobilemoney' ? network : undefined,
    }),
    onSuccess: (data) => {
      if (data.data?.paymentLink) {
        window.location.href = data.data.paymentLink;
      }
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Payment failed');
    },
  });

  const handleSubscribe = (planId: string) => {
    setIsProcessing(true);
    createPaymentMutation.mutate(planId);
  };

  const formatPrice = (price: number) => {
    return `ZMW ${price.toLocaleString()}`;
  };

  if (loadingPlans) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900">Choose Your Plan</h1>
        <p className="text-gray-600 mt-2">Select the plan that best fits your school&apos;s needs</p>
      </div>

      {status?.status === 'trial' && status.daysLeft && (
        <div className="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <p className="text-yellow-800">
            You are on a free trial with <strong>{status.daysLeft} days</strong> remaining
          </p>
        </div>
      )}

      {plans.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl">
          <p className="text-gray-500">No subscription plans available</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan: any) => (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl p-8 shadow-lg border-2 ${
                plan.isPopular ? 'border-blue-500 relative' : 'border-gray-100'
              }`}
            >
              {plan.isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </div>
              )}

              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900">{plan.displayName}</h3>
                <p className="text-gray-500 mt-2 text-sm">{plan.description}</p>
              </div>

              <div className="text-center mt-6">
                <span className="text-4xl font-bold">{formatPrice(plan.price)}</span>
                <span className="text-gray-500">/{plan.interval}</span>
              </div>

              <div className="mt-6 space-y-3">
                {plan.features?.map((feature: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-green-500">✓</span>
                    {feature}
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={isProcessing || subscription?.plan?.name === plan.name}
                className={`w-full mt-8 py-3 rounded-lg font-semibold transition-colors ${
                  subscription?.plan?.name === plan.name
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : plan.isPopular
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                {subscription?.plan?.name === plan.name
                  ? 'Current Plan'
                  : isProcessing
                  ? 'Processing...'
                  : 'Subscribe'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl p-8 shadow-lg">
        <h2 className="text-2xl font-bold mb-6">Payment Details</h2>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Payment Method
          </label>
          <div className="flex gap-4">
            <button
              onClick={() => setPaymentMethod('card')}
              className={`px-6 py-3 rounded-lg border-2 ${
                paymentMethod === 'card'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200'
              }`}
            >
              💳 Card
            </button>
            <button
              onClick={() => setPaymentMethod('mobilemoney')}
              className={`px-6 py-3 rounded-lg border-2 ${
                paymentMethod === 'mobilemoney'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200'
              }`}
            >
              📱 Mobile Money
            </button>
          </div>
        </div>

        {paymentMethod === 'mobilemoney' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter your mobile number"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
            />
          </div>
        )}

        {paymentMethod === 'mobilemoney' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Network
            </label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value as any)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
            >
              <option value="MTN">MTN</option>
              <option value="AIRTEL">AIRTEL</option>
              <option value="ZAMTEL">ZAMTEL</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}