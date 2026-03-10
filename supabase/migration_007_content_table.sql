-- Content: final rendered outputs (library of publishes)
-- Created when user clicks "Save and Publish" from a project
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

ALTER TABLE content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_select_own"
  ON content FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "content_insert_own"
  ON content FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "content_update_own"
  ON content FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "content_delete_own"
  ON content FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_content_user_id ON content(user_id);
CREATE INDEX idx_content_status ON content(status);
CREATE INDEX idx_content_user_status ON content(user_id, status);

CREATE TRIGGER set_content_updated_at
  BEFORE UPDATE ON content
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
