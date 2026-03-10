-- Remove status from projects - status now lives on content (one project, multiple render outputs)
DROP INDEX IF EXISTS idx_projects_status;
DROP INDEX IF EXISTS idx_projects_user_status;
ALTER TABLE projects DROP COLUMN IF EXISTS status;

COMMENT ON TABLE projects IS 'Editable project source. One project can have many content outputs (renders).';
