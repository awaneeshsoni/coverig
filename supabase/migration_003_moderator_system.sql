-- =============================================================================
-- Coverig - Migration 003: Moderator Template System
-- =============================================================================

-- 1. USER PROFILES (role management)
CREATE TABLE IF NOT EXISTS user_profiles (
  id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role      text NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'moderator', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Only service role can insert/update (handled server-side)
CREATE POLICY "profiles_insert_service" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_service" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. ADD COLUMNS TO TEMPLATES
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'templates' AND column_name = 'status') THEN
    ALTER TABLE templates ADD COLUMN status text NOT NULL DEFAULT 'published'
      CHECK (status IN ('draft', 'processing', 'published', 'rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'templates' AND column_name = 'creator_id') THEN
    ALTER TABLE templates ADD COLUMN creator_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_creator ON templates(creator_id);

-- 3. UPDATE TEMPLATE RLS
-- Drop old blanket select policy
DROP POLICY IF EXISTS "templates_select_all" ON templates;

-- Regular users see only published templates
CREATE POLICY "templates_select_published" ON templates
  FOR SELECT USING (
    status = 'published'
    OR creator_id = auth.uid()
  );

-- Moderators/admins can insert
CREATE POLICY "templates_insert_mod" ON templates
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin'))
  );

-- Creator can update their own templates
CREATE POLICY "templates_update_own" ON templates
  FOR UPDATE USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- Creator can delete their own draft/rejected templates
CREATE POLICY "templates_delete_own" ON templates
  FOR DELETE USING (
    creator_id = auth.uid() AND status IN ('draft', 'rejected')
  );

-- 4. Update existing seed templates to 'published' status
UPDATE templates SET status = 'published' WHERE status IS NULL OR status = 'published';

-- 5. Create profiles for existing users
INSERT INTO user_profiles (id, role)
SELECT id, 'user' FROM auth.users
ON CONFLICT (id) DO NOTHING;
