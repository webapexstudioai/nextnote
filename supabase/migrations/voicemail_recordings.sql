-- Saved voicemail recordings — user's personal library of audio clips
-- they can reuse across voicedrop campaigns.
create table if not exists voicemail_recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  storage_path text not null,
  public_url text not null,
  mime_type text not null,
  duration_seconds int,
  size_bytes int,
  source text not null default 'recorded', -- 'recorded' | 'uploaded'
  created_at timestamptz not null default now()
);

create index if not exists voicemail_recordings_user_idx
  on voicemail_recordings(user_id, created_at desc);
