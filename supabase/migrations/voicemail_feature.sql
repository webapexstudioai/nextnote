-- Voicemail Drop feature schema
-- Run this in the Supabase SQL editor.

-- Verified caller IDs (each user's personal phone, verified via Twilio)
create table if not exists user_caller_ids (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  phone_number text not null,
  friendly_name text,
  twilio_validation_sid text,
  twilio_caller_id_sid text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);
create unique index if not exists user_caller_ids_user_phone_idx
  on user_caller_ids(user_id, phone_number);
create index if not exists user_caller_ids_user_idx on user_caller_ids(user_id);

-- Voicemail campaigns (one per batch send)
create table if not exists voicemail_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  audio_url text not null,
  from_number text not null,
  total_drops int not null default 0,
  successful_drops int not null default 0,
  failed_drops int not null default 0,
  credits_spent int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists voicemail_campaigns_user_idx on voicemail_campaigns(user_id);

-- Individual voicemail drops (one per prospect)
create table if not exists voicemail_drops (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references voicemail_campaigns(id) on delete cascade,
  user_id text not null,
  prospect_id text,
  prospect_name text,
  to_number text not null,
  from_number text not null,
  twilio_call_sid text,
  answered_by text,
  status text not null default 'queued',
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists voicemail_drops_user_idx on voicemail_drops(user_id);
create index if not exists voicemail_drops_campaign_idx on voicemail_drops(campaign_id);
create index if not exists voicemail_drops_call_sid_idx on voicemail_drops(twilio_call_sid);
