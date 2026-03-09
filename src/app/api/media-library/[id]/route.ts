import { NextResponse } from 'next/server';
import { getUserRole, canManageTemplates } from '@/lib/auth/roles';
import { deleteFromR2 } from '@/lib/r2';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const userInfo = await getUserRole();
    if (!userInfo || !canManageTemplates(userInfo.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: asset, error: fetchErr } = await supabaseAdmin
      .from('media_assets')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchErr || !asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    if (asset.uploader_id !== userInfo.userId && userInfo.role !== 'admin') {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    try { await deleteFromR2(asset.url); } catch { /* R2 deletion is best-effort */ }

    const { error } = await supabaseAdmin.from('media_assets').delete().eq('id', params.id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Media library DELETE error:', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
