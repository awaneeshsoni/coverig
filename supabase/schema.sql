-- =============================================================================
-- Coverig SaaS - Supabase PostgreSQL Schema
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TEMPLATES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  description     text,
  preview_video_url text,
  config_json     jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE templates IS 'Video templates with configurable fields for content creation';
COMMENT ON COLUMN templates.config_json IS 'JSON config containing fields array with name, type, label for each input';

-- -----------------------------------------------------------------------------
-- 2. PROJECTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id     uuid NOT NULL REFERENCES templates(id),
  name            text,
  inputs_json     jsonb NOT NULL DEFAULT '{}',
  output_video_url text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE projects IS 'Editable project source. One project can have many content outputs (renders).';
COMMENT ON COLUMN projects.name IS 'User-defined name. Falls back to template name when empty.';
COMMENT ON COLUMN projects.inputs_json IS 'User-provided values for template fields';

-- -----------------------------------------------------------------------------
-- 3. SCHEDULED POSTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  platform        text NOT NULL CHECK (platform IN ('instagram', 'tiktok')),
  scheduled_time  timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'posted', 'failed')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE scheduled_posts IS 'Posts scheduled to social platforms from completed projects';

-- -----------------------------------------------------------------------------
-- 4. CONTENT (final renders)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id        uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name              text,
  output_video_url  text,
  status            text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'rendering', 'completed', 'failed')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE content IS 'Final rendered outputs - created when user publishes a project';
COMMENT ON COLUMN content.status IS 'Render lifecycle: queued -> rendering -> completed|failed';

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- Templates: anyone can read (public template catalog)
CREATE POLICY "templates_select_all"
  ON templates
  FOR SELECT
  USING (true);

-- Projects: users can CRUD only their own
CREATE POLICY "projects_select_own"
  ON projects
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "projects_insert_own"
  ON projects
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects_update_own"
  ON projects
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects_delete_own"
  ON projects
  FOR DELETE
  USING (auth.uid() = user_id);

-- Scheduled posts: users can CRUD only their own
CREATE POLICY "scheduled_posts_select_own"
  ON scheduled_posts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "scheduled_posts_insert_own"
  ON scheduled_posts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "scheduled_posts_update_own"
  ON scheduled_posts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "scheduled_posts_delete_own"
  ON scheduled_posts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Content: users can CRUD only their own
CREATE POLICY "content_select_own" ON content FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "content_insert_own" ON content FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "content_update_own" ON content FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "content_delete_own" ON content FOR DELETE USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 6. INDEXES
-- -----------------------------------------------------------------------------
-- Projects: filter by user
CREATE INDEX idx_projects_user_id ON projects(user_id);

-- Scheduled posts: filter by user and status
CREATE INDEX idx_scheduled_posts_user_id ON scheduled_posts(user_id);
CREATE INDEX idx_scheduled_posts_status ON scheduled_posts(status);
CREATE INDEX idx_scheduled_posts_scheduled_time ON scheduled_posts(scheduled_time);
CREATE INDEX idx_content_user_id ON content(user_id);
CREATE INDEX idx_content_status ON content(status);
CREATE INDEX idx_content_user_status ON content(user_id, status);

-- -----------------------------------------------------------------------------
-- 8. UPDATED_AT TRIGGER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_content_updated_at
  BEFORE UPDATE ON content
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- No seed templates - use moderator panel to create templates
