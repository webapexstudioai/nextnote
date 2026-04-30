import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { stripe } from "@/lib/stripe";

interface ProviderResult {
  id: string;
  name: string;
  status: "ok" | "error" | "not_configured";
  // Primary $ balance (or estimated $ spend) shown big on the card.
  balanceUsd?: number;
  // For providers that meter usage instead of dollars (ElevenLabs characters).
  usageLabel?: string;
  usagePct?: number;
  // Free-form details rendered as a small label below the big number.
  detail?: string;
  link: string;
  error?: string;
  fetchedAt: string;
}

async function fetchTwilio(): Promise<ProviderResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const link = "https://console.twilio.com/us1/billing/manage-billing";
  const base: ProviderResult = { id: "twilio", name: "Twilio", status: "not_configured", link, fetchedAt: new Date().toISOString() };

  if (!sid || !token) return base;

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`,
      { headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` }, cache: "no-store" },
    );
    if (!res.ok) {
      return { ...base, status: "error", error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return {
      ...base,
      status: "ok",
      balanceUsd: parseFloat(data.balance) || 0,
      detail: `${data.currency || "USD"} balance`,
    };
  } catch (e) {
    return { ...base, status: "error", error: e instanceof Error ? e.message : "Failed" };
  }
}

async function fetchStripe(): Promise<ProviderResult> {
  const link = "https://dashboard.stripe.com/balance";
  const base: ProviderResult = { id: "stripe", name: "Stripe", status: "not_configured", link, fetchedAt: new Date().toISOString() };
  if (!process.env.STRIPE_SECRET_KEY) return base;

  try {
    const balance = await stripe.balance.retrieve();
    const available = balance.available.reduce((sum, b) => sum + (b.currency === "usd" ? b.amount : 0), 0) / 100;
    const pending = balance.pending.reduce((sum, b) => sum + (b.currency === "usd" ? b.amount : 0), 0) / 100;
    return {
      ...base,
      status: "ok",
      balanceUsd: available,
      detail: pending > 0 ? `+ $${pending.toFixed(2)} pending` : "available now",
    };
  } catch (e) {
    return { ...base, status: "error", error: e instanceof Error ? e.message : "Failed" };
  }
}

async function fetchElevenLabs(): Promise<ProviderResult> {
  const key = process.env.ELEVENLABS_API_KEY;
  const link = "https://elevenlabs.io/app/subscription";
  const base: ProviderResult = { id: "elevenlabs", name: "ElevenLabs", status: "not_configured", link, fetchedAt: new Date().toISOString() };
  if (!key) return base;

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": key },
      cache: "no-store",
    });
    if (!res.ok) {
      return { ...base, status: "error", error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const used = Number(data.character_count) || 0;
    const limit = Number(data.character_limit) || 0;
    const pct = limit > 0 ? (used / limit) * 100 : 0;
    const remaining = limit - used;
    return {
      ...base,
      status: "ok",
      usageLabel: `${remaining.toLocaleString()} chars left`,
      usagePct: pct,
      detail: `${data.tier || "Plan"} · ${used.toLocaleString()} / ${limit.toLocaleString()}`,
    };
  } catch (e) {
    return { ...base, status: "error", error: e instanceof Error ? e.message : "Failed" };
  }
}

