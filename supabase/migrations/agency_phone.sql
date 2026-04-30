-- Phase 3: agency phone line (one Twilio number per agency for SMS + voicemail
-- + inbound call forwarding). Distinct from per-prospect AI receptionist numbers.

-- Mark numbers as either AI receptionist (existing) or agency (new).
alter table user_phone_numbers
  add column if not exists purpose text not null default 'ai_receptionist'
  check (purpose in ('ai_receptionist','agency'));

-- Agency numbers don't have an ElevenLabs ID. Make the column nullable.
alter table user_phone_numbers
  alter column elevenlabs_phone_number_id drop not null;

-- The original UNIQUE constraint on elevenlabs_phone_number_id allows multiple
-- NULLs, which is what we want. No further change needed there.

-- Agency owner's personal cell — calls to the agency Twilio number forward here.
alter table users
  add column if not exists forward_to_number text;

-- Helps lookups: "give me this user's agency number".
create index if not exists user_phone_numbers_purpose_idx
  on user_phone_numbers(user_id, purpose);
