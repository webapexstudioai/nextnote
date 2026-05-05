-- Master log for every browser-answered or browser-placed call.
-- Inbound voicedrop callbacks still write to voicemail_callbacks (for
-- campaign attribution); voice_calls is the source of truth for the
-- *call itself* and the post-call AI summary.

create table if not exists voice_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  prospect_id uuid references prospects(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_number text not null,
  to_number text not null,
  twilio_call_sid text unique,
  parent_call_sid text,
  status text not null default 'in_progress',
  recording_url text,
  recording_sid text,
  recording_duration_sec int,
  transcript text,
  ai_summary jsonb,
  ai_summary_generated_at timestamptz,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists idx_voice_calls_user_started on voice_calls (user_id, started_at desc);
create index if not exists idx_voice_calls_prospect on voice_calls (prospect_id) where prospect_id is not null;

-- Lightweight presence: row exists only when user is "Available". Heartbeat
-- bumps available_until +90s; when stale (now > available_until), inbound
-- calls fall back to cell forwarding.

create table if not exists phone_presence (
  user_id uuid primary key references users(id) on delete cascade,
  available_until timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_phone_presence_available on phone_presence (available_until desc);
