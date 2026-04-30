import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: NextRequest) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: campaigns, error } = await supabaseAdmin
    .from("voicemail_campaigns")
    .select("id, name, audio_url, from_number, total_drops, successful_drops, failed_drops, credits_spent, created_at")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const campaignIds = (campaigns ?? []).map((c) => c.id);
  const callbackCounts: Record<string, number> = {};

  if (campaignIds.length > 0) {
    const { data: cbRows } = await supabaseAdmin
      .from("voicemail_callbacks")
      .select("campaign_id")
      .eq("user_id", session.userId)
      .in("campaign_id", campaignIds);
    for (const row of cbRows ?? []) {
      if (row.campaign_id) {
        callbackCounts[row.campaign_id] = (callbackCounts[row.campaign_id] ?? 0) + 1;
      }
    }
  }

  return NextResponse.json({
    campaigns: (campaigns ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      audioUrl: c.audio_url,
      fromNumber: c.from_number,
      totalDrops: c.total_drops,
      successfulDrops: c.successful_drops,
      failedDrops: c.failed_drops,
      creditsSpent: c.credits_spent,
      callbackCount: callbackCounts[c.id] ?? 0,
      callbackRate: c.successful_drops > 0
        ? Math.round(((callbackCounts[c.id] ?? 0) / c.successful_drops) * 100)
        : 0,
      createdAt: c.created_at,
    })),
  });
}
