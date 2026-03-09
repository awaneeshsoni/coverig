import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { publishReelToInstagram } from '@/lib/instagram';

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id, caption } = await request.json();
    if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .single();

    if (!project || !project.output_video_url) {
      return NextResponse.json({ error: 'No completed video found' }, { status: 404 });
    }

    const { data: igAccount } = await supabase
      .from('instagram_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!igAccount) {
      return NextResponse.json({ error: 'Instagram account not connected' }, { status: 400 });
    }

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
        igAccount.access_token,
        project.output_video_url,
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
