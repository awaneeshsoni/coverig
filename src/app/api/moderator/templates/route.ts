import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getUserRole, canManageTemplates } from '@/lib/auth/roles';
import { getPreviewQueue } from '@/lib/queue';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userInfo = await getUserRole();
    if (!userInfo || !canManageTemplates(userInfo.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('creator_id', userInfo.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Mod templates error:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userInfo = await getUserRole();
    if (!userInfo || !canManageTemplates(userInfo.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, description, config_json, preview_video_url, publish } = await request.json();

    if (!name || !config_json) {
      return NextResponse.json({ error: 'name and config_json are required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const status = publish ? 'processing' : 'draft';

    const insert: Record<string, unknown> = {
      name,
      description: description || '',
      config_json,
      status,
      creator_id: userInfo.userId,
    };
    if (preview_video_url) insert.preview_video_url = preview_video_url;

    const { data, error } = await supabase
      .from('templates')
      .insert(insert)
      .select()
      .single();

    if (error) throw error;

    if (publish && data) {
      await getPreviewQueue().add('preview', { template_id: data.id }, { jobId: `preview-${data.id}-${Date.now()}` });
      console.log(`[API] Queued preview job for new template ${data.id}`);
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Create template error:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
