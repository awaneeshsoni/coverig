'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Zap } from 'lucide-react';
import type { Subscription, PlanType } from '@/types';
import { PLAN_LIMITS } from '@/types';

const PLAN_FEATURES: Record<PlanType, string[]> = {
  free: ['10 renders/month', 'Basic templates', 'Manual publishing'],
  starter: ['100 renders/month', 'All templates', 'Instagram publishing', 'Scheduling'],
  creator: ['500 renders/month', 'All templates', 'Instagram publishing', 'Scheduling', 'Analytics', 'Priority support'],
  agency: ['2,000 renders/month', 'All templates', 'Instagram publishing', 'Scheduling', 'Full analytics', 'Priority support', 'API access'],
};

const VARIANT_IDS: Partial<Record<PlanType, string>> = {
  starter: process.env.NEXT_PUBLIC_LS_STARTER_VARIANT || '',
  creator: process.env.NEXT_PUBLIC_LS_CREATOR_VARIANT || '',
  agency: process.env.NEXT_PUBLIC_LS_AGENCY_VARIANT || '',
};

export function BillingClient({ subscription }: { subscription: Subscription }) {
  const [loading, setLoading] = useState<string | null>(null);

  const usagePercent = subscription.renders_limit > 0
    ? Math.round((subscription.renders_used / subscription.renders_limit) * 100)
    : 0;

  async function handleUpgrade(plan: PlanType) {
    const variantId = VARIANT_IDS[plan];
    if (!variantId) return;

    setLoading(plan);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant_id: variantId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert('Failed to start checkout');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Billing</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage your subscription and usage</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Current Plan</h2>
            <Badge className="bg-orange-50 text-orange-700 border border-orange-200 capitalize">{subscription.plan}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-600">Renders used</span>
              <span className="font-medium text-zinc-900">
                {subscription.renders_used} / {subscription.renders_limit}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-zinc-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-orange-500 transition-all"
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
          </div>
          {subscription.current_period_end && (
            <p className="text-xs text-zinc-500">
              Current period ends: {new Date(subscription.current_period_end).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 mb-4">Plans</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.keys(PLAN_LIMITS) as PlanType[]).map((plan) => {
            const info = PLAN_LIMITS[plan];
            const features = PLAN_FEATURES[plan];
            const isCurrent = subscription.plan === plan;
            const isHigher = Object.keys(PLAN_LIMITS).indexOf(plan) > Object.keys(PLAN_LIMITS).indexOf(subscription.plan);

            return (
              <Card key={plan} className={isCurrent ? 'border-orange-500/70 ring-1 ring-orange-200' : ''}>
                <CardContent className="py-6 space-y-4">
                  <div>
                    <h3 className="font-semibold text-zinc-900 capitalize">{info.label}</h3>
                    <p className="text-2xl font-bold text-orange-500 mt-1">{info.price}</p>
                  </div>
                  <ul className="space-y-2">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-zinc-600">
                        <Check className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Button variant="secondary" className="w-full" disabled>Current Plan</Button>
                  ) : isHigher ? (
                    <Button
                      className="w-full"
                      onClick={() => handleUpgrade(plan)}
                      loading={loading === plan}
                    >
                      <Zap className="h-4 w-4 mr-1" />
                      Upgrade
                    </Button>
                  ) : (
                    <Button variant="ghost" className="w-full" disabled>—</Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
