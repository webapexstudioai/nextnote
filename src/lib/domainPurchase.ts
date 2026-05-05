// Domain registration through Vercel's Domains Registrar API.
//
// Flow:
//   1. User searches a stem ("mybiz") → we expand across allowed TLDs and
//      ask Vercel for availability + wholesale price.
//   2. User picks one → we create a Stripe Checkout session at our flat
//      retail price ($19.99/yr).
//   3. Stripe webhook fires → we call `vercelBuyDomain` with the registrant
//      contact info collected during checkout, then attach the domain to
//      the user's generated_websites row.
//
// Vercel charges the team's payment method on file for the wholesale price.
// Margin = retail - wholesale - Stripe fees. If wholesale > what we can
// afford to subsidize at the flat price (rare for the whitelisted TLDs),
// `vercelBuyDomain` rejects via `expectedPrice` and we refund.
//
// API reference (post Nov 9 2025 sunset of /v4 + /v5 endpoints):
//   POST /v1/registrar/domains/availability       — bulk availability check
//   GET  /v1/registrar/domains/{domain}/price     — per-domain price
//   POST /v1/registrar/domains/{domain}/buy       — register a domain

const VERCEL_API = "https://api.vercel.com";

// Whitelisted TLDs — predictable wholesale (~$10-15/yr) so the flat $19.99
// retail price stays profitable. Adding a new TLD here is fine as long as
// you've checked Vercel's published price for it.
export const ALLOWED_TLDS = ["com", "net", "org", "co", "io", "biz"] as const;

// Retail price the agency owner pays NextNote, in cents.
export const DOMAIN_RETAIL_CENTS = 1999;

// Hard ceiling we'll pay Vercel for any single domain. If wholesale exceeds
// this we refuse the purchase rather than eat a loss. This protects against
// premium domain pricing that occasionally appears for short / popular names.
export const DOMAIN_WHOLESALE_CEILING_CENTS = 1500;

function envOrThrow() {
  const token = process.env.VERCEL_API_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token) throw new Error("VERCEL_API_TOKEN not configured");
  return { token, teamId };
}

function withTeam(url: URL, teamId?: string): URL {
  if (teamId) url.searchParams.set("teamId", teamId);
  return url;
}

export type DomainSearchResult = {
  name: string;
  available: boolean;
  retailPriceCents: number;
  wholesalePriceCents: number | null;
  // Set when this specific TLD/name is too expensive for our flat price
  // (e.g. premium domain) — the UI should grey it out.
  premium: boolean;
};

export function expandStem(stem: string): string[] {
  const cleaned = stem.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!cleaned) return [];
  // If the user typed "mybiz.com" already, search just that one TLD first
  // and the rest as fallbacks.
  const dotIdx = stem.indexOf(".");
  if (dotIdx > 0) {
    const stemPart = stem.slice(0, dotIdx).toLowerCase().replace(/[^a-z0-9-]/g, "");
    const tld = stem.slice(dotIdx + 1).toLowerCase().replace(/[^a-z0-9.]/g, "");
    if (stemPart && tld) {
      const others = ALLOWED_TLDS.filter((t) => t !== tld);
      return [`${stemPart}.${tld}`, ...others.map((t) => `${stemPart}.${t}`)];
    }
  }
  return ALLOWED_TLDS.map((t) => `${cleaned}.${t}`);
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    // New registrar API uses { status, code, message } at top-level.
    const code = body?.code ?? body?.error?.code;
    const message = body?.message ?? body?.error?.message;
    if (message) return code ? `${code}: ${message}` : message;
    return JSON.stringify(body).slice(0, 200);
  } catch {
    return res.statusText || "no body";
  }
}

type BulkAvailabilityResponse = {
  results: Array<{ domain: string; available: boolean }>;
};

async function vercelBulkAvailability(names: string[]): Promise<Map<string, boolean>> {
  if (names.length === 0) return new Map();
  const { token, teamId } = envOrThrow();
  const url = withTeam(new URL(`${VERCEL_API}/v1/registrar/domains/availability`), teamId);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ domains: names }),
  });
  if (!res.ok) {
    const detail = await readErrorMessage(res);
    throw new Error(`availability ${res.status} — ${detail}`);
  }
  const body = (await res.json()) as BulkAvailabilityResponse;
  const map = new Map<string, boolean>();
  for (const r of body.results || []) {
    map.set(r.domain.toLowerCase(), Boolean(r.available));
  }
  return map;
}

type PriceResponse = {
  years: number;
  // Number = price in dollars. String = quote-only / unparseable (e.g. premium).
  purchasePrice: number | string;
  renewalPrice: number | string;
  transferPrice: number | string;
};

