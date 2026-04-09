import pg from "pg";
const { Client } = pg;

// Supabase direct connection (transaction mode)
const client = new Client({
  host: "aws-0-us-east-1.pooler.supabase.com",
  port: 5432,
  database: "postgres",
  user: "postgres.qeampicxidoyeduqqjip",
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  if (!process.env.DB_PASSWORD) {
    console.error("Set DB_PASSWORD env var (your Supabase database password)");
    process.exit(1);
  }

  await client.connect();
  console.log("Connected to database");

  const queries = [
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

  for (const q of queries) {
    try {
      await client.query(q);
      console.log("OK:", q.slice(0, 60));
    } catch (e) {
      console.warn("WARN:", e.message, "-", q.slice(0, 60));
    }
  }

  await client.end();
  console.log("Done!");
}

run().catch(e => { console.error(e); process.exit(1); });
