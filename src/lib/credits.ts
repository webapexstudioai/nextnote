import { supabaseAdmin } from "@/lib/supabase";

// Credits model (simplified): users subscribe to Starter or Pro and can
// ad-hoc top up at a flat $0.01/credit via /api/credits/topup. There are
// no tiered "credit packs" anymore.

// Minimum balance required to start a voice call (~4 minutes at 16 credits/min).
export const MIN_CALL_BALANCE = 64;

// Rates — what we bill users. Cost basis to NextNote is lower; see
// /admin/pricing for the current cost vs retail breakdown. All rates
// are tuned so every feature clears at least 15% margin even at the
// Agency-pack floor ($0.0077/credit).
export const RATE_CREDITS_PER_MIN = 16;          // voice calls (covers ElevenLabs Conv AI ~$0.09/min + Twilio PSTN ~$0.01/min)
export const RATE_CREDITS_PER_1K_CHARS = 25;     // TTS (ElevenLabs ~$0.15/1K chars — floor-safe with 15%+ margin)
export const RATE_CREDITS_PER_VOICEMAIL = 13;    // voicemail drop (Twilio PSTN + ElevenLabs TTS ~$0.08 upstream)
export const RATE_CREDITS_PER_SMS = 5;           // SMS send (Twilio ~$0.0079 per segment, US/Canada — generous margin for multi-segment)

// Phone numbers. Twilio cost is ~$1.15/mo + $1 one-time; we mark up.
export const PHONE_NUMBER_PURCHASE_CREDITS = 500;   // $5 one-time
export const PHONE_NUMBER_MONTHLY_CREDITS = 500;    // $5/mo (cron deducts later)

// AI feature costs — what we bill users per use.
export const WEBSITE_GENERATION_CREDITS = 50;       // $0.50 per standard landing page
export const WEBSITE_WHITELABEL_CREDITS = 200;      // $2.00 per white-label landing page
export const WEBSITE_AI_EDIT_CREDITS = 25;          // $0.25 per AI-powered website edit (Claude re-emits full HTML ~$0.14 cost)
export const AI_INSIGHTS_CREDITS = 15;              // $0.15 per insights report
export const AI_PARSE_CREDITS = 5;                  // $0.05 per XLSX/Sheets column mapping
export const NOTE_SUMMARIZE_CREDITS = 5;            // $0.05 per note summarization
export const RECEPTIONIST_BUILD_CREDITS = 25;       // $0.25 per AI receptionist draft
export const AGENT_TEST_CHAT_CREDITS = 3;           // $0.03 per test chat message
export const IMPORT_PROSPECT_CREDITS = 5;           // $0.05 per prospect imported from Google Maps
export const LEAD_AUDIT_CREDITS = 50;               // $0.50 per lead qualifier audit (Outscraper reviews + Google PSI + Claude synthesis)

// Sign-up bonus — enough to try 1 website + a few AI features.
export const SIGNUP_BONUS_CREDITS = 150;

// Pricing-page metadata: declarative list of every billable feature + its
// upstream cost (best current estimate). Used by the admin pricing dashboard
// so you can eyeball margins without re-reading this file.
export interface PricingEntry {
  key: string;
  label: string;
  unit: string;
  creditsPerUnit: number;
  estUpstreamCostUsd: number;
  upstream: string;
  notes?: string;
}

