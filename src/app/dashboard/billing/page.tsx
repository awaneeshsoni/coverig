import { createServerSupabaseClient } from '@/lib/supabase/server';
import { BillingClient } from '@/components/billing-client';
import type { Subscription } from '@/types';

export default async function BillingPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  let { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!sub) {
    const { data: newSub } = await supabase
      .from('subscriptions')
      .insert({ user_id: user.id, plan: 'free', renders_used: 0, renders_limit: 10 })
      .select()
      .single();
    sub = newSub;
  }

  return <BillingClient subscription={sub as Subscription} />;
}
