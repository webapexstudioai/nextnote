import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

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
    .select("user_id")
    .eq("id", id)
    .maybeSingle();

  if (!site) {
    return NextResponse.json({ error: "Website not found" }, { status: 404 });
  }
  if (site.user_id !== session.userId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("generated_websites")
    .update({ html_content: html })
    .eq("id", id)
    .eq("user_id", session.userId);

  if (error) {
    return NextResponse.json({ error: `Save failed: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ siteId: id });
}
