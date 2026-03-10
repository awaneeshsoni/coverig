-- Remove seed/fake templates (keep only user-created ones)
DELETE FROM templates
WHERE name IN ('Product Showcase', 'Talking Head', 'Before & After', 'Quick Tips')
  AND creator_id IS NULL;
