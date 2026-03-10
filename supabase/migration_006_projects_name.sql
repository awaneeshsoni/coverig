-- Add user-defined name to projects for easy remixing (e.g. "Q1 Promo v1", "Product Launch")
ALTER TABLE projects ADD COLUMN IF NOT EXISTS name text;

COMMENT ON COLUMN projects.name IS 'User-defined name for the render (e.g. "Q1 Promo v1"). Falls back to template name when empty.';