export const PRICING_TABLE: PricingEntry[] = [
  { key: "website_gen",      label: "Website generation",   unit: "per site",         creditsPerUnit: WEBSITE_GENERATION_CREDITS, estUpstreamCostUsd: 0.19,  upstream: "Claude Sonnet 4 + gpt-image-1 logo + Pexels" },
  { key: "website_wl",       label: "Website (white-label)", unit: "per site",        creditsPerUnit: WEBSITE_WHITELABEL_CREDITS, estUpstreamCostUsd: 0.19,  upstream: "Same as generation — branding-only delta" },
  { key: "website_edit",     label: "Website AI edit",       unit: "per edit",        creditsPerUnit: WEBSITE_AI_EDIT_CREDITS,    estUpstreamCostUsd: 0.14,  upstream: "Claude Sonnet 4 (re-emits whole HTML)" },
  { key: "ai_insights",      label: "AI insights report",    unit: "per report",      creditsPerUnit: AI_INSIGHTS_CREDITS,        estUpstreamCostUsd: 0.025, upstream: "Claude Sonnet 4 (summary)" },
  { key: "ai_parse",         label: "XLSX column mapping",   unit: "per import",      creditsPerUnit: AI_PARSE_CREDITS,           estUpstreamCostUsd: 0.012, upstream: "Claude Haiku" },
  { key: "note_summarize",   label: "Note summarization",    unit: "per note",        creditsPerUnit: NOTE_SUMMARIZE_CREDITS,     estUpstreamCostUsd: 0.010, upstream: "Claude Haiku" },
  { key: "receptionist",     label: "AI receptionist build", unit: "per draft",       creditsPerUnit: RECEPTIONIST_BUILD_CREDITS, estUpstreamCostUsd: 0.020, upstream: "Claude Sonnet 4 (prompt draft)" },
  { key: "agent_chat",       label: "Agent test chat",       unit: "per message",     creditsPerUnit: AGENT_TEST_CHAT_CREDITS,    estUpstreamCostUsd: 0.004, upstream: "Claude Haiku" },
  { key: "import_prospect",  label: "Import prospect",       unit: "per lookup",      creditsPerUnit: IMPORT_PROSPECT_CREDITS,    estUpstreamCostUsd: 0.017, upstream: "Google Places Details API" },
  { key: "lead_audit",       label: "Lead Qualifier audit",  unit: "per prospect",    creditsPerUnit: LEAD_AUDIT_CREDITS,         estUpstreamCostUsd: 0.150, upstream: "Outscraper Maps Reviews + Google PSI + Claude Sonnet 4" },
  { key: "voice_call",       label: "Voice call",            unit: "per minute",      creditsPerUnit: RATE_CREDITS_PER_MIN,       estUpstreamCostUsd: 0.100, upstream: "ElevenLabs Conv AI + telecom carrier" },
  { key: "tts",              label: "Text-to-speech",        unit: "per 1K chars",    creditsPerUnit: RATE_CREDITS_PER_1K_CHARS,  estUpstreamCostUsd: 0.150, upstream: "ElevenLabs TTS" },
  { key: "voicemail",        label: "Voicemail drop",        unit: "per drop",        creditsPerUnit: RATE_CREDITS_PER_VOICEMAIL, estUpstreamCostUsd: 0.080, upstream: "Telecom carrier + ElevenLabs TTS (~500 chars)" },
  { key: "sms",              label: "SMS follow-up",         unit: "per message",     creditsPerUnit: RATE_CREDITS_PER_SMS,       estUpstreamCostUsd: 0.0079, upstream: "Carrier SMS (US/Canada per segment)" },
  { key: "phone_purchase",   label: "Phone number purchase", unit: "one-time",        creditsPerUnit: PHONE_NUMBER_PURCHASE_CREDITS, estUpstreamCostUsd: 1.00, upstream: "Carrier number purchase" },
  { key: "phone_monthly",    label: "Phone number monthly",  unit: "per month",       creditsPerUnit: PHONE_NUMBER_MONTHLY_CREDITS, estUpstreamCostUsd: 1.15, upstream: "Carrier monthly fee" },
];

// 1 credit = $0.01 retail (exact-topup rate, the only rate users pay).
export const CREDIT_UNIT_USD_RETAIL = 0.01;

// Pack metadata lives in a client-safe module so client components can import
// it without dragging in supabaseAdmin. Re-exported here for server callers
// who already import from @/lib/credits.
export { CREDIT_PACKS, getCreditPack, type CreditPack } from "./creditPacks";

export async function getBalance(userId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("credit_balances")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.balance ?? 0;
}

// Velocity guardrail. Sums all debits in the last 24h.
export async function getDailySpend(userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from("credit_transactions")
    .select("delta")
    .eq("user_id", userId)
    .lt("delta", 0)
    .gte("created_at", since);
  return (data ?? []).reduce((acc, t) => acc + Math.abs(t.delta), 0);
}

// Returns the cap (credits/24h) or null for unlimited.
export async function getDailyCap(userId: string): Promise<number | null> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("daily_credit_cap")
    .eq("id", userId)
    .maybeSingle();
  return data?.daily_credit_cap ?? null;
}

export class DailyCapExceededError extends Error {
  cap: number;
  spent: number;
  attempted: number;
  constructor(cap: number, spent: number, attempted: number) {
    super(`Daily spend cap reached. Try again in 24 hours or contact support.`);
    this.name = "DailyCapExceededError";
    this.cap = cap;
    this.spent = spent;
    this.attempted = attempted;
  }
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

  const cap = await getDailyCap(userId);
  if (cap !== null) {
    const spent = await getDailySpend(userId);
    if (spent + amount > cap) {
      throw new DailyCapExceededError(cap, spent, amount);
    }
  }

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
