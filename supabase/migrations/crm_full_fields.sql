-- CRM: extended prospect fields + canonical file count trigger
-- Run once in Supabase SQL Editor.

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS maps_url TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS deal_value NUMERIC;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS generated_website_id TEXT;

-- Relax users defaults so signup can create 'pending' accounts without a tier
ALTER TABLE users ALTER COLUMN subscription_tier DROP NOT NULL;
ALTER TABLE users ALTER COLUMN subscription_tier DROP DEFAULT;
ALTER TABLE users ALTER COLUMN subscription_status SET DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_prospects_file ON prospects (file_id);
