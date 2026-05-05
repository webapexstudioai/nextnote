import type { PageSpeedBundle } from "./types";

// Google PageSpeed Insights v5 — returns Lighthouse audit results
// for any public URL. We use it as the "is the website actually
// any good?" signal: low scores + slow Core Web Vitals → strong
// case for a NextNote-built replacement.
//
// Docs: https://developers.google.com/speed/docs/insights/v5/get-started
// The free tier doesn't strictly require an API key for low volume,
// but we pass GOOGLE_PSI_API_KEY when set to raise our quota and
// avoid sporadic 429s.

const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

// Lighthouse can be slow (15-30s). We give it a generous timeout
// and treat anything beyond that as a "site is too slow to even
// audit" signal — itself a useful data point.
const TIMEOUT_MS = 35_000;

// Core Web Vitals + a few diagnostic metrics we surface to Claude.
const METRIC_KEYS = [
  "first-contentful-paint",
  "largest-contentful-paint",
  "cumulative-layout-shift",
  "total-blocking-time",
  "speed-index",
  "interactive",
];

interface LhAudit {
  id?: string;
  title?: string;
  score?: number | null;
  numericValue?: number;
  displayValue?: string;
  details?: { type?: string; overallSavingsMs?: number };
}

interface LhCategory {
  score?: number | null;
  auditRefs?: Array<{ id: string; weight?: number; group?: string }>;
}

interface PsiResponse {
  id?: string;
  lighthouseResult?: {
    finalUrl?: string;
    requestedUrl?: string;
    runtimeError?: { code?: string; message?: string };
    categories?: {
      performance?: LhCategory;
      accessibility?: LhCategory;
      "best-practices"?: LhCategory;
      seo?: LhCategory;
    };
    audits?: Record<string, LhAudit>;
  };
  error?: { message?: string; code?: number };
}

function emptyBundle(error: string | null): PageSpeedBundle {
  return {
    ok: false,
    performance_score: null,
    accessibility_score: null,
    best_practices_score: null,
    seo_score: null,
    metrics: {},
    final_url: null,
    top_opportunities: [],
    fetched_at: new Date().toISOString(),
    error,
  };
}

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // PSI requires a scheme. Default to https — sites stuck on http
  // are themselves a signal, but PSI handles the redirect.
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export async function fetchPageSpeed(rawUrl: string | null): Promise<PageSpeedBundle> {
  if (!rawUrl) return emptyBundle("No website on prospect");

  const url = normalizeUrl(rawUrl);
  if (!url) return emptyBundle("Invalid website URL");

  // Mobile strategy is the default Google reports publicly — and
  // mobile slowness is what most prospects' customers actually feel.
  const params = new URLSearchParams({
    url,
    strategy: "mobile",
  });
  // PSI requires repeating ?category for each one we want.
  const categoryQs = ["PERFORMANCE", "ACCESSIBILITY", "BEST_PRACTICES", "SEO"]
    .map((c) => `&category=${c}`)
    .join("");
  const apiKey = process.env.GOOGLE_PSI_API_KEY;
  const keyQs = apiKey ? `&key=${encodeURIComponent(apiKey)}` : "";

  const fullUrl = `${ENDPOINT}?${params.toString()}${categoryQs}${keyQs}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let json: PsiResponse;
  try {
    const res = await fetch(fullUrl, { signal: controller.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("PSI error:", res.status, text);
      // 4xx on a real URL usually means PSI couldn't reach the site —
      // for a Lead Qualifier, that's a real signal too (broken site).
      if (res.status === 400 || res.status === 422) {
        return emptyBundle("Site could not be audited (PSI 400)");
      }
      return emptyBundle(`PSI ${res.status}`);
    }
    json = (await res.json()) as PsiResponse;
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      return emptyBundle("Site too slow to audit (timed out)");
    }
    console.error("PSI fetch failed:", err);
    return emptyBundle("Network error reaching PSI");
  } finally {
    clearTimeout(timer);
  }

  const lh = json.lighthouseResult;
  if (!lh) return emptyBundle(json.error?.message ?? "Lighthouse result missing");

  if (lh.runtimeError?.code) {
    return emptyBundle(`Lighthouse runtime: ${lh.runtimeError.code}`);
  }

  const cats = lh.categories ?? {};
  const audits = lh.audits ?? {};

  const metrics: PageSpeedBundle["metrics"] = {};
  for (const key of METRIC_KEYS) {
    const a = audits[key];
    if (!a) continue;
    metrics[key] = {
      value: typeof a.numericValue === "number" ? a.numericValue : (a.displayValue ?? ""),
      displayValue: a.displayValue,
    };
  }

  // Lighthouse "opportunities" are the prioritized fix list. Pull the
  // top 5 by potential savings — these become pitch hooks like "homepage
  // takes 6s to load on mobile, that's bouncing real customers."
  const opportunities = Object.values(audits)
    .filter((a) => a.details?.type === "opportunity" && (a.details?.overallSavingsMs ?? 0) > 0)
    .sort((a, b) => (b.details?.overallSavingsMs ?? 0) - (a.details?.overallSavingsMs ?? 0))
    .slice(0, 5)
    .map((a) => a.title?.trim() ?? "")
    .filter(Boolean);

  return {
    ok: true,
    performance_score: cats.performance?.score ?? null,
    accessibility_score: cats.accessibility?.score ?? null,
    best_practices_score: cats["best-practices"]?.score ?? null,
    seo_score: cats.seo?.score ?? null,
    metrics,
    final_url: lh.finalUrl ?? lh.requestedUrl ?? url,
    top_opportunities: opportunities,
    fetched_at: new Date().toISOString(),
    error: null,
  };
}

export { ENDPOINT as PSI_ENDPOINT };
