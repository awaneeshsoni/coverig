import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { fetchMediaInsights, ensureValidToken } from '@/lib/instagram';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const sync = searchParams.get('sync') === 'true';

    if (sync) {
      const { data: igAccount } = await supabase
        .from('instagram_accounts')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (igAccount) {
        const accessToken = await ensureValidToken(
          igAccount,
          async (newToken, newExpiry) => {
            await supabase
              .from('instagram_accounts')
              .update({ access_token: newToken, token_expiry: newExpiry })
              .eq('user_id', user.id);
          }
        );

        const { data: postsToSync } = await supabase
          .from('instagram_posts')
          .select('id, instagram_media_id')
          .eq('user_id', user.id)
          .eq('status', 'published')
          .not('instagram_media_id', 'is', null);

        if (postsToSync?.length) {
          for (const post of postsToSync) {
            try {
              const insights = await fetchMediaInsights(post.instagram_media_id!, accessToken);
              const payload = {
                views: insights.views ?? insights.reach ?? 0,
                likes: insights.likes ?? 0,
                comments: insights.comments ?? 0,
                shares: 0,
                saves: insights.saved ?? 0,
                reach: insights.reach ?? 0,
                impressions: insights.impressions ?? 0,
                updated_at: new Date().toISOString(),
              };
              await supabase
                .from('instagram_analytics')
                .upsert(
                  { post_id: post.id, ...payload },
                  { onConflict: 'post_id', ignoreDuplicates: false }
                );
            } catch (e) {
              console.warn(`[Analytics] Failed to sync post ${post.id}:`, e);
            }
          }
        }
      }
    }

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
