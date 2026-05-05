-- Domain purchase + registration through NextNote (vs. BYO).
-- Tracks each Stripe checkout for a domain buy, the Vercel registration
-- result, and the expiry the user paid through.

CREATE TABLE IF NOT EXISTS domain_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id TEXT REFERENCES generated_websites(id) ON DELETE SET NULL,
  domain TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'registered', 'failed', 'refunded')),
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  amount_cents INT NOT NULL,
  vercel_cost_cents INT,
  expires_at TIMESTAMPTZ,
  contact JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_domain_orders_user ON domain_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_domain_orders_site ON domain_orders (site_id);
CREATE INDEX IF NOT EXISTS idx_domain_orders_domain ON domain_orders (domain);

-- Mark sites whose domain was purchased through NextNote (vs. BYO). The
-- existing `custom_domain*` columns from website_custom_domain.sql still
-- carry the attached value + verification state — we only add the purchase
-- metadata here.
ALTER TABLE generated_websites
  ADD COLUMN IF NOT EXISTS custom_domain_purchased BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS custom_domain_expires_at TIMESTAMPTZ;
