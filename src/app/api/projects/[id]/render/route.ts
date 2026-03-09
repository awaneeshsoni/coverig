import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getRenderQueue } from '@/lib/queue';
import type { RenderJob } from '@/types';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.status === 'rendering' || project.status === 'queued') {
      return NextResponse.json({ error: 'Project is already being rendered' }, { status: 409 });
    }

    const job: RenderJob = {
      project_id: project.id,
      template_id: project.template_id,
      inputs_json: project.inputs_json,
    };

    await getRenderQueue().add('render', job, {
      jobId: project.id,
    });

    await supabase
      .from('projects')
      .update({ status: 'queued' })
      .eq('id', project.id);

    // Increment renders_used
    if (sub) {
      await supabase
        .from('subscriptions')
        .update({ renders_used: rendersUsed + 1 })
        .eq('user_id', user.id);
    } else {
      // Create subscription record for new users
      await supabase
        .from('subscriptions')
        .insert({ user_id: user.id, plan: 'free', renders_used: 1, renders_limit: 10 });
    }

    return NextResponse.json({ data: { status: 'queued' } });
  } catch (error) {
    console.error('Render queue error:', error);
    return NextResponse.json({ error: 'Failed to queue render' }, { status: 500 });
  }
}
