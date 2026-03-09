-- =============================================================================
-- Coverig - Migration 002: Instagram Integration + Payments
-- =============================================================================

-- 1. INSTAGRAM ACCOUNTS
CREATE TABLE IF NOT EXISTS instagram_accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instagram_user_id text NOT NULL,
  username          text NOT NULL,
  access_token      text NOT NULL,
  token_expiry      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_ig_accounts_user ON instagram_accounts(user_id);
CREATE INDEX idx_ig_accounts_ig_user ON instagram_accounts(instagram_user_id);

-- 2. INSTAGRAM POSTS
CREATE TABLE IF NOT EXISTS instagram_posts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id          uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  instagram_media_id  text,
  caption             text,
  status              text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'uploading', 'published', 'failed')),
  posted_at           timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ig_posts_user ON instagram_posts(user_id);
CREATE INDEX idx_ig_posts_project ON instagram_posts(project_id);

-- 3. INSTAGRAM ANALYTICS
CREATE TABLE IF NOT EXISTS instagram_analytics (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       uuid NOT NULL REFERENCES instagram_posts(id) ON DELETE CASCADE,
  views         integer NOT NULL DEFAULT 0,
  likes         integer NOT NULL DEFAULT 0,
  comments      integer NOT NULL DEFAULT 0,
  shares        integer NOT NULL DEFAULT 0,
  saves         integer NOT NULL DEFAULT 0,
  reach         integer NOT NULL DEFAULT 0,
  impressions   integer NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_ig_analytics_post ON instagram_analytics(post_id);

-- 4. SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                  text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'starter', 'creator', 'agency')),
  lemon_squeezy_id      text,
  lemon_squeezy_status  text DEFAULT 'active',
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  renders_used          integer NOT NULL DEFAULT 0,
  renders_limit         integer NOT NULL DEFAULT 10,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_ls_id ON subscriptions(lemon_squeezy_id);

-- 5. RLS
ALTER TABLE instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ig_accounts_own" ON instagram_accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ig_posts_own" ON instagram_posts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ig_analytics_own" ON instagram_analytics FOR ALL USING (
  EXISTS (SELECT 1 FROM instagram_posts ip WHERE ip.id = post_id AND ip.user_id = auth.uid())
);
CREATE POLICY "subscriptions_own" ON subscriptions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. TRIGGERS
CREATE TRIGGER set_ig_accounts_updated_at BEFORE UPDATE ON instagram_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Add caption column to scheduled_posts if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_posts' AND column_name = 'caption') THEN
    ALTER TABLE scheduled_posts ADD COLUMN caption text;
  END IF;
END $$;