async function vercelDomainPrice(name: string): Promise<{ priceCents: number | null; years: number }> {
  const { token, teamId } = envOrThrow();
  const url = withTeam(new URL(`${VERCEL_API}/v1/registrar/domains/${encodeURIComponent(name)}/price`), teamId);
  url.searchParams.set("years", "1");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const detail = await readErrorMessage(res);
    throw new Error(`price ${res.status} — ${detail}`);
  }
  const body = (await res.json()) as PriceResponse;
  const years = Number(body.years ?? 1);
  // Price can be a string for premium / quote-only domains. Treat that as
  // unpriced (caller will mark premium).
  const raw = body.purchasePrice;
  const priceDollars = typeof raw === "number" ? raw : Number(raw);
  if (!isFinite(priceDollars)) return { priceCents: null, years };
  return { priceCents: Math.round(priceDollars * 100), years };
}

export type SearchOutcome = {
  results: DomainSearchResult[];
  errors: string[];
};

/**
 * Search availability + price for the user's stem across allowed TLDs.
 * Best-effort: TLDs that error individually are skipped, not fatal — but
 * we surface their error messages so the API route can tell the difference
 * between "all unavailable" and "Vercel token is wrong" → empty list.
 */
export async function searchDomains(stem: string): Promise<SearchOutcome> {
  const candidates = expandStem(stem);
  if (candidates.length === 0) return { results: [], errors: [] };

  const errors: string[] = [];

  // One bulk availability call covers every candidate. If this fails we
  // can't show anything useful, so surface the error and bail.
  let availability: Map<string, boolean>;
  try {
    availability = await vercelBulkAvailability(candidates);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return { results: [], errors: [`availability: ${msg}`] };
  }

  // Price each candidate in parallel. Pricing is per-domain so individual
  // failures shouldn't kill the whole search — record them but keep going.
  const settled = await Promise.all(
    candidates.map(async (name): Promise<DomainSearchResult | null> => {
      const available = availability.get(name.toLowerCase()) ?? false;
      let wholesale: number | null = null;
      try {
        const price = await vercelDomainPrice(name);
        wholesale = price.priceCents;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        errors.push(`${name}: ${msg}`);
      }
      const premium = wholesale == null || wholesale > DOMAIN_WHOLESALE_CEILING_CENTS;
      return {
        name,
        available,
        retailPriceCents: DOMAIN_RETAIL_CENTS,
        wholesalePriceCents: wholesale,
        premium,
      };
    }),
  );
  const results = settled.filter((r): r is DomainSearchResult => r !== null);
  return { results, errors };
}

export type RegistrantContact = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;          // E.164
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;        // ISO-2
  orgName?: string | null;
};

export type BuyResult =
  | { ok: true; expiresAt: string; wholesaleCents: number; orderId: string }
  | { ok: false; error: string; code?: string };

/**
 * Register a domain. Vercel auto-attaches it to the team and bills the team
 * card. We pass `expectedPrice` so Vercel rejects (rather than charges) if
 * the price changed between search and purchase.
 */
export async function vercelBuyDomain(
  name: string,
  expectedWholesaleCents: number,
  contact: RegistrantContact,
): Promise<BuyResult> {
  let env;
  try { env = envOrThrow(); } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "config" };
  }
  const url = withTeam(
    new URL(`${VERCEL_API}/v1/registrar/domains/${encodeURIComponent(name)}/buy`),
    env.teamId,
  );

  const years = 1;
  const body = {
    autoRenew: false,
    years,
    expectedPrice: Math.round(expectedWholesaleCents) / 100,
    contactInformation: {
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      address1: contact.address1,
      city: contact.city,
      state: contact.state,
      zip: contact.postalCode,
      country: contact.country,
      ...(contact.orgName ? { companyName: contact.orgName } : {}),
    },
  };

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "fetch failed" };
  }

  let data: unknown = null;
  try { data = await res.json(); } catch { /* ignore */ }

  if (!res.ok) {
    // Registrar API surfaces { status, code, message } at top-level, but
    // legacy/alt error shapes may use error.code / error.message.
    const d = data as
      | { code?: string; message?: string; error?: { code?: string; message?: string } }
      | null;
    const code = d?.code ?? d?.error?.code;
    const message = d?.message ?? d?.error?.message ?? `Vercel buy failed (${res.status})`;
    return { ok: false, error: message, code };
  }

  // Buy is asynchronous — response is { orderId, _links } with no expiry.
  // Compute the expected expiry ourselves; the order endpoint will give a
  // real value once registration completes if we ever need it.
  const orderId = (data as { orderId?: string } | null)?.orderId ?? "";
  const expiresAt = new Date(Date.now() + years * 365 * 24 * 60 * 60 * 1000).toISOString();

  return { ok: true, expiresAt, wholesaleCents: expectedWholesaleCents, orderId };
}
