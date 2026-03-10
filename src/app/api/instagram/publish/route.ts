import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { publishReelToInstagram, ensureValidToken } from '@/lib/instagram';

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, content_id, caption } = await request.json();
    if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

    let videoUrl: string;

    if (content_id) {
      const { data: content } = await supabase
        .from('content')
        .select('output_video_url, project_id')
        .eq('id', content_id)
        .eq('project_id', project_id)
        .eq('user_id', user.id)
        .single();

      if (!content || !content.output_video_url) {
        return NextResponse.json({ error: 'No video found for this content' }, { status: 404 });
      }
      videoUrl = content.output_video_url;
    } else {
      const { data: project } = await supabase
        .from('projects')
        .select('output_video_url')
        .eq('id', project_id)
        .eq('user_id', user.id)
        .single();

      if (!project || !project.output_video_url) {
        return NextResponse.json({ error: 'No video found for this project' }, { status: 404 });
      }
      videoUrl = project.output_video_url;
    }

    const { data: igAccount } = await supabase
      .from('instagram_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!igAccount) {
      return NextResponse.json({ error: 'Instagram account not connected' }, { status: 400 });
    }

    const accessToken = await ensureValidToken(
      igAccount,
      async (newToken, newExpiry) => {
        await supabase
          .from('instagram_accounts')
          .update({ access_token: newToken, token_expiry: newExpiry })
          .eq('user_id', user.id);
      }
    );

    const { data: post, error: insertErr } = await supabase
      .from('instagram_posts')
      .insert({
        user_id: user.id,
        project_id,
        caption: caption || '',
        status: 'uploading',
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    try {
      const mediaId = await publishReelToInstagram(
        igAccount.instagram_user_id,
        accessToken,
        videoUrl,
        caption || ''
      );

      await supabase
        .from('instagram_posts')
        .update({
          instagram_media_id: mediaId,
          status: 'published',
          posted_at: new Date().toISOString(),
        })
        .eq('id', post.id);

      return NextResponse.json({ data: { media_id: mediaId, status: 'published' } });
    } catch (pubErr) {
      await supabase
        .from('instagram_posts')
        .update({ status: 'failed' })
        .eq('id', post.id);

      throw pubErr;
    }
  } catch (error) {
    console.error('Publish error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Publishing failed' },
      { status: 500 }
    );
  }
}
