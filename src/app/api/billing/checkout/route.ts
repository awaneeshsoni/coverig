import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createCheckoutUrl } from '@/lib/lemonsqueezy';

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { variant_id } = await request.json();
    if (!variant_id) return NextResponse.json({ error: 'variant_id required' }, { status: 400 });

    const url = await createCheckoutUrl(variant_id, user.id, user.email!);
    return NextResponse.json({ url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 });
  }
}
