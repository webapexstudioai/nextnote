-- SMS follow-up automation
-- Run this in the Supabase SQL editor.

-- Reusable SMS message templates per user. Body uses {placeholders}:
--   {first_name}   first word of prospect.contact_name (fallback: prospect.name)
--   {name}         prospect.contact_name
--   {business}     prospect.name
--   {my_name}      sender (users.name)
--   {my_agency}    sender (users.agency_name)
create table if not exists sms_templates (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sms_templates_user_idx on sms_templates(user_id, created_at desc);

-- Outbound + inbound SMS log. One row per Twilio message.
create table if not exists sms_messages (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  prospect_id uuid references prospects(id) on delete set null,
  template_id uuid references sms_templates(id) on delete set null,
  direction text not null check (direction in ('outbound','inbound')),
  body text not null,
  to_number text not null,
  from_number text not null,
  twilio_sid text,
  status text not null default 'queued',
  error_message text,
  call_log_id uuid,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz
);
create index if not exists sms_messages_user_idx on sms_messages(user_id, created_at desc);
create index if not exists sms_messages_prospect_idx on sms_messages(prospect_id, created_at desc);
create index if not exists sms_messages_sid_idx on sms_messages(twilio_sid);

-- Logged call outcomes per prospect. Phase 2 will read 'no_answer' rows to
-- auto-trigger SMS; Phase 1 only writes them and lets the user manually fire.
create table if not exists prospect_call_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  prospect_id uuid not null references prospects(id) on delete cascade,
  outcome text not null check (outcome in ('answered','no_answer','voicemail','busy','wrong_number')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists prospect_call_logs_prospect_idx on prospect_call_logs(prospect_id, created_at desc);
create index if not exists prospect_call_logs_user_idx on prospect_call_logs(user_id, created_at desc);
