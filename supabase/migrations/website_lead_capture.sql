-- Website lead capture: tag prospects by source so users can filter
-- "leads from my generated sites" from bulk-imported lists.
-- Run once in Supabase SQL Editor.

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS source_site_id TEXT;

CREATE INDEX IF NOT EXISTS idx_prospects_source ON prospects (user_id, source);
CREATE INDEX IF NOT EXISTS idx_prospects_source_site ON prospects (source_site_id);
