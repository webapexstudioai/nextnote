-- Verified personal phone for transactional SMS notifications
-- ("send to my phone" — prospect details, generated website URLs,
-- AI receptionist numbers, etc.).
--
-- Distinct from user_caller_ids (which is Twilio-side verification
-- required for RVM outbound caller-id). A user may have a single
-- number registered in both places; this table is purely about
-- "we know this number belongs to this user, send notifications here."

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verified_personal_phone TEXT,
  ADD COLUMN IF NOT EXISTS verified_personal_phone_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS users_verified_personal_phone_idx
  ON users (verified_personal_phone)
  WHERE verified_personal_phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS phone_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS phone_verification_codes_user_phone_idx
  ON phone_verification_codes (user_id, phone_number, created_at DESC);

CREATE INDEX IF NOT EXISTS phone_verification_codes_cleanup_idx
  ON phone_verification_codes (expires_at)
  WHERE consumed_at IS NULL;
