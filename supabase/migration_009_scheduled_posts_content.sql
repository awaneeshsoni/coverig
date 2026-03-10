-- =============================================================================
-- Migration 009: Add content_id to scheduled_posts for content-specific scheduling
-- When present, schedule worker uses content's output_video_url instead of project's
-- =============================================================================

-- Add content_id (nullable - when scheduling from content detail we set it)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_posts' AND column_name = 'content_id') THEN
    ALTER TABLE scheduled_posts ADD COLUMN content_id uuid REFERENCES content(id) ON DELETE SET NULL;
    CREATE INDEX idx_scheduled_posts_content_id ON scheduled_posts(content_id);
  END IF;
END $$;
