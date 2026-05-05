-- Lead Qualifier audits — caches the result of a multi-signal audit run
-- against a single prospect. One row per (user, prospect). 30-day TTL is
-- enforced in app code: older audits trigger a fresh paid run.

create table if not exists lead_audits (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  prospect_id uuid not null references prospects(id) on delete cascade,

  -- Top-line scores (0-100). NULL until a successful audit completes.
  ai_receptionist_score integer,
  website_score integer,
  overall_score integer,

  -- "low" | "medium" | "high" — based on signal completeness.
  confidence text,

  -- Synthesis output: JSON arrays of pitch hooks, signal evidence, etc.
  pitch_hooks jsonb,
  signals jsonb,

  -- Raw fetched data we synthesized from. Useful for debugging and so the
  -- UI can show evidence quotes ("review #3 mentioned 'no callback'…").
  raw_reviews jsonb,
  raw_pagespeed jsonb,

  -- Snapshot of prospect fields at audit time (so reruns can detect drift).
  snapshot_phone text,
  snapshot_website text,
  snapshot_address text,
  snapshot_name text,

  status text not null default 'pending', -- 'pending' | 'complete' | 'failed'
  error_message text,
  credits_charged integer not null default 0,

  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz
);

create unique index if not exists lead_audits_user_prospect_idx on lead_audits(user_id, prospect_id);
create index if not exists lead_audits_user_created_idx on lead_audits(user_id, created_at desc);
create index if not exists lead_audits_overall_idx on lead_audits(user_id, overall_score desc);