async function fetchOutscraper(): Promise<ProviderResult> {
  const key = process.env.OUTSCRAPER_API_KEY;
  const link = "https://app.outscraper.com/profile";
  const base: ProviderResult = { id: "outscraper", name: "Outscraper", status: "not_configured", link, fetchedAt: new Date().toISOString() };
  if (!key) return base;

  try {
    const res = await fetch("https://api.app.outscraper.com/profile", {
      headers: { "X-API-KEY": key },
      cache: "no-store",
    });
    if (!res.ok) {
      return { ...base, status: "error", error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const balance = parseFloat(data?.balance ?? data?.credits ?? "0") || 0;
    return {
      ...base,
      status: "ok",
      balanceUsd: balance,
      detail: data?.plan ? `Plan: ${data.plan}` : "credits balance",
    };
  } catch (e) {
    return { ...base, status: "error", error: e instanceof Error ? e.message : "Failed" };
  }
}

// Anthropic Admin API — usage report for the current billing month.
// Requires `ANTHROPIC_ADMIN_KEY` (an `sk-ant-admin-...` key, NOT the regular API key).
async function fetchAnthropicUsage(): Promise<ProviderResult> {
  const key = process.env.ANTHROPIC_ADMIN_KEY;
  const link = "https://console.anthropic.com/settings/billing";
  const base: ProviderResult = { id: "anthropic", name: "Anthropic (30d usage)", status: "not_configured", link, fetchedAt: new Date().toISOString() };
  if (!key) return base;

  try {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 30);
    const startsAt = start.toISOString();
    const res = await fetch(
      `https://api.anthropic.com/v1/organizations/usage_report/messages?starts_at=${encodeURIComponent(startsAt)}&group_by[]=model`,
      {
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      return { ...base, status: "error", error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    type Bucket = { results?: Array<{ uncached_input_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number; output_tokens?: number; model?: string }> };
    const buckets: Bucket[] = Array.isArray(data?.data) ? data.data : [];
    let inputTokens = 0;
    let outputTokens = 0;
    for (const b of buckets) {
      for (const r of b.results ?? []) {
        inputTokens += (r.uncached_input_tokens ?? 0) + (r.cache_creation_input_tokens ?? 0) + (r.cache_read_input_tokens ?? 0);
        outputTokens += r.output_tokens ?? 0;
      }
    }
    // Rough Sonnet 4.x pricing for a ballpark $: $3/M input, $15/M output.
    // This is intentionally approximate — actual cost varies by model.
    const estUsd = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;
    return {
      ...base,
      status: "ok",
      balanceUsd: estUsd,
      detail: `${(inputTokens / 1000).toFixed(1)}K in · ${(outputTokens / 1000).toFixed(1)}K out (est)`,
    };
  } catch (e) {
    return { ...base, status: "error", error: e instanceof Error ? e.message : "Failed" };
  }
}

// OpenAI Admin API — costs for the current billing month.
// Requires `OPENAI_ADMIN_KEY` (an `sk-admin-...` key, NOT the regular API key).
async function fetchOpenAIUsage(): Promise<ProviderResult> {
  const key = process.env.OPENAI_ADMIN_KEY;
  const link = "https://platform.openai.com/usage";
  const base: ProviderResult = { id: "openai", name: "OpenAI (30d usage)", status: "not_configured", link, fetchedAt: new Date().toISOString() };
  if (!key) return base;

  try {
    const startSec = Math.floor((Date.now() - 30 * 86400 * 1000) / 1000);
    const res = await fetch(
      `https://api.openai.com/v1/organization/costs?start_time=${startSec}&bucket_width=1d`,
      {
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      return { ...base, status: "error", error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    type CostResult = { amount?: { value?: number; currency?: string } };
    type Bucket = { results?: CostResult[] };
    const buckets: Bucket[] = Array.isArray(data?.data) ? data.data : [];
    let total = 0;
    for (const b of buckets) {
      for (const r of b.results ?? []) {
        total += r.amount?.value ?? 0;
      }
    }
    return {
      ...base,
      status: "ok",
      balanceUsd: total,
      detail: "spent in last 30 days",
    };
  } catch (e) {
    return { ...base, status: "error", error: e instanceof Error ? e.message : "Failed" };
  }
}

// Static "fixed monthly" infra costs — set via env so you can stamp the
// monthly committed spend without an API call (Vercel, Supabase, Resend, etc).
function fixedMonthly(): ProviderResult[] {
  const raw = process.env.INFRA_FIXED_MONTHLY_USD;
  if (!raw) return [];
  // Format: "Vercel:20,Supabase:25,Resend:0"
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, amount] = entry.split(":").map((s) => s.trim());
      const usd = parseFloat(amount) || 0;
      return {
        id: `fixed-${name.toLowerCase()}`,
        name,
        status: "ok" as const,
        balanceUsd: usd,
        detail: "fixed monthly cost",
        link: "",
        fetchedAt: new Date().toISOString(),
      };
    });
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const [twilio, stripeRes, elevenlabs, outscraper, anthropic, openai] = await Promise.all([
    fetchTwilio(),
    fetchStripe(),
    fetchElevenLabs(),
    fetchOutscraper(),
    fetchAnthropicUsage(),
    fetchOpenAIUsage(),
  ]);

  return NextResponse.json({
    providers: [twilio, stripeRes, elevenlabs, outscraper, anthropic, openai, ...fixedMonthly()],
    fetchedAt: new Date().toISOString(),
  });
}
