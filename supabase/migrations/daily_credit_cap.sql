-- Per-user velocity guardrail. Even if a user has plenty of credits, this caps
-- how much can be deducted in any rolling 24h window — protects against runaway
-- loops, compromised accounts, or a single user accidentally burning through
-- everything in one day. NULL = unlimited (admins; trusted accounts).
alter table users
  add column if not exists daily_credit_cap integer default 5000;

-- Helper index for the rolling 24h sum lookup.
create index if not exists credit_transactions_user_recent_idx
  on credit_transactions (user_id, created_at desc)
  where delta < 0;
