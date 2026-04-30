-- Tracks which signup-reminder emails have been sent to which users.
-- Composite PK prevents duplicate sends if the cron retries.

create table if not exists signup_reminders (
  user_id uuid not null references users(id) on delete cascade,
  step smallint not null check (step between 1 and 3),
  sent_at timestamptz not null default now(),
  primary key (user_id, step)
);

create index if not exists idx_signup_reminders_sent_at on signup_reminders (sent_at desc);

-- Per-user opt-out. Toggled by the unsubscribe link in the emails.
alter table users add column if not exists signup_reminders_opted_out boolean not null default false;
