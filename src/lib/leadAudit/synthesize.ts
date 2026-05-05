import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_CHAT_MODEL } from "@/lib/models";
import type {
  AuditSignals,
  AuditSynthesis,
  PitchHook,
  SignalEvidence,
} from "./types";

// The synthesis layer turns raw signals (reviews, PSI, prospect meta)
// into a calibrated AuditSynthesis. Two design constraints drive the
// prompt:
//
//   1. Scores must be discriminating, not "everyone gets a 75". The
//      rubric below maps observable signals to specific score bands.
//   2. Every claim must cite a signal we actually fetched. Hallucinated
//      review quotes or invented metrics destroy trust the first time
//      the user spot-checks a result.

const SYSTEM_PROMPT = `You are a Lead Qualifier for an agency that sells two things:

  • An AI Receptionist that answers calls 24/7 (handles missed calls, after-hours, overflow).
  • Custom websites + landing pages.

You score how well a prospect would benefit from each, on a 0–100 scale.
Your output is read by an agency owner who is about to spend a few minutes
pitching this lead. Bad scores waste their time. Be calibrated.

────────────────────────────────────────────────────────────────────────
SCORING RUBRIC — AI RECEPTIONIST FIT (ai_receptionist_score)
────────────────────────────────────────────────────────────────────────

Strong fit (75–100):
  • Reviews mention unanswered calls, voicemail, "no one called back",
    "couldn't get through", "left a message and never heard back".
  • Service business with phone-driven sales (plumbing, HVAC, dental,
    legal, contractors, salons, auto repair, locksmiths, towing).
  • High review volume but mid-range rating (3.0–4.2) — they're busy
    but dropping balls.
  • Limited business hours (closed evenings/weekends) for an
    industry where customers call anytime (emergency services, etc).

Moderate fit (40–74):
  • Phone-relevant industry but reviews don't mention call problems.
  • Small review count (<15) — limited visibility into their ops.
  • Restaurants, retail with phone (often handled by staff already).

Weak fit (0–39):
  • Pure e-commerce, SaaS, or appointment-via-app businesses.
  • Reviews indicate the owner is hands-on and responsive.
  • B2B firms where calls aren't the buying channel.
  • No phone number on file.

────────────────────────────────────────────────────────────────────────
SCORING RUBRIC — WEBSITE FIT (website_score)
────────────────────────────────────────────────────────────────────────

Strong fit (75–100):
  • No website on file at all.
  • Lighthouse performance < 0.4 OR accessibility < 0.6 OR SEO < 0.6.
  • Final URL is a Facebook page, Yelp page, or generic page-builder
    subdomain (wix.com, sites.google.com, godaddysites.com, etc).
  • Reviews mention "couldn't find info online", "old website",
    "site didn't load".
  • Site loads but has no clear CTA (Lighthouse opportunities call
    out missing meta, render-blocking, etc.).

Moderate fit (40–74):
  • Lighthouse perf 0.4–0.7, SEO 0.6–0.85.
  • Site exists but is dated relative to category norms.

Weak fit (0–39):
  • Modern site with perf > 0.85, SEO > 0.9.
  • Recently rebuilt (no review complaints, modern stack signals).
  • E-commerce stores already on Shopify/Squarespace running well.

────────────────────────────────────────────────────────────────────────
OVERALL SCORE
────────────────────────────────────────────────────────────────────────

overall_score = max(ai_receptionist_score, website_score) when one is
clearly stronger. If both are within 10 points of each other, use the
average and bump pitch_hooks toward the "both" category.

Penalize overall_score by 30 if is_permanently_closed is true.
Penalize overall_score by 15 if total_reviews is null AND there's no
website (we can barely confirm the business exists).

────────────────────────────────────────────────────────────────────────
CONFIDENCE
────────────────────────────────────────────────────────────────────────

  • "high":   reviews.ok=true with ≥10 reviews AND (pagespeed.ok=true OR no website expected).
  • "medium": reviews.ok=true with 3–9 reviews, OR pagespeed.ok=true but reviews missing.
  • "low":    reviews.ok=false AND (pagespeed.ok=false OR no website).

────────────────────────────────────────────────────────────────────────
SIGNALS
────────────────────────────────────────────────────────────────────────

Output 4–8 SignalEvidence objects. Each cites something concrete from
the input. Examples of valid label patterns:

  • "Reviews mention unanswered calls (3 of 30)"
  • "Lighthouse performance score: 0.32 (mobile)"
  • "No website on file"
  • "Closed weekends — emergency plumbing customers call any time"
  • "342 reviews, 4.6 average — strong operations already"

Never fabricate counts. If you say "3 of 30 reviews mention X", you
must have seen 3 reviews matching X in the provided reviews array.

weight = "positive" means this signal increases the matching score
(the prospect needs the service). weight = "negative" means the
prospect already has it solved.

────────────────────────────────────────────────────────────────────────
PITCH HOOKS
────────────────────────────────────────────────────────────────────────

Output 2–4 PitchHook objects. Each "hook" is one sentence the agency
owner could literally read on a cold call. Anchor each in a concrete
fact from the signals. No generic marketing fluff.

Bad:  "Improve your customer experience with our AI Receptionist."
Good: "Three of your last 30 reviews mention nobody picking up — we
       can fix that in 24 hours with our AI Receptionist."

────────────────────────────────────────────────────────────────────────
OUTPUT FORMAT
────────────────────────────────────────────────────────────────────────

Reply with EXACTLY one JSON object — no prose, no markdown fences, no
preamble. Schema:

{
  "ai_receptionist_score": <integer 0-100>,
  "website_score":         <integer 0-100>,
  "overall_score":         <integer 0-100>,
  "confidence":            "low" | "medium" | "high",
  "signals": [
    { "label": string, "category": "ai_receptionist"|"website"|"neutral",
      "weight": "positive"|"negative"|"neutral", "detail": string|null }
  ],
  "pitch_hooks": [
    { "hook": string, "category": "ai_receptionist"|"website"|"both",
      "evidence": string }
  ],
  "summary": <1-2 sentences, plain text, no quotes>
}

If signals are too sparse to score honestly, return all scores at 0,
confidence "low", a single signal explaining what's missing, and
empty pitch_hooks. Don't guess.`;

