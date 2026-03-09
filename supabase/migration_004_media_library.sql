-- Media Library: stores every asset uploaded by moderators for reuse
CREATE TABLE IF NOT EXISTS media_assets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  uploader_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  url text NOT NULL,
  filename text,
  file_type text NOT NULL CHECK (file_type IN ('video', 'image')),
  content_type text,
  file_size bigint,
  category text DEFAULT 'other' CHECK (category IN ('backgrounds', 'overlays', 'clips', 'logos', 'other')),
  tags text[] DEFAULT '{}',
  thumbnail_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_file_type ON media_assets(file_type);
CREATE INDEX IF NOT EXISTS idx_media_assets_category ON media_assets(category);
CREATE INDEX IF NOT EXISTS idx_media_assets_uploader ON media_assets(uploader_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_created ON media_assets(created_at DESC);

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

-- All authenticated users can browse the library
CREATE POLICY media_select_auth ON media_assets FOR SELECT TO authenticated USING (true);

-- Only moderators/admins can insert (enforced at API level too, but belt-and-suspenders)
CREATE POLICY media_insert_mod ON media_assets FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin')
    )
  );

-- Uploaders can delete their own assets; admins can delete any
CREATE POLICY media_delete_own ON media_assets FOR DELETE TO authenticated
  USING (
    uploader_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
