import { supabaseAdmin } from "@/lib/supabase";

// Credit packs — invisible to user, they just see "credits".
// 1 credit = $0.01 retail. Margin built into pack bonuses.
export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  bonusLabel?: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "starter", name: "Starter Pack",  credits: 1000,  priceCents: 1000 },
  { id: "growth",  name: "Growth Pack",   credits: 2750,  priceCents: 2500, bonusLabel: "+10% bonus" },
  { id: "scale",   name: "Scale Pack",    credits: 6000,  priceCents: 5000, bonusLabel: "+20% bonus" },
  { id: "agency",  name: "Agency Pack",   credits: 13000, priceCents: 10000, bonusLabel: "+30% bonus" },
];

// Minimum balance required to start a voice call (~3 minutes at 12 credits/min).
export const MIN_CALL_BALANCE = 50;

// Rates — what we bill users. Cost basis to NextNote is lower (see README).
export const RATE_CREDITS_PER_MIN = 12;          // conversation calls
export const RATE_CREDITS_PER_1K_CHARS = 3;      // TTS
export const RATE_CREDITS_PER_VOICEMAIL = 8;     // voicemail drop

// Phone numbers. Twilio cost is ~$1.15/mo + $1 one-time; we mark up.
export const PHONE_NUMBER_PURCHASE_CREDITS = 500;   // $5 one-time
export const PHONE_NUMBER_MONTHLY_CREDITS = 500;    // $5/mo (cron deducts later)

// AI feature costs — what we bill users per use.
export const WEBSITE_GENERATION_CREDITS = 50;       // $0.50 per standard landing page
export const WEBSITE_WHITELABEL_CREDITS = 200;      // $2.00 per white-label landing page
export const WEBSITE_AI_EDIT_CREDITS = 15;          // $0.15 per AI-powered website edit
export const AI_INSIGHTS_CREDITS = 15;              // $0.15 per insights report
export const AI_PARSE_CREDITS = 5;                  // $0.05 per XLSX/Sheets column mapping
export const NOTE_SUMMARIZE_CREDITS = 5;            // $0.05 per note summarization
export const RECEPTIONIST_BUILD_CREDITS = 25;       // $0.25 per AI receptionist draft
export const AGENT_TEST_CHAT_CREDITS = 3;           // $0.03 per test chat message

// Sign-up bonus — enough to try 1 website + a few AI features.
export const SIGNUP_BONUS_CREDITS = 150;

export function getPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}

export async function getBalance(userId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("credit_balances")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.balance ?? 0;
}

export async function ensureBalanceRow(userId: string): Promise<void> {
  await supabaseAdmin
    .from("credit_balances")
    .upsert({ user_id: userId, balance: 0 }, { onConflict: "user_id", ignoreDuplicates: true });
}

interface AdjustOpts {
  reason: string;
  refId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Atomic-ish: reads balance, writes new balance, logs transaction.
 * Not truly atomic without a DB function, but good enough for low-volume MVP.
 */
async function adjust(userId: string, delta: number, opts: AdjustOpts): Promise<number> {
  await ensureBalanceRow(userId);
  const current = await getBalance(userId);
  const next = current + delta;
  if (next < 0) throw new Error("Insufficient credits");

  const { error: balErr } = await supabaseAdmin
    .from("credit_balances")
    .update({ balance: next, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (balErr) throw new Error(`Balance update failed: ${balErr.message}`);

  const { error: txErr } = await supabaseAdmin.from("credit_transactions").insert({
    user_id: userId,
    delta,
    reason: opts.reason,
    ref_id: opts.refId ?? null,
    metadata: opts.metadata ?? null,
  });
  if (txErr) throw new Error(`Transaction log failed: ${txErr.message}`);

  return next;
}

export async function addCredits(userId: string, amount: number, opts: AdjustOpts): Promise<number> {
  if (amount <= 0) throw new Error("amount must be positive");
  return adjust(userId, amount, opts);
}

export async function deductCredits(userId: string, amount: number, opts: AdjustOpts): Promise<number> {
  if (amount <= 0) throw new Error("amount must be positive");
  return adjust(userId, -amount, opts);
}

export async function hasBeenProcessed(refId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("credit_transactions")
    .select("id")
    .eq("ref_id", refId)
    .maybeSingle();
  return !!data;
}
