import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getUserRole, canManageTemplates } from '@/lib/auth/roles';
import { getPreviewQueue } from '@/lib/queue';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userInfo = await getUserRole();
    if (!userInfo || !canManageTemplates(userInfo.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServerSupabaseClient();

    const { data: template } = await supabase
      .from('templates')
      .select('*')
      .eq('id', params.id)
      .eq('creator_id', userInfo.userId)
      .single();

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    await supabase
      .from('templates')
      .update({ status: 'processing' })
      .eq('id', params.id);

    const queue = getPreviewQueue();

    try {
      const existingJob = await queue.getJob(params.id);
      if (existingJob) {
        const state = await existingJob.getState();
        if (state === 'active' || state === 'waiting' || state === 'delayed') {
          return NextResponse.json({ data: { status: 'processing', message: 'Already queued' } });
        }
        await existingJob.remove();
      }
    } catch {
      // Job doesn't exist or already removed
    }

    await queue.add('preview', { template_id: params.id }, { jobId: `preview-${params.id}-${Date.now()}` });
    console.log(`[API] Queued preview job for template ${params.id}`);

    return NextResponse.json({ data: { status: 'processing' } });
  } catch (error) {
    console.error('Publish template error:', error);
    return NextResponse.json({ error: 'Failed to publish template' }, { status: 500 });
  }
}
