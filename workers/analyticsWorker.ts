import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const GRAPH_API = 'https://graph.facebook.com/v21.0';
const SIX_HOURS = 6 * 60 * 60 * 1000;

async function fetchInsights(mediaId: string, accessToken: string): Promise<Record<string, number>> {
  const metrics = 'impressions,reach,likes,comments,shares,saved,plays';
  try {
    const res = await fetch(
      `${GRAPH_API}/${mediaId}/insights?metric=${metrics}&access_token=${accessToken}`
    );
    if (!res.ok) return {};
    const data = await res.json();
    const result: Record<string, number> = {};
    for (const item of data.data || []) {
      result[item.name] = item.values?.[0]?.value || 0;
    }
    return result;
  } catch {
    return {};
  }
}

async function updateAllAnalytics() {
  const { data: posts } = await supabase
    .from('instagram_posts')
    .select('id, instagram_media_id, user_id')
    .eq('status', 'published')
    .not('instagram_media_id', 'is', null);

  if (!posts || posts.length === 0) {
    console.log('[Analytics] No published posts to update');
    return;
  }

  console.log(`[Analytics] Updating ${posts.length} posts...`);

  const userTokens: Record<string, string> = {};

  for (const post of posts) {
    try {
      if (!userTokens[post.user_id]) {
        const { data: igAccount } = await supabase
          .from('instagram_accounts')
          .select('access_token')
          .eq('user_id', post.user_id)
          .single();

        if (!igAccount) continue;
        userTokens[post.user_id] = igAccount.access_token;
      }

      const token = userTokens[post.user_id];
      const insights = await fetchInsights(post.instagram_media_id!, token);

      if (Object.keys(insights).length === 0) continue;

      await supabase
        .from('instagram_analytics')
        .upsert({
          post_id: post.id,
          views: insights.plays || 0,
          likes: insights.likes || 0,
          comments: insights.comments || 0,
          shares: insights.shares || 0,
          saves: insights.saved || 0,
          reach: insights.reach || 0,
          impressions: insights.impressions || 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'post_id' });

      console.log(`[Analytics] Updated post ${post.id}`);
    } catch (err) {
      console.error(`[Analytics] Failed for ${post.id}:`, err);
    }
  }

  console.log('[Analytics] Update complete');
}

async function main() {
  console.log('[Analytics] Started, running every 6 hours...');
  while (true) {
    try {
      await updateAllAnalytics();
    } catch (err) {
      console.error('[Analytics] Error:', err);
    }
    await new Promise((r) => setTimeout(r, SIX_HOURS));
  }
}

main();
