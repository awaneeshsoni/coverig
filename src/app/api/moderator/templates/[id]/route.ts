import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getUserRole, canManageTemplates } from '@/lib/auth/roles';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userInfo = await getUserRole();
    if (!userInfo || !canManageTemplates(userInfo.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', params.id)
      .eq('creator_id', userInfo.userId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Fetch template error:', error);
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userInfo = await getUserRole();
    if (!userInfo || !canManageTemplates(userInfo.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updates = await request.json();
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('templates')
      .update(updates)
      .eq('id', params.id)
      .eq('creator_id', userInfo.userId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Update template error:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userInfo = await getUserRole();
    if (!userInfo || !canManageTemplates(userInfo.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServerSupabaseClient();
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', params.id)
      .eq('creator_id', userInfo.userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete template error:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
