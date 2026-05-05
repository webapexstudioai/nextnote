-- A2P admin-review flow: adds admin_notes column for rejection reasons / approval notes.
-- Status values added in app code (no enum constraint on status):
--   pending_admin_review, admin_approved, admin_rejected
-- These coexist with the legacy Twilio-mapped statuses (profile_pending, etc).

alter table a2p_registrations
  add column if not exists admin_notes text;