function buildUserPrompt(signals: AuditSignals): string {
  // We trim the reviews payload — Claude doesn't need every word, but
  // it needs enough that it can quote real complaints. We also strip
  // the owner_response to keep the context window lean (Claude can ask
  // for it later if we ever go interactive).
  const trimmedReviews = signals.reviews.reviews.slice(0, 25).map((r) => ({
    rating: r.rating,
    date: r.date,
    text: r.text.length > 600 ? r.text.slice(0, 600) + "…" : r.text,
  }));

  return JSON.stringify(
    {
      prospect: signals.prospect,
      reviews: {
        ok: signals.reviews.ok,
        error: signals.reviews.error,
        total_reviews: signals.reviews.total_reviews,
        average_rating: signals.reviews.average_rating,
        business_categories: signals.reviews.business_categories,
        business_hours: signals.reviews.business_hours,
        is_permanently_closed: signals.reviews.is_permanently_closed,
        sample_size: trimmedReviews.length,
        reviews: trimmedReviews,
      },
      pagespeed: {
        ok: signals.pagespeed.ok,
        error: signals.pagespeed.error,
        final_url: signals.pagespeed.final_url,
        performance_score: signals.pagespeed.performance_score,
        accessibility_score: signals.pagespeed.accessibility_score,
        best_practices_score: signals.pagespeed.best_practices_score,
        seo_score: signals.pagespeed.seo_score,
        metrics: signals.pagespeed.metrics,
        top_opportunities: signals.pagespeed.top_opportunities,
      },
    },
    null,
    2,
  );
}

