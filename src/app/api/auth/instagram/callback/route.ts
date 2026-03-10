import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getInstagramAccountInfo,
} from '@/lib/instagram';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const errorParam = searchParams.get('error');

  if (errorParam || !code) {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=instagram_denied`);
  }

  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(`${origin}/login`);
    }

    const shortToken = await exchangeCodeForToken(code);
    const longToken = await exchangeForLongLivedToken(shortToken.access_token);
    const { igUserId, username } = await getInstagramAccountInfo(longToken.access_token);

    const tokenExpiry = new Date(Date.now() + (longToken.expires_in * 1000)).toISOString();

    const { error } = await supabase
      .from('instagram_accounts')
      .upsert({
        user_id: user.id,
        instagram_user_id: igUserId,
        username,
        access_token: longToken.access_token,
        token_expiry: tokenExpiry,
      }, { onConflict: 'user_id' });

    if (error) throw error;

    return NextResponse.redirect(`${origin}/dashboard/settings?success=instagram_connected`);
  } catch (err) {
    console.error('Instagram OAuth error:', err);
    const msg = encodeURIComponent(err instanceof Error ? err.message : 'Connection failed');
    return NextResponse.redirect(`${origin}/dashboard/settings?error=${msg}`);
  }
}
