-- SMS Phase 2: sequences, enrollments, opt-outs.

-- A reusable multi-step follow-up flow. trigger='no_answer'|'voicemail'|'busy'|null.
-- When a call is logged with that outcome, the prospect is auto-enrolled.
create table if not exists sms_sequences (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  trigger text check (trigger in ('no_answer','voicemail','busy')),
  default_from_number text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sms_sequences_user_idx on sms_sequences(user_id, created_at desc);
-- Only one enabled sequence per user per trigger (otherwise auto-enroll is ambiguous).
create unique index if not exists sms_sequences_trigger_unique
  on sms_sequences(user_id, trigger) where trigger is not null and enabled = true;

-- Ordered steps in a sequence. delay_hours = wait from previous step
-- (or from enrollment for step_order=0).
create table if not exists sms_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references sms_sequences(id) on delete cascade,
  step_order int not null,
  delay_hours int not null default 0 check (delay_hours >= 0),
  template_id uuid not null references sms_templates(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (sequence_id, step_order)
);

-- Active and historical enrollments. current_step_order = the next step to send.
-- next_send_at = when the cron should fire it. Status transitions:
--   active -> completed (ran out of steps)
--   active -> halted_reply (prospect texted back)
--   active -> halted_stop (prospect sent STOP)
--   active -> halted_failed (Twilio rejected, credits empty, etc.)
--   active -> halted_manual (user clicked Halt)
create table if not exists sms_sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  prospect_id uuid not null references prospects(id) on delete cascade,
  sequence_id uuid not null references sms_sequences(id) on delete cascade,
  from_number text not null,
  current_step_order int not null default 0,
  status text not null default 'active'
    check (status in ('active','completed','halted_reply','halted_stop','halted_failed','halted_manual')),
  next_send_at timestamptz,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error text
);
create index if not exists sms_enrollments_due_idx
  on sms_sequence_enrollments(next_send_at) where status = 'active';
create index if not exists sms_enrollments_prospect_idx
  on sms_sequence_enrollments(prospect_id, status);
create index if not exists sms_enrollments_user_idx
  on sms_sequence_enrollments(user_id, enrolled_at desc);
-- Prevent double-enrollment in the same active sequence.
create unique index if not exists sms_enrollments_active_unique
  on sms_sequence_enrollments(prospect_id, sequence_id) where status = 'active';

-- A prospect (by phone) who replied STOP. Send route checks this before sending.
create table if not exists sms_opt_outs (
  user_id text not null,
  phone_number text not null,
  opted_out_at timestamptz not null default now(),
  source text,
  primary key (user_id, phone_number)
);

-- Link sms_messages.enrollment_id so the cron knows which row triggered which message.
alter table sms_messages add column if not exists enrollment_id uuid references sms_sequence_enrollments(id) on delete set null;
alter table sms_messages add column if not exists step_order int;
