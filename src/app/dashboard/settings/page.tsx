import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SettingsClient } from '@/components/settings-client';
import type { InstagramAccount } from '@/types';

export default async function SettingsPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: igAccount } = await supabase
    .from('instagram_accounts')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return <SettingsClient igAccount={igAccount as InstagramAccount | null} />;
}
