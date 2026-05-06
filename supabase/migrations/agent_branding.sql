-- Per-agent business identity (white-label).
-- Each AI receptionist represents a specific prospect business — when the agent
-- emails a caller, the From name, footer, and logo should reflect that prospect,
-- not the NextNote agency owner that created the agent.

alter table user_agents
  add column if not exists business_name text,
  add column if not exists contact_name text,
  add column if not exists business_logo_url text;
