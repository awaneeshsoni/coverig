import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getUserRole, canManageModerators } from '@/lib/auth/roles';
import type { UserRole } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userInfo = await getUserRole();
    if (!userInfo || !canManageModerators(userInfo.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, role, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userInfo = await getUserRole();
    if (!userInfo || !canManageModerators(userInfo.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { user_id, role } = await request.json();

    if (!user_id || !role) {
      return NextResponse.json({ error: 'user_id and role are required' }, { status: 400 });
    }

    const validRoles: UserRole[] = ['user', 'moderator', 'admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    if (user_id === userInfo.userId) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ role })
      .eq('id', user_id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Admin update role error:', error);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}
