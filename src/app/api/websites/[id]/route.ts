import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

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
    .select("html_content")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return new NextResponse("Database error", { status: 500 });
  }

  if (!data?.html_content) {
    return new NextResponse("Site not found", { status: 404 });
  }

  return new NextResponse(data.html_content, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Don't let search engines index prospect pages by default.
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "public, max-age=3600",
      "Referrer-Policy": "no-referrer",
    },
  });
}
