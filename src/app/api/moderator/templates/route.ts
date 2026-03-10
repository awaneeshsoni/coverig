import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getUserRole, canManageTemplates } from '@/lib/auth/roles';

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
    if (!preview_video_url?.trim()) {
      return NextResponse.json({ error: 'Sample video (preview) is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const status = publish ? 'published' : 'draft';

    const insert: Record<string, unknown> = {
      name,
      description: description || '',
      config_json,
      preview_video_url: preview_video_url.trim(),
      status,
      creator_id: userInfo.userId,
    };

    const { data, error } = await supabase
      .from('templates')
      .insert(insert)
      .select()
      .single();

    if (error) throw error;

    if (publish && data) {
      console.log(`[API] Template ${data.id} published`);
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Create template error:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
