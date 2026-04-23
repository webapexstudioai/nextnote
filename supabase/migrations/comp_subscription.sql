-- Admin-comped subscriptions: track who was given a free pro account.
-- Distinct from Stripe-paid subscribers so admins can audit comp grants
-- and exclude comps from MRR.
ALTER TABLE users ADD COLUMN IF NOT EXISTS comped_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS comped_by UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_comped_at ON users (comped_at) WHERE comped_at IS NOT NULL;
