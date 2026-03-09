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
  inputs_json     jsonb NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'queued', 'rendering', 'completed', 'failed')),
  output_video_url text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE projects IS 'User projects created from templates with rendering status';
COMMENT ON COLUMN projects.inputs_json IS 'User-provided values for template fields';
COMMENT ON COLUMN projects.status IS 'Lifecycle: draft -> queued -> rendering -> completed|failed';

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
-- 4. ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

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

-- -----------------------------------------------------------------------------
-- 5. INDEXES
-- -----------------------------------------------------------------------------
-- Projects: filter by user and status
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_user_status ON projects(user_id, status);

-- Scheduled posts: filter by user and status
CREATE INDEX idx_scheduled_posts_user_id ON scheduled_posts(user_id);
CREATE INDEX idx_scheduled_posts_status ON scheduled_posts(status);
CREATE INDEX idx_scheduled_posts_scheduled_time ON scheduled_posts(scheduled_time);

-- -----------------------------------------------------------------------------
-- 6. UPDATED_AT TRIGGER
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

-- -----------------------------------------------------------------------------
-- 7. SEED DATA - Sample Templates
-- -----------------------------------------------------------------------------
INSERT INTO templates (name, description, config_json, status) VALUES
(
  'Product Showcase',
  'Highlight your product with a hook, product clip, and call-to-action. Perfect for e-commerce and launch videos.',
  '{
    "scenes": [
      {
        "scene_name": "Intro",
        "elements": [
          {"type": "text", "label": "Hook Text", "editable": true, "position": "center", "ai_suggest": true}
        ]
      },
      {
        "scene_name": "Product Clip",
        "elements": [
          {"type": "video_slot", "label": "Upload Product Clip", "editable": true}
        ]
      },
      {
        "scene_name": "Ending",
        "elements": [
          {"type": "text", "label": "Call to Action", "editable": true, "position": "bottom", "ai_suggest": true}
        ]
      }
    ]
  }'::jsonb,
  'published'
),
(
  'Talking Head',
  'Record yourself delivering a script with a custom background. Ideal for tutorials, vlogs, and thought leadership.',
  '{
    "scenes": [
      {
        "scene_name": "Hook",
        "elements": [
          {"type": "text", "label": "Hook Text", "editable": true, "position": "center", "ai_suggest": true}
        ]
      },
      {
        "scene_name": "Main Content",
        "elements": [
          {"type": "video_slot", "label": "Upload Your Video", "editable": true},
          {"type": "text", "label": "Script Overlay", "editable": true, "position": "bottom", "ai_suggest": true}
        ]
      },
      {
        "scene_name": "Outro",
        "elements": [
          {"type": "text", "label": "Call to Action", "editable": true, "position": "center", "ai_suggest": true}
        ]
      }
    ]
  }'::jsonb,
  'published'
),
(
  'Before & After',
  'Show transformation with before and after clips. Great for fitness, beauty, home renovation, and makeover content.',
  '{
    "scenes": [
      {
        "scene_name": "Hook",
        "elements": [
          {"type": "text", "label": "Hook Text", "editable": true, "position": "center", "ai_suggest": true}
        ]
      },
      {
        "scene_name": "Before",
        "elements": [
          {"type": "video_slot", "label": "Upload Before Clip", "editable": true},
          {"type": "text", "label": "Before Label", "editable": false, "position": "top", "default_value": "BEFORE"}
        ]
      },
      {
        "scene_name": "After",
        "elements": [
          {"type": "video_slot", "label": "Upload After Clip", "editable": true},
          {"type": "text", "label": "After Label", "editable": false, "position": "top", "default_value": "AFTER"}
        ]
      },
      {
        "scene_name": "Caption",
        "elements": [
          {"type": "text", "label": "Caption Text", "editable": true, "position": "center", "ai_suggest": true}
        ]
      }
    ]
  }'::jsonb,
  'published'
),
(
  'Quick Tips',
  'Share three quick tips with text overlays. Perfect for how-to content and educational posts.',
  '{
    "scenes": [
      {
        "scene_name": "Intro",
        "elements": [
          {"type": "text", "label": "Hook Text", "editable": true, "position": "center", "ai_suggest": true}
        ]
      },
      {
        "scene_name": "Tip 1",
        "elements": [
          {"type": "text", "label": "First Tip", "editable": true, "position": "center", "ai_suggest": true}
        ]
      },
      {
        "scene_name": "Tip 2",
        "elements": [
          {"type": "text", "label": "Second Tip", "editable": true, "position": "center", "ai_suggest": true}
        ]
      },
      {
        "scene_name": "Tip 3",
        "elements": [
          {"type": "text", "label": "Third Tip", "editable": true, "position": "center", "ai_suggest": true}
        ]
      },
      {
        "scene_name": "Outro",
        "elements": [
          {"type": "text", "label": "Call to Action", "editable": true, "position": "bottom", "ai_suggest": true}
        ]
      }
    ]
  }'::jsonb,
  'published'
);
