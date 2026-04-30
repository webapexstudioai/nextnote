-- Free 14-day trial for the agency phone line. New subscribers can claim a
-- Twilio number with no charge; if they don't pay the $5 one-time fee
-- before trial_ends_at + 3 days, the cron releases the number.

alter table user_phone_numbers
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz;

-- One trial per account, ever. Stamped the moment the user claims their
-- first free number. Guards against re-claim after the trial ended.
alter table users
  add column if not exists phone_trial_used_at timestamptz;

-- Cron filters expired trials by trial_ends_at on user_phone_numbers.
create index if not exists user_phone_numbers_trial_ends_at_idx
  on user_phone_numbers(trial_ends_at)
  where trial_ends_at is not null;
