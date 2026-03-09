import { NextRequest, NextResponse } from 'next/server';
import { getUserRole, canManageTemplates } from '@/lib/auth/roles';
import { uploadToR2 } from '@/lib/r2';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { MediaCategory } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userInfo = await getUserRole();
    if (!userInfo) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const fileType = searchParams.get('type');
    const category = searchParams.get('category');
    const q = searchParams.get('q');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '24')));
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('media_assets')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (fileType && fileType !== 'all') query = query.eq('file_type', fileType);
    if (category && category !== 'all') query = query.eq('category', category);
    if (q) query = query.or(`filename.ilike.%${q}%,tags.cs.{${q}}`);

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (err) {
    console.error('Media library GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userInfo = await getUserRole();
    if (!userInfo || !canManageTemplates(userInfo.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const category = (formData.get('category') as MediaCategory) || 'other';
    const tagsRaw = (formData.get('tags') as string) || '';
    const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);

    const isImage = file.type.startsWith('image/');
    const fileType = isImage ? 'image' : 'video';

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadToR2(buffer, file.type, `library/${category}`);

    const { data, error } = await supabaseAdmin.from('media_assets').insert({
      uploader_id: userInfo.userId,
      url,
      filename: file.name,
      file_type: fileType,
      content_type: file.type,
      file_size: file.size,
      category,
      tags,
      thumbnail_url: isImage ? url : null,
    }).select().single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (err) {
    console.error('Media library POST error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
