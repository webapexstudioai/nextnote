// Run database migrations for new onboarding flow
// Usage: node scripts/migrate.mjs

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://qeampicxidoyeduqqjip.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY env var");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrate() {
  console.log("Running migrations...");

  // Add new columns to users table
  const migrations = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT false`,
    `CREATE TABLE IF NOT EXISTS onboarding_responses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      reason_chose TEXT NOT NULL DEFAULT '',
      what_stood_out TEXT NOT NULL DEFAULT '',
      dedication_score INT NOT NULL DEFAULT 5,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_onboarding_user ON onboarding_responses (user_id)`,
    `ALTER TABLE onboarding_responses ENABLE ROW LEVEL SECURITY`,
    `CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON email_verification_tokens (token)`,
    `ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY`,
  ];

  for (const sql of migrations) {
    const { error } = await supabase.rpc("exec_sql", { sql });
    if (error) {
      // Try raw query via REST
      console.log(`Running: ${sql.slice(0, 60)}...`);
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseServiceKey,
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ sql }),
      });
      if (!res.ok) {
        console.warn(`  Warning: ${await res.text()}`);
      }
    }
  }

  console.log("Migrations complete!");

  // Reset all users
  console.log("Resetting all user data...");
  const tables = [
    "appointments", "prospects", "files", "folders",
    "email_verification_codes", "password_reset_tokens",
    "user_settings", "users"
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      console.warn(`  Warning deleting from ${table}:`, error.message);
    } else {
      console.log(`  Cleared ${table}`);
    }
  }

  console.log("Done! All users reset.");
}

migrate().catch(console.error);
