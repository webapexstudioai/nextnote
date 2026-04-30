import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

// Owner-only metadata for a single site — used by the editor to know whether
// to point the "Open" button at the white-label URL or the standard one.
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await context.params;

  const { data, error } = await supabaseAdmin
    .from("generated_websites")
    .select("id, prospect_name, tier, slug, created_at")
    .eq("id", id)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
