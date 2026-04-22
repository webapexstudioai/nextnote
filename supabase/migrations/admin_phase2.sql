-- Admin dashboard Phase 2: notes, audit log, suspend, support chat

-- Per-user internal notes (admin-only)
CREATE TABLE IF NOT EXISTS admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_notes_user ON admin_notes (user_id, created_at DESC);

-- Every admin action gets logged
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_log (admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_log (target_user_id, created_at DESC);

-- Suspend flag on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- Support chat threads + messages
CREATE TABLE IF NOT EXISTS support_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_unread BOOLEAN NOT NULL DEFAULT false,
  admin_unread BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_threads_user ON support_threads (user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_threads_admin_unread ON support_threads (admin_unread, last_message_at DESC);

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_admin BOOLEAN NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_messages_thread ON support_messages (thread_id, created_at ASC);
