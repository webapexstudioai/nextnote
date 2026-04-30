-- Inbound callbacks from voicedrop campaigns.
-- When a prospect calls back the Twilio number a drop was sent from, we
-- log the inbound call here so the user has a tracked feed instead of
-- just an unattributed ring on their cell.

create table if not exists voicemail_callbacks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  campaign_id uuid references voicemail_campaigns(id) on delete set null,
  prospect_id text,
  prospect_name text,
  from_number text not null,
  to_number text not null,
  twilio_call_sid text unique,
  recording_url text,
  recording_duration_sec int,
  forwarded_to text,
  status text not null default 'in_progress',
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists voicemail_callbacks_user_idx on voicemail_callbacks(user_id, started_at desc);
create index if not exists voicemail_callbacks_campaign_idx on voicemail_callbacks(campaign_id);
create index if not exists voicemail_callbacks_prospect_idx on voicemail_callbacks(prospect_id);
create index if not exists voicemail_callbacks_call_sid_idx on voicemail_callbacks(twilio_call_sid);

-- Index used by the inbound webhook to match a callback's (from_number, to_number)
-- back to the most recent outbound drop. Speeds up campaign/prospect attribution.
create index if not exists voicemail_drops_to_from_recent_idx
  on voicemail_drops(to_number, from_number, created_at desc);
