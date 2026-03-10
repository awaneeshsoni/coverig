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
      .from('content')
      .select('*, project:projects(*, template:templates(*))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Content fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check subscription limits
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const rendersUsed = sub?.renders_used ?? 0;
    const rendersLimit = sub?.renders_limit ?? 10;

    if (rendersUsed >= rendersLimit) {
      return NextResponse.json(
        { error: `Render limit reached (${rendersUsed}/${rendersLimit}). Upgrade your plan.` },
        { status: 403 }
      );
    }

    const { project_id, name } = await request.json();

    if (!project_id) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { data: content, error } = await supabase
      .from('content')
      .insert({
        user_id: user.id,
        project_id,
        name: name?.trim() || project.name || project.template?.name || null,
        status: 'queued',
      })
      .select('*')
      .single();

    if (error) throw error;

    // Increment renders_used
    if (sub) {
      await supabase
        .from('subscriptions')
        .update({ renders_used: rendersUsed + 1 })
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('subscriptions')
        .insert({ user_id: user.id, plan: 'free', renders_used: 1, renders_limit: 10 });
    }

    return NextResponse.json({ data: content }, { status: 201 });
  } catch (error) {
    console.error('Content create error:', error);
    return NextResponse.json({ error: 'Failed to create content' }, { status: 500 });
  }
}
