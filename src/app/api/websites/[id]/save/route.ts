import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureFormHandler, stripPoweredByBadge } from "@/lib/websiteForms";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await context.params;
  const { html } = await req.json();

  if (typeof html !== "string" || !html.trim()) {
    return NextResponse.json({ error: "HTML content is required" }, { status: 400 });
  }
  if (!html.includes("<html") && !html.includes("<!DOCTYPE")) {
    return NextResponse.json({ error: "Not a valid HTML document" }, { status: 400 });
  }

  const { data: site } = await supabaseAdmin
    .from("generated_websites")
    .select("user_id, tier")
    .eq("id", id)
    .maybeSingle();

  if (!site) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }
  if (site.user_id !== session.userId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Re-assert the form-submit handler so visual edits don't strip lead capture.
  let finalHtml = ensureFormHandler(html, id);

  // White-label sites must never carry a "Powered by NextNote" badge — if the
  // visual editor re-introduced one, strip it before persisting.
  if (site.tier === "whitelabel") {
    finalHtml = stripPoweredByBadge(finalHtml);
  }

  const { error } = await supabaseAdmin
    .from("generated_websites")
    .update({ html_content: finalHtml })
    .eq("id", id)
    .eq("user_id", session.userId);

  if (error) {
    return NextResponse.json({ error: `Save failed: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ siteId: id });
}
