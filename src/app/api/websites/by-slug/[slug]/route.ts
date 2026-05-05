import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureCounterFallback, stripPoweredByBadge } from "@/lib/websiteForms";

// Reached only via subdomain rewrite from middleware — every request here
// arrived as `{slug}.pitchsite.dev` and was internally routed to this path.
// It must serve the matching white-label site HTML, or 404.
export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  if (!slug || typeof slug !== "string" || slug.length > 80 || !/^[a-z0-9-]+$/i.test(slug)) {
    return new NextResponse("Site not found", { status: 404 });
  }

  // Slugs are stored lowercase. Match accordingly.
  const { data, error } = await supabaseAdmin
    .from("generated_websites")
    .select("html_content, tier")
    .eq("slug", slug.toLowerCase())
    .eq("tier", "whitelabel")
    .maybeSingle();

  if (error || !data?.html_content) {
    return new NextResponse("Site not found", { status: 404 });
  }

  // Defensive backstop: white-label HTML must never carry a NextNote badge,
  // even if older sites slipped through before strict stripping.
  let html = stripPoweredByBadge(data.html_content);
  // Counters render as `<span data-count="626">0</span>` and only animate when
  // they enter the viewport. On hero-adjacent stats — or when IO never fires —
  // the visible "0" sticks. The fallback settles them to the real number.
  html = ensureCounterFallback(html);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
}
