const LS_API = 'https://api.lemonsqueezy.com/v1';

function headers() {
  return {
    Authorization: `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}`,
    'Content-Type': 'application/vnd.api+json',
    Accept: 'application/vnd.api+json',
  };
}

export type PlanType = 'free' | 'starter' | 'creator' | 'agency';

const VARIANT_MAP: Record<string, PlanType> = {};

function getVariantMap(): Record<string, PlanType> {
  if (Object.keys(VARIANT_MAP).length === 0) {
    if (process.env.LEMON_SQUEEZY_STARTER_VARIANT_ID)
      VARIANT_MAP[process.env.LEMON_SQUEEZY_STARTER_VARIANT_ID] = 'starter';
    if (process.env.LEMON_SQUEEZY_CREATOR_VARIANT_ID)
      VARIANT_MAP[process.env.LEMON_SQUEEZY_CREATOR_VARIANT_ID] = 'creator';
    if (process.env.LEMON_SQUEEZY_AGENCY_VARIANT_ID)
      VARIANT_MAP[process.env.LEMON_SQUEEZY_AGENCY_VARIANT_ID] = 'agency';
  }
  return VARIANT_MAP;
}

export function planFromVariantId(variantId: string): PlanType {
  return getVariantMap()[variantId] || 'free';
}

export const PLAN_RENDER_LIMITS: Record<PlanType, number> = {
  free: 10,
  starter: 100,
  creator: 500,
  agency: 2000,
};

export async function createCheckoutUrl(
  variantId: string,
  userId: string,
  email: string
): Promise<string> {
  const res = await fetch(`${LS_API}/checkouts`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email,
            custom: { user_id: userId },
          },
          product_options: {
            redirect_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing?success=true`,
          },
        },
        relationships: {
          store: { data: { type: 'stores', id: process.env.LEMON_SQUEEZY_STORE_ID! } },
          variant: { data: { type: 'variants', id: variantId } },
        },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.errors?.[0]?.detail || 'Failed to create checkout');
  }

  const data = await res.json();
  return data.data.attributes.url;
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const res = await fetch(`${LS_API}/subscriptions/${subscriptionId}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) throw new Error('Failed to cancel subscription');
}
