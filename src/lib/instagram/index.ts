const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

export async function getInstagramUserInfo(accessToken: string) {
  const res = await fetch(
    `${GRAPH_API_BASE}/me?fields=id,username,name,profile_picture_url&access_token=${accessToken}`
  );
  if (!res.ok) throw new Error('Failed to fetch Instagram user info');
  return res.json() as Promise<{ id: string; username: string; name: string }>;
}

export async function exchangeCodeForToken(code: string): Promise<{ access_token: string; expires_in?: number }> {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    grant_type: 'authorization_code',
    redirect_uri: process.env.META_REDIRECT_URI!,
    code,
  });

  const res = await fetch(`${GRAPH_API_BASE}/oauth/access_token?${params}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Token exchange failed');
  }
  return res.json();
}

export async function exchangeForLongLivedToken(shortToken: string): Promise<{ access_token: string; expires_in: number }> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: shortToken,
  });

  const res = await fetch(`${GRAPH_API_BASE}/oauth/access_token?${params}`);
  if (!res.ok) throw new Error('Failed to exchange for long-lived token');
  return res.json();
}

export async function getInstagramBusinessAccountId(accessToken: string): Promise<string> {
  const res = await fetch(
    `${GRAPH_API_BASE}/me/accounts?fields=instagram_business_account{id,username}&access_token=${accessToken}`
  );
  if (!res.ok) throw new Error('Failed to fetch pages');
  const data = await res.json();
  const page = data.data?.[0];
  const igAccount = page?.instagram_business_account;
  if (!igAccount) throw new Error('No Instagram Business account found. Ensure your page is linked to an Instagram Professional account.');
  return igAccount.id;
}

export async function publishReelToInstagram(
  igUserId: string,
  accessToken: string,
  videoUrl: string,
  caption: string
): Promise<string> {
  const containerRes = await fetch(`${GRAPH_API_BASE}/${igUserId}/media`, {
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
      `${GRAPH_API_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const checkData = await checkRes.json();
    status = checkData.status_code;
    attempts++;
  }

  if (status !== 'FINISHED') {
    throw new Error(`Container processing failed with status: ${status}`);
  }

  const publishRes = await fetch(`${GRAPH_API_BASE}/${igUserId}/media_publish`, {
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
  const metrics = 'impressions,reach,likes,comments,shares,saved,plays';
  const res = await fetch(
    `${GRAPH_API_BASE}/${mediaId}/insights?metric=${metrics}&access_token=${accessToken}`
  );

  if (!res.ok) return {};

  const data = await res.json();
  const result: Record<string, number> = {};
  for (const item of data.data || []) {
    result[item.name] = item.values?.[0]?.value || 0;
  }
  return result;
}

export function getInstagramOAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: process.env.META_REDIRECT_URI!,
    scope: 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement',
    response_type: 'code',
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
}
