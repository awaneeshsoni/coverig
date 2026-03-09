import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types';

export async function getUserRole(): Promise<{ userId: string; role: UserRole } | null> {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return {
    userId: user.id,
    role: (profile?.role as UserRole) || 'user',
  };
}

export function canManageTemplates(role: UserRole): boolean {
  return role === 'moderator' || role === 'admin';
}

export function canManageModerators(role: UserRole): boolean {
  return role === 'admin';
}
