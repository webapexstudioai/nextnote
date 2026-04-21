-- NextNote Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Users table (auth + profile)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  agency_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  subscription_tier TEXT NOT NULL DEFAULT 'starter',
  subscription_status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- 2. Folders table
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_folders_user ON folders (user_id);

-- 3. Files (import records) table
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  prospect_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_files_folder ON files (folder_id);

-- 4. Prospects table
CREATE TABLE IF NOT EXISTS prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  service TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'New',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospects_user ON prospects (user_id);
CREATE INDEX IF NOT EXISTS idx_prospects_folder ON prospects (folder_id);

-- 5. Appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  duration INT NOT NULL DEFAULT 30,
  meet_link TEXT,
  agenda TEXT,
  meeting_notes TEXT,
  summarized_notes TEXT,
  outcome TEXT NOT NULL DEFAULT 'pending',
  cancel_reason TEXT,
  calendar_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_prospect ON appointments (prospect_id);
CREATE INDEX IF NOT EXISTS idx_appointments_user ON appointments (user_id);

-- 6. Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON password_reset_tokens (token);

-- 7. Email verification OTP codes
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_user ON email_verification_codes (user_id);

-- 8. User settings (API keys, customization)
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  anthropic_api_key_encrypted TEXT,
  openai_api_key_encrypted TEXT,
  accent_color TEXT NOT NULL DEFAULT 'red-orange',
  ui_density TEXT NOT NULL DEFAULT 'default',
  theme_mode TEXT NOT NULL DEFAULT 'dark',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings (user_id);

-- Add email_verified and subscription fields to users table
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'starter';
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active';

-- Row-Level Security (RLS)
-- Enable RLS on all tables (enforced when using anon key)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Service-role key bypasses RLS, so the API routes (which use supabaseAdmin) work fine.
-- If you want browser-side Supabase access in the future, add policies like:
--   CREATE POLICY "users_own_data" ON folders FOR ALL USING (user_id = auth.uid());

-- Migration: Add theme_mode column if it doesn't exist yet
-- ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS theme_mode TEXT NOT NULL DEFAULT 'dark';

-- Migration: Add preferred_provider column for user-specific AI provider selection
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS preferred_provider TEXT NOT NULL DEFAULT 'anthropic';

-- Migration: Cal.com integration so agents can book/reschedule appointments into the user's calendar
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS cal_api_key_encrypted TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS cal_event_type_id TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS cal_timezone TEXT NOT NULL DEFAULT 'America/New_York';

-- Migration: Google Calendar integration (alternative to Cal.com). Tokens live in user_settings
-- so webhook tool calls (which carry no session cookie) can still act on behalf of the user.
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS google_access_token_encrypted TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS google_refresh_token_encrypted TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS google_token_expiry BIGINT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS google_calendar_id TEXT NOT NULL DEFAULT 'primary';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS calendar_provider TEXT; -- 'cal' | 'google' | null

-- Migration: Add Stripe and onboarding fields to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT false;

-- 9. Onboarding responses
CREATE TABLE IF NOT EXISTS onboarding_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  reason_chose TEXT NOT NULL DEFAULT '',
  what_stood_out TEXT NOT NULL DEFAULT '',
  dedication_score INT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_user ON onboarding_responses (user_id);
ALTER TABLE onboarding_responses ENABLE ROW LEVEL SECURITY;

-- 10. Email verification tokens (link-based)
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON email_verification_tokens (token);
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- 11. User-owned ElevenLabs agents (per-user isolation on a shared ElevenLabs account)
CREATE TABLE IF NOT EXISTS user_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  elevenlabs_agent_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_agents_user ON user_agents (user_id);
CREATE INDEX IF NOT EXISTS idx_user_agents_agent_id ON user_agents (elevenlabs_agent_id);
ALTER TABLE user_agents ENABLE ROW LEVEL SECURITY;

-- 12. User-owned ElevenLabs phone numbers
CREATE TABLE IF NOT EXISTS user_phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  elevenlabs_phone_number_id TEXT NOT NULL UNIQUE,
  phone_number TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  twilio_sid TEXT,
  next_renewal_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safe for existing installs.
ALTER TABLE user_phone_numbers
  ADD COLUMN IF NOT EXISTS next_renewal_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days');

CREATE INDEX IF NOT EXISTS idx_user_phone_numbers_user ON user_phone_numbers (user_id);
CREATE INDEX IF NOT EXISTS idx_user_phone_numbers_phone_id ON user_phone_numbers (elevenlabs_phone_number_id);
CREATE INDEX IF NOT EXISTS idx_user_phone_numbers_renewal ON user_phone_numbers (next_renewal_at);
ALTER TABLE user_phone_numbers ENABLE ROW LEVEL SECURITY;

-- 13. Credit balances (prepaid voice minutes / AI usage)
CREATE TABLE IF NOT EXISTS credit_balances (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;

-- 14. Credit ledger (every add/deduct)
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta INT NOT NULL,                       -- positive for add, negative for deduct
  reason TEXT NOT NULL,                     -- 'purchase' | 'conversation' | 'tts' | 'voicemail' | 'refund' | 'adjustment'
  ref_id TEXT,                              -- stripe session id, conversation id, etc.
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON credit_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_ref ON credit_transactions (ref_id);
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- 15. AI-generated landing pages for prospects
CREATE TABLE IF NOT EXISTS generated_websites (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prospect_id TEXT,
  prospect_name TEXT NOT NULL DEFAULT '',
  html_content TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'standard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_generated_websites_user ON generated_websites (user_id);
ALTER TABLE generated_websites ENABLE ROW LEVEL SECURITY;
