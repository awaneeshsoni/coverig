import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getUserRole, canManageTemplates } from '@/lib/auth/roles';

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
    if (!template.preview_video_url?.trim()) {
      return NextResponse.json({ error: 'Sample video (preview) is required before publishing' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('templates')
      .update({ status: 'published' })
      .eq('id', params.id)
      .eq('creator_id', userInfo.userId);

    if (updateError) throw updateError;

    console.log(`[API] Template ${params.id} published`);
    return NextResponse.json({ data: { status: 'published' } });
  } catch (error) {
    console.error('Publish template error:', error);
    return NextResponse.json({ error: 'Failed to publish template' }, { status: 500 });
  }
}
