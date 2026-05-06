-- Move AI receptionist phone numbers from credit-based monthly billing to a
-- real Stripe subscription per number ($5/mo). Credits stay reserved for AI
-- usage so users don't see their balance silently drained by line rentals.
--
-- Numbers that already exist with NULL stripe_subscription_id keep working on
-- the legacy credits cron; new purchases populate this column and are
-- skipped by that cron.

alter table user_phone_numbers
  add column if not exists stripe_subscription_id text;

create index if not exists user_phone_numbers_stripe_subscription_id_idx
  on user_phone_numbers(stripe_subscription_id)
  where stripe_subscription_id is not null;
