import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: posts } = await supabase
      .from('instagram_posts')
      .select('*, analytics:instagram_analytics(*), project:projects(template:templates(name))')
      .eq('user_id', user.id)
      .eq('status', 'published')
      .order('posted_at', { ascending: false });

    return NextResponse.json({ data: posts || [] });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