interface RawSynthesis {
  ai_receptionist_score?: unknown;
  website_score?: unknown;
  overall_score?: unknown;
  confidence?: unknown;
  signals?: unknown;
  pitch_hooks?: unknown;
  summary?: unknown;
}

function clampScore(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function pickConfidence(v: unknown): AuditSynthesis["confidence"] {
  if (v === "high" || v === "medium" || v === "low") return v;
  return "low";
}

function normalizeSignals(v: unknown): SignalEvidence[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((s): SignalEvidence | null => {
      if (!s || typeof s !== "object") return null;
      const obj = s as Record<string, unknown>;
      const label = typeof obj.label === "string" ? obj.label.trim() : "";
      if (!label) return null;
      const cat = obj.category;
      const weight = obj.weight;
      return {
        label,
        category:
          cat === "ai_receptionist" || cat === "website" || cat === "neutral"
            ? cat
            : "neutral",
        weight:
          weight === "positive" || weight === "negative" || weight === "neutral"
            ? weight
            : "neutral",
        detail: typeof obj.detail === "string" ? obj.detail : null,
      };
    })
    .filter((s): s is SignalEvidence => s !== null);
}

function normalizePitchHooks(v: unknown): PitchHook[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((p): PitchHook | null => {
      if (!p || typeof p !== "object") return null;
      const obj = p as Record<string, unknown>;
      const hook = typeof obj.hook === "string" ? obj.hook.trim() : "";
      const evidence = typeof obj.evidence === "string" ? obj.evidence.trim() : "";
      if (!hook) return null;
      const cat = obj.category;
      return {
        hook,
        category:
          cat === "ai_receptionist" || cat === "website" || cat === "both"
            ? cat
            : "both",
        evidence,
      };
    })
    .filter((p): p is PitchHook => p !== null);
}

// Claude occasionally wraps JSON in ```json fences despite instructions
// not to. Strip them defensively before parsing.
function stripFences(s: string): string {
  const trimmed = s.trim();
  if (trimmed.startsWith("```")) {
    const firstNl = trimmed.indexOf("\n");
    const lastFence = trimmed.lastIndexOf("```");
    if (firstNl !== -1 && lastFence > firstNl) {
      return trimmed.slice(firstNl + 1, lastFence).trim();
    }
  }
  return trimmed;
}

export class SynthesisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SynthesisError";
  }
}

export async function synthesize(signals: AuditSignals): Promise<AuditSynthesis> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new SynthesisError("ANTHROPIC_API_KEY not configured");

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: ANTHROPIC_CHAT_MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: buildUserPrompt(signals) },
      // Pre-fill the assistant turn with `{` to nudge Claude into
      // emitting raw JSON rather than a preamble.
      { role: "assistant", content: "{" },
    ],
  });

  const firstBlock = message.content[0];
  if (!firstBlock || firstBlock.type !== "text") {
    throw new SynthesisError("Empty response from Claude");
  }

  // We pre-filled "{", so Claude's reply is the rest of the JSON.
  const rawText = stripFences("{" + firstBlock.text);

  let parsed: RawSynthesis;
  try {
    parsed = JSON.parse(rawText) as RawSynthesis;
  } catch {
    // Last-ditch: try to extract the largest {...} block.
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) throw new SynthesisError("Claude returned non-JSON output");
    try {
      parsed = JSON.parse(match[0]) as RawSynthesis;
    } catch {
      throw new SynthesisError("Claude returned malformed JSON");
    }
  }

  const synthesis: AuditSynthesis = {
    ai_receptionist_score: clampScore(parsed.ai_receptionist_score),
    website_score: clampScore(parsed.website_score),
    overall_score: clampScore(parsed.overall_score),
    confidence: pickConfidence(parsed.confidence),
    signals: normalizeSignals(parsed.signals),
    pitch_hooks: normalizePitchHooks(parsed.pitch_hooks),
    summary:
      typeof parsed.summary === "string" && parsed.summary.trim().length > 0
        ? parsed.summary.trim()
        : "Audit complete — see signals for details.",
  };

  return synthesis;
}
