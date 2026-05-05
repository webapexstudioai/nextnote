-- Adds read tracking to sms_messages so the chat UI can show unread counts
-- and clear them when the user opens a thread. Only inbound messages are
-- subject to "unread" — outbound is always treated as seen.

alter table sms_messages
  add column if not exists read_at timestamptz;

create index if not exists sms_messages_unread_idx
  on sms_messages (user_id, prospect_id)
  where direction = 'inbound' and read_at is null;
