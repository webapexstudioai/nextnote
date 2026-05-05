-- Custom-domain attach for white-label sites: a user can point their own
-- registered domain (mybiz.com or go.mybiz.com) at a generated site. We
-- attach it to our Vercel project and serve it from the same handler that
-- powers `{slug}.pitchsite.dev`, just routed by host instead of slug.
--
-- Status lifecycle:
--   pending  → DNS records added, awaiting Vercel verification + cert
--   verified → Vercel confirms ownership and HTTPS is live
--   error    → Vercel rejected the attach (clash with another project, etc.)

ALTER TABLE generated_websites
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_status TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_attached_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS custom_domain_error TEXT;

-- A given hostname can only point at ONE site across the whole platform.
-- Vercel enforces this on its side too, but enforcing here as well prevents
-- two sites in our DB from racing on the same domain attach.
CREATE UNIQUE INDEX IF NOT EXISTS idx_generated_websites_custom_domain
  ON generated_websites (custom_domain)
  WHERE custom_domain IS NOT NULL;

-- Status check — keep noise out of the column.
ALTER TABLE generated_websites
  DROP CONSTRAINT IF EXISTS generated_websites_custom_domain_status_check;
ALTER TABLE generated_websites
  ADD CONSTRAINT generated_websites_custom_domain_status_check
  CHECK (custom_domain_status IS NULL OR custom_domain_status IN ('pending', 'verified', 'error'));
