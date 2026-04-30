-- White-label sites are served at {slug}.pitchsite.dev. Slugs are unique
-- per user (so two different agency owners can both have a "bay-area-roofing"
-- without colliding) and case-insensitive lowercased.

ALTER TABLE generated_websites
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Look-up index for the public subdomain serve path.
CREATE INDEX IF NOT EXISTS idx_generated_websites_slug
  ON generated_websites (slug)
  WHERE slug IS NOT NULL;

-- Per-user slug uniqueness — protects against collisions on insert and lets us
-- safely auto-suffix duplicates ("-2", "-3", ...).
CREATE UNIQUE INDEX IF NOT EXISTS idx_generated_websites_user_slug
  ON generated_websites (user_id, slug)
  WHERE slug IS NOT NULL;
