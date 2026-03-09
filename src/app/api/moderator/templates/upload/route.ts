import { NextResponse } from 'next/server';
import { getUserRole, canManageTemplates } from '@/lib/auth/roles';
import { uploadToR2 } from '@/lib/r2';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const userInfo = await getUserRole();
    if (!userInfo || !canManageTemplates(userInfo.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadToR2(buffer, file.type, `templates/${userInfo.userId}`);

    const isImage = file.type.startsWith('image/');
    await supabaseAdmin.from('media_assets').insert({
      uploader_id: userInfo.userId,
      url,
      filename: file.name,
      file_type: isImage ? 'image' : 'video',
      content_type: file.type,
      file_size: file.size,
      category: 'other',
      thumbnail_url: isImage ? url : null,
    }).then(({ error }) => {
      if (error) console.warn('media_assets insert skipped:', error.message);
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
