/** Instagram API with Instagram Login - direct professional account auth, no Facebook Page required */
const INSTAGRAM_OAUTH = 'https://www.instagram.com/oauth/authorize';
const INSTAGRAM_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const GRAPH_IG = 'https://graph.instagram.com/v21.0';

export async function getInstagramUserInfo(accessToken: string) {
  const res = await fetch(
    `${GRAPH_IG}/me?fields=user_id,username,name,profile_picture_url&access_token=${accessToken}`
  );
  if (!res.ok) throw new Error('Failed to fetch Instagram user info');
  const data = await res.json();
  return { id: data.user_id || data.id, username: data.username || 'unknown', name: data.name };
}

export async function exchangeCodeForToken(code: string): Promise<{ access_token: string; user_id?: string }> {
  const body = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    grant_type: 'authorization_code',
    redirect_uri: process.env.META_REDIRECT_URI!,
    code: code.replace(/#_.*$/, ''),
  });

  const res = await fetch(INSTAGRAM_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error_message || err.error?.message || 'Token exchange failed');
  }

  const json = await res.json();
  const data = Array.isArray(json.data) ? json.data[0] : json;
  return { access_token: data.access_token, user_id: data.user_id };
}

export async function exchangeForLongLivedToken(shortToken: string): Promise<{ access_token: string; expires_in: number }> {
  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: process.env.META_APP_SECRET!,
    access_token: shortToken,
  });

  const res = await fetch(`${GRAPH_IG}/access_token?${params}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Failed to exchange for long-lived token');
  }
  const data = await res.json();
  return { access_token: data.access_token, expires_in: data.expires_in ?? 5184000 };
}

export async function refreshLongLivedToken(currentToken: string): Promise<{ access_token: string; expires_in: number }> {
  const params = new URLSearchParams({
    grant_type: 'ig_refresh_token',
    access_token: currentToken,
  });

  const res = await fetch(`${GRAPH_IG}/refresh_access_token?${params}`);
  if (!res.ok) throw new Error('Failed to refresh token');
  const data = await res.json();
  return { access_token: data.access_token, expires_in: data.expires_in ?? 5184000 };
}

export function isTokenExpiringSoon(expiryIso: string | null): boolean {
  if (!expiryIso) return true;
  const expiry = new Date(expiryIso).getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return Date.now() + sevenDays >= expiry;
}

export async function ensureValidToken(
  account: { access_token: string; token_expiry: string | null },
  onRefresh: (newToken: string, newExpiry: string) => Promise<void>
): Promise<string> {
  if (!isTokenExpiringSoon(account.token_expiry)) return account.access_token;
  const refreshed = await refreshLongLivedToken(account.access_token);
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await onRefresh(refreshed.access_token, newExpiry);
  return refreshed.access_token;
}

export async function getInstagramAccountInfo(accessToken: string): Promise<{ igUserId: string; username: string }> {
  const info = await getInstagramUserInfo(accessToken);
  return { igUserId: info.id, username: info.username };
}

export async function publishReelToInstagram(
  igUserId: string,
  accessToken: string,
  videoUrl: string,
  caption: string
): Promise<string> {
  const containerRes = await fetch(`${GRAPH_IG}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'REELS',
      video_url: videoUrl,
      caption,
      access_token: accessToken,
    }),
  });

  if (!containerRes.ok) {
    const err = await containerRes.json();
    throw new Error(err.error?.message || 'Failed to create media container');
  }

  const { id: containerId } = await containerRes.json();

  let status = 'IN_PROGRESS';
  let attempts = 0;
  while (status === 'IN_PROGRESS' && attempts < 30) {
    await new Promise((r) => setTimeout(r, 5000));
    const checkRes = await fetch(
      `${GRAPH_IG}/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const checkData = await checkRes.json();
    status = checkData.status_code;
    attempts++;
  }

  if (status !== 'FINISHED') {
    throw new Error(`Container processing failed with status: ${status}`);
  }

  const publishRes = await fetch(`${GRAPH_IG}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: accessToken,
    }),
  });

  if (!publishRes.ok) {
    const err = await publishRes.json();
    throw new Error(err.error?.message || 'Failed to publish');
  }

  const { id: mediaId } = await publishRes.json();
  return mediaId;
}

export async function fetchMediaInsights(
  mediaId: string,
  accessToken: string
): Promise<Record<string, number>> {
  const metrics = 'views,reach,likes,comments,saved';
  const res = await fetch(
    `${GRAPH_IG}/${mediaId}/insights?metric=${metrics}&access_token=${accessToken}`
  );

  if (!res.ok) return {};

  const data = await res.json();
  const result: Record<string, number> = {};
  for (const item of data.data || []) {
    const val = item.values?.[0]?.value;
    result[item.name] = typeof val === 'number' ? val : 0;
  }
  return result;
}

export function getInstagramOAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: process.env.META_REDIRECT_URI!,
    scope: 'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights',
    response_type: 'code',
  });
  return `${INSTAGRAM_OAUTH}?${params}`;
}
