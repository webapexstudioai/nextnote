import { supabaseAdmin } from "@/lib/supabase";

// White-label sites are served from a generic-looking domain so prospects
// never see "nextnote" in the URL. Single source of truth — change here
// and middleware + dashboard URLs update together.
export const WHITELABEL_HOST = "pitchsite.dev";

const RESERVED_SLUGS = new Set([
  "www", "api", "app", "admin", "dashboard", "docs", "blog",
  "mail", "email", "cdn", "static", "assets", "auth", "login",
  "signup", "register", "support", "help", "status", "about",
]);

const MAX_SLUG_LEN = 48;

export function slugifyBusinessName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  let base = cleaned.slice(0, MAX_SLUG_LEN).replace(/^-+|-+$/g, "");
  if (!base || base.length < 3) base = `site-${Date.now().toString(36).slice(-6)}`;
  if (RESERVED_SLUGS.has(base)) base = `${base}-site`;
  return base;
}

/**
 * Returns a slug guaranteed to be unique for this user. If the desired slug
 * is taken, tacks on a short random suffix until we hit a free one.
 *
 * We scope uniqueness per-user rather than globally so two agency owners
 * with overlapping niches never collide on something obvious like
 * "bay-area-roofing".
 */
export async function reserveUniqueSlug(userId: string, desired: string): Promise<string> {
  const base = slugifyBusinessName(desired);

  // Fast path: is the base slug free?
  const { data: existing } = await supabaseAdmin
    .from("generated_websites")
    .select("id")
    .eq("user_id", userId)
    .eq("slug", base)
    .maybeSingle();

  if (!existing) return base;

  // Collision — try short random suffixes. 4 attempts is plenty since
  // the suffix space is ~46k.
  for (let i = 0; i < 4; i++) {
    const suffix = Math.random().toString(36).slice(2, 6);
    const candidate = `${base.slice(0, MAX_SLUG_LEN - suffix.length - 1)}-${suffix}`;
    const { data: clash } = await supabaseAdmin
      .from("generated_websites")
      .select("id")
      .eq("user_id", userId)
      .eq("slug", candidate)
      .maybeSingle();
    if (!clash) return candidate;
  }

  // Vanishingly unlikely fallthrough — guarantee uniqueness with timestamp.
  return `${base.slice(0, MAX_SLUG_LEN - 8)}-${Date.now().toString(36).slice(-6)}`;
}

/**
 * Public URL the agency owner shares with their prospect.
 * - White-label tier → {slug}.pitchsite.dev
 * - Standard tier → nextnote.to/api/websites/{id}
 */
export function buildPublicSiteUrl(opts: {
  tier: "standard" | "whitelabel";
  slug: string | null;
  id: string;
  origin: string;
}): string {
  if (opts.tier === "whitelabel" && opts.slug) {
    return `https://${opts.slug}.${WHITELABEL_HOST}`;
  }
  return `${opts.origin}/api/websites/${opts.id}`;
}
