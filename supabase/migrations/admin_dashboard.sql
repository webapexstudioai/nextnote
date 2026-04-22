-- Admin dashboard: flag admin users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Grant admin to the owner account
UPDATE users SET is_admin = true WHERE email = 'webapexstudioai@gmail.com';

CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users (is_admin) WHERE is_admin = true;
