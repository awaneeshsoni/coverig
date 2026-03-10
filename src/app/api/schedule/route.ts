import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('scheduled_posts')
      .select('*, project:projects(*, template:templates(*))')
      .eq('user_id', user.id)
      .order('scheduled_time', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Schedule fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { project_id, content_id, platform, scheduled_time, caption } = await request.json();

    if (!project_id || !platform || !scheduled_time) {
      return NextResponse.json(
        { error: 'project_id, platform, and scheduled_time are required' },
        { status: 400 }
      );
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', project_id)
      .eq('user_id', user.id)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (content_id) {
      const { data: content } = await supabase
        .from('content')
        .select('id')
        .eq('id', content_id)
        .eq('project_id', project_id)
        .eq('user_id', user.id)
        .single();
      if (!content) {
        return NextResponse.json({ error: 'Content not found or does not belong to project' }, { status: 404 });
      }
    }

    const { data, error } = await supabase
      .from('scheduled_posts')
      .insert({
        user_id: user.id,
        project_id,
        content_id: content_id || null,
        platform,
        scheduled_time,
        caption: caption || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Schedule create error:', error);
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
  }
}
