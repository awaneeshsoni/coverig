import { createClient } from '@supabase/supabase-js';
import { ensureValidToken } from '../src/lib/instagram';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const GRAPH_API = 'https://graph.instagram.com/v21.0';

async function publishToInstagram(
  igUserId: string,
  accessToken: string,
  videoUrl: string,
  caption: string
): Promise<string> {
  const containerRes = await fetch(`${GRAPH_API}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'REELS',
      video_url: videoUrl,
      caption,
      access_token: accessToken,
    }),
  });

  if (!containerRes.ok) {
    const err = await containerRes.json();
    throw new Error(err.error?.message || 'Container creation failed');
  }

  const { id: containerId } = await containerRes.json();

  let status = 'IN_PROGRESS';
  let attempts = 0;
  while (status === 'IN_PROGRESS' && attempts < 30) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(
      `${GRAPH_API}/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const data = await res.json();
    status = data.status_code;
    attempts++;
  }

  if (status !== 'FINISHED') throw new Error(`Container status: ${status}`);

  const pubRes = await fetch(`${GRAPH_API}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
  });

  if (!pubRes.ok) {
    const err = await pubRes.json();
    throw new Error(err.error?.message || 'Publish failed');
  }

  const { id: mediaId } = await pubRes.json();
  return mediaId;
}

async function processDuePosts() {
  const now = new Date().toISOString();

  const { data: duePosts, error } = await supabase
    .from('scheduled_posts')
    .select('*, project:projects(*), content:content(output_video_url)')
    .eq('status', 'pending')
    .eq('platform', 'instagram')
    .lte('scheduled_time', now)
    .limit(10);

  if (error || !duePosts || duePosts.length === 0) return;

  console.log(`[Scheduler] Found ${duePosts.length} due posts`);

  for (const post of duePosts) {
    try {
      const videoUrl = post.content_id && post.content?.output_video_url
        ? post.content.output_video_url
        : post.project?.output_video_url;

      if (!videoUrl) {
        console.log(`[Scheduler] Post ${post.id}: no video, marking failed`);
        await supabase.from('scheduled_posts').update({ status: 'failed' }).eq('id', post.id);
        continue;
      }

      const { data: igAccount } = await supabase
        .from('instagram_accounts')
        .select('*')
        .eq('user_id', post.user_id)
        .single();

      if (!igAccount) {
        console.log(`[Scheduler] Post ${post.id}: no IG account, marking failed`);
        await supabase.from('scheduled_posts').update({ status: 'failed' }).eq('id', post.id);
        continue;
      }

      const accessToken = await ensureValidToken(
        igAccount,
        async (newToken, newExpiry) => {
          await supabase
            .from('instagram_accounts')
            .update({ access_token: newToken, token_expiry: newExpiry })
            .eq('user_id', post.user_id);
        }
      );

      console.log(`[Scheduler] Publishing post ${post.id} to Instagram...`);

      const mediaId = await publishToInstagram(
        igAccount.instagram_user_id,
        accessToken,
        videoUrl,
        post.caption || ''
      );

      await supabase.from('scheduled_posts').update({ status: 'posted' }).eq('id', post.id);

      await supabase.from('instagram_posts').insert({
        user_id: post.user_id,
        project_id: post.project_id,
        instagram_media_id: mediaId,
        caption: post.caption || '',
        status: 'published',
        posted_at: new Date().toISOString(),
      });

      console.log(`[Scheduler] Post ${post.id} published: ${mediaId}`);
    } catch (err) {
      console.error(`[Scheduler] Post ${post.id} failed:`, err);
      await supabase.from('scheduled_posts').update({ status: 'failed' }).eq('id', post.id);
    }
  }
}

async function main() {
  console.log('[Scheduler] Started, checking every 60 seconds...');
  while (true) {
    try {
      await processDuePosts();
    } catch (err) {
      console.error('[Scheduler] Error:', err);
    }
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

main();
