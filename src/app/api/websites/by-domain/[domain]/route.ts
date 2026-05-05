import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureCounterFallback, stripPoweredByBadge } from "@/lib/websiteForms";

// Reached via host-based rewrite from middleware: a request arrived as
// `mybiz.com/...` and was routed here. Look up the matching site by
// `custom_domain` and serve its HTML. Only verified attachments serve —
// pending ones return 404 so visitors don't see a half-set-up page during
// DNS propagation.
export async function GET(
  _req: Request,
  context: { params: Promise<{ domain: string }> },
) {
  const { domain: raw } = await context.params;
  const domain = (raw || "").toLowerCase();

  // Loose hostname validation — keep DB-touching IO out of obvious junk.
  if (!domain || domain.length > 253 || !/^[a-z0-9.-]+$/.test(domain)) {
    return new NextResponse("Site not found", { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("generated_websites")
    .select("html_content, tier, custom_domain_status")
    .eq("custom_domain", domain)
    .maybeSingle();

  if (error || !data?.html_content) {
    return new NextResponse("Site not found", { status: 404 });
  }
  if (data.custom_domain_status !== "verified") {
    return new NextResponse("Site not yet verified", { status: 404 });
  }

  // Custom domains are inherently white-label (it's the user's own URL),
  // so apply the same scrub as the by-slug handler regardless of tier.
  let html = stripPoweredByBadge(data.html_content);
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
