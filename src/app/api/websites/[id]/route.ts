import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureCounterFallback, stripPoweredByBadge } from "@/lib/websiteForms";

// Site IDs are 128-bit crypto-random tokens — unguessable — so this endpoint is
// intentionally public (users share the URL with their prospects). Short IDs
// from the legacy format still work but can no longer be created.
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  // Reject obviously malformed IDs before touching the DB.
  if (!id || typeof id !== "string" || id.length > 80 || !/^[A-Za-z0-9_-]+$/.test(id)) {
    return new NextResponse("Site not found", { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("generated_websites")
    .select("html_content, tier")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return new NextResponse("Database error", { status: 500 });
  }

  if (!data?.html_content) {
    return new NextResponse("Site not found", { status: 404 });
  }

  // Backstop for older white-label sites that were saved before strict badge
  // stripping was added on the write path — scrub the badge on read.
  let html = data.tier === "whitelabel"
    ? stripPoweredByBadge(data.html_content)
    : data.html_content;
  // Counter-fallback retrofit: older sites don't have it baked in, but they
  // need it just as much. Adding it on read is cheap (regex test + maybe one
  // replace) and avoids a one-off DB migration.
  html = ensureCounterFallback(html);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Don't let search engines index prospect pages by default.
      "X-Robots-Tag": "noindex, nofollow",
      // Short TTL + must-revalidate so AI/visual edits show up almost
      // immediately. Browsers can still cache for 30s; the edge will revalidate.
      "Cache-Control": "public, max-age=30, must-revalidate",
      "Referrer-Policy": "no-referrer",
    },
  });
}
