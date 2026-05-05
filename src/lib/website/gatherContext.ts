// Pulls real-world business context (reviews, hours, categories, photos) so
// the website generator can build a site that reflects the actual business
// instead of generic filler. Re-uses the Outscraper Maps Reviews v3 fetcher
// already in place for the Lead Qualifier — same API key, same endpoint —
// and adapts the output into a prompt-friendly text block.

import { fetchReviews } from "@/lib/leadAudit/outscraperReviews";
import type { ReviewsBundle, Review } from "@/lib/leadAudit/types";

export interface GatherInput {
  name: string;
  address: string | null;
  service: string | null;
  mapsUrl: string | null;
}

export interface GatheredContext {
  ok: boolean;
  reviews: ReviewsBundle | null;
  block: string | null;
  error: string | null;
}

const MAX_REVIEWS_TO_QUOTE = 8;
const MAX_REVIEW_CHARS = 280;

function pickRepresentativeReviews(reviews: Review[]): Review[] {
  // Bias toward longer 5★ reviews (positive specifics → great copy fodder)
  // mixed with one or two critical ones (so Claude knows what NOT to oversell).
  const withText = reviews.filter((r) => r.text && r.text.trim().length > 30);
  const positive = withText
    .filter((r) => (r.rating ?? 0) >= 4)
    .sort((a, b) => (b.text?.length ?? 0) - (a.text?.length ?? 0));
  const critical = withText
    .filter((r) => (r.rating ?? 0) > 0 && (r.rating ?? 0) <= 3)
    .sort((a, b) => (b.text?.length ?? 0) - (a.text?.length ?? 0));

  return [...positive.slice(0, MAX_REVIEWS_TO_QUOTE - 2), ...critical.slice(0, 2)];
}

function trim(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function formatBlock(name: string, bundle: ReviewsBundle): string | null {
  if (!bundle.ok) return null;
  const lines: string[] = [];
  lines.push(`REAL BUSINESS DATA (pulled from Google Maps for "${name}" — use this as ground truth, not invented content):`);
  if (bundle.business_categories.length) {
    lines.push(`- Listed categories: ${bundle.business_categories.join(", ")}`);
  }
  if (typeof bundle.average_rating === "number") {
    lines.push(`- Google rating: ${bundle.average_rating.toFixed(1)} stars across ${bundle.total_reviews ?? "?"} reviews`);
  }
  if (bundle.business_hours) {
    lines.push(`- Hours: ${bundle.business_hours}`);
  }
  if (bundle.is_permanently_closed) {
    lines.push(`- Listing flagged as PERMANENTLY CLOSED — surface this issue to the user instead of building a site that pretends they're open.`);
  }

  const picked = pickRepresentativeReviews(bundle.reviews);
  if (picked.length > 0) {
    lines.push("");
    lines.push("Representative customer reviews (use them to inform tone, surface specific praise, and write believable testimonials — paraphrase rather than quoting verbatim):");
    picked.forEach((r, i) => {
      const stars = typeof r.rating === "number" ? `${r.rating}★` : "?";
      const author = r.author ? ` — ${r.author}` : "";
      lines.push(`  ${i + 1}. [${stars}${author}] ${trim(r.text, MAX_REVIEW_CHARS)}`);
    });
  }

  lines.push("");
  lines.push(
    "GUIDANCE: Anchor the homepage copy in what real customers actually praise here. If reviews keep mentioning a specific service, person, or trait, lead with that. Do not fabricate awards, certifications, decades-in-business, or numbers that don't appear in the data above.",
  );

  return lines.join("\n");
}

export async function gatherProspectContext(input: GatherInput): Promise<GatheredContext> {
  if (!input.name?.trim()) {
    return { ok: false, reviews: null, block: null, error: "Missing business name" };
  }

  const bundle = await fetchReviews({
    name: input.name,
    address: input.address,
    website: null,
  });

  if (!bundle.ok) {
    return { ok: false, reviews: bundle, block: null, error: bundle.error };
  }

  return { ok: true, reviews: bundle, block: formatBlock(input.name, bundle), error: null };
}
