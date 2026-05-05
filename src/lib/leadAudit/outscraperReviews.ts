import type { Review, ReviewsBundle } from "./types";

// Outscraper Maps Reviews v3 — returns a place's recent reviews plus
// metadata (overall rating, total review count, business categories,
// hours, permanent-closure flag). We use this as the primary "voice
// of the customer" signal for the Lead Qualifier audit.
//
// Docs: https://outscraper.com/google-maps-reviews-scraper
// Endpoint accepts a name + address as `query`, an authoritative
// Google Maps URL, or a place_id. Name+address is what we have most
// reliably from the import pipeline, so that's what we feed it.

const ENDPOINT = "https://api.outscraper.com/maps/reviews-v3";

// We only need enough recent reviews to get a stable read on common
// complaints — pulling 30 keeps us well inside the rate budget while
// still surfacing patterns ("nobody answered the phone", "old website",
// recurring service complaints, etc).
const REVIEWS_PER_PLACE = 30;

interface OutscraperReviewRaw {
  review_text?: string | null;
  review_rating?: number | null;
  author_title?: string | null;
  review_datetime_utc?: string | null;
  owner_answer?: string | null;
}

interface OutscraperReviewsPlace {
  name?: string | null;
  rating?: number | null;
  reviews?: number | null;
  reviews_data?: OutscraperReviewRaw[];
  categories?: string[] | null;
  category?: string | null;
  working_hours?: Record<string, string> | string | null;
  business_status?: string | null;
}

interface OutscraperReviewsResponse {
  status?: string;
  data?: OutscraperReviewsPlace[][] | OutscraperReviewsPlace[];
}

function emptyBundle(error: string | null = null): ReviewsBundle {
  return {
    ok: false,
    total_reviews: null,
    average_rating: null,
    reviews: [],
    business_categories: [],
    business_hours: null,
    is_permanently_closed: null,
    fetched_at: new Date().toISOString(),
    error,
  };
}

function normalizeHours(h: OutscraperReviewsPlace["working_hours"]): string | null {
  if (!h) return null;
  if (typeof h === "string") return h;
  // Outscraper sometimes returns { Monday: "9AM-5PM", ... } — flatten.
  try {
    return Object.entries(h)
      .map(([day, hrs]) => `${day}: ${hrs}`)
      .join("; ");
  } catch {
    return null;
  }
}

function normalizeCategories(p: OutscraperReviewsPlace): string[] {
  const arr = Array.isArray(p.categories) ? p.categories : [];
  if (arr.length > 0) return arr.filter((s): s is string => typeof s === "string");
  if (typeof p.category === "string") return [p.category];
  return [];
}

export interface FetchReviewsInput {
  name: string;
  address: string | null;
  website: string | null;
}

export async function fetchReviews(input: FetchReviewsInput): Promise<ReviewsBundle> {
  const apiKey = process.env.OUTSCRAPER_API_KEY;
  if (!apiKey) return emptyBundle("Outscraper API key not configured");

  if (!input.name?.trim()) return emptyBundle("Missing prospect name");

  // Outscraper resolves "<name>, <address>" reliably; fall back to
  // name alone if we don't have an address (less precise — may match
  // the wrong business in dense areas, hence the lower confidence).
  const query = input.address?.trim()
    ? `${input.name.trim()}, ${input.address.trim()}`
    : input.name.trim();

  const params = new URLSearchParams({
    query,
    reviewsLimit: String(REVIEWS_PER_PLACE),
    limit: "1",
    async: "false",
    language: "en",
    region: "US",
    sort: "newest",
  });

  let json: OutscraperReviewsResponse;
  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      headers: { "X-API-KEY": apiKey },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Outscraper reviews error:", res.status, text);
      return emptyBundle(`Outscraper ${res.status}`);
    }
    json = (await res.json()) as OutscraperReviewsResponse;
  } catch (err) {
    console.error("Outscraper reviews fetch failed:", err);
    return emptyBundle("Network error reaching Outscraper");
  }

  // Outscraper returns either a flat array of places or a per-query
  // nested array. Either way, the first place is the one we want.
  let place: OutscraperReviewsPlace | undefined;
  const data = json.data;
  if (Array.isArray(data) && data.length > 0) {
    if (Array.isArray(data[0])) {
      place = (data as OutscraperReviewsPlace[][])[0]?.[0];
    } else {
      place = (data as OutscraperReviewsPlace[])[0];
    }
  }

  if (!place) return emptyBundle("No matching place found");

  const reviews: Review[] = (place.reviews_data ?? [])
    .filter((r) => typeof r.review_text === "string" && r.review_text.trim().length > 0)
    .map((r) => ({
      rating: typeof r.review_rating === "number" ? r.review_rating : null,
      text: r.review_text!.trim(),
      author: r.author_title ?? null,
      date: r.review_datetime_utc ?? null,
      owner_response: r.owner_answer ?? null,
    }));

  return {
    ok: true,
    total_reviews: typeof place.reviews === "number" ? place.reviews : null,
    average_rating: typeof place.rating === "number" ? place.rating : null,
    reviews,
    business_categories: normalizeCategories(place),
    business_hours: normalizeHours(place.working_hours),
    // Outscraper marks closed places via business_status === "CLOSED_PERMANENTLY".
    is_permanently_closed:
      typeof place.business_status === "string"
        ? place.business_status.toUpperCase().includes("CLOSED_PERMANENTLY")
        : null,
    fetched_at: new Date().toISOString(),
    error: null,
  };
}

// Suggested cite — used silently in the synthesis prompt.
export { ENDPOINT as OUTSCRAPER_REVIEWS_ENDPOINT };
