import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = session.userId;

  const [prospectsRes, settingsRes, callerIdsRes, campaignsRes] = await Promise.all([
    supabaseAdmin
      .from("prospects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabaseAdmin
      .from("user_settings")
      .select("google_refresh_token_encrypted")
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("user_caller_ids")
      .select("id")
      .eq("user_id", userId)
      .eq("verified", true)
      .limit(1),
    supabaseAdmin
      .from("voicemail_campaigns")
      .select("id")
      .eq("user_id", userId)
      .limit(1),
  ]);

  return NextResponse.json({
    prospects: (prospectsRes.count ?? 0) > 0,
    googleCalendar: Boolean(settingsRes.data?.google_refresh_token_encrypted),
    callerId: (callerIdsRes.data?.length ?? 0) > 0,
    voicedropSent: (campaignsRes.data?.length ?? 0) > 0,
  });
}
