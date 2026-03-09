import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { planFromVariantId, PLAN_RENDER_LIMITS } from '@/lib/lemonsqueezy';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function verifySignature(payload: string, signature: string): boolean {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || '';
  if (!secret) return true;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const digest = hmac.digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-signature') || '';

    if (process.env.LEMON_SQUEEZY_WEBHOOK_SECRET && !verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const eventName = payload.meta?.event_name;
    const customData = payload.meta?.custom_data || {};
    const userId = customData.user_id;
    const attrs = payload.data?.attributes || {};

    if (!userId) {
      console.warn('Webhook missing user_id in custom_data');
      return NextResponse.json({ received: true });
    }

    const variantId = String(attrs.variant_id || attrs.first_subscription_item?.variant_id || '');
    const plan = planFromVariantId(variantId);
    const lsSubId = String(payload.data?.id || '');

    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated':
      case 'subscription_resumed': {
        await supabaseAdmin
          .from('subscriptions')
          .upsert({
            user_id: userId,
            plan,
            lemon_squeezy_id: lsSubId,
            lemon_squeezy_status: attrs.status || 'active',
            current_period_start: attrs.current_period_start || null,
            current_period_end: attrs.current_period_end || null,
            renders_limit: PLAN_RENDER_LIMITS[plan],
          }, { onConflict: 'user_id' });
        break;
      }

      case 'subscription_cancelled':
      case 'subscription_expired':
      case 'subscription_paused': {
        await supabaseAdmin
          .from('subscriptions')
          .update({
            lemon_squeezy_status: attrs.status || 'cancelled',
            plan: 'free',
            renders_limit: PLAN_RENDER_LIMITS.free,
          })
          .eq('user_id', userId);
        break;
      }

      case 'subscription_payment_success': {
        await supabaseAdmin
          .from('subscriptions')
          .update({ renders_used: 0 })
          .eq('user_id', userId);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
