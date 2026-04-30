import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const campaignId = req.nextUrl.searchParams.get("campaignId");

  let q = supabaseAdmin
    .from("voicemail_callbacks")
    .select("id, campaign_id, prospect_id, prospect_name, from_number, to_number, recording_url, recording_duration_sec, status, started_at, ended_at")
    .eq("user_id", session.userId)
    .order("started_at", { ascending: false })
    .limit(200);

  if (campaignId) q = q.eq("campaign_id", campaignId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const campaignIds = Array.from(new Set((data ?? []).map((c) => c.campaign_id).filter(Boolean) as string[]));
  const campaignNames: Record<string, string> = {};
  if (campaignIds.length > 0) {
    const { data: camps } = await supabaseAdmin
      .from("voicemail_campaigns")
      .select("id, name")
      .in("id", campaignIds);
    for (const c of camps ?? []) campaignNames[c.id] = c.name;
  }

  return NextResponse.json({
    callbacks: (data ?? []).map((c) => ({
      id: c.id,
      campaignId: c.campaign_id,
      campaignName: c.campaign_id ? campaignNames[c.campaign_id] ?? null : null,
      prospectId: c.prospect_id,
      prospectName: c.prospect_name,
      fromNumber: c.from_number,
      toNumber: c.to_number,
      recordingUrl: c.recording_url,
      recordingDurationSec: c.recording_duration_sec,
      status: c.status,
      startedAt: c.started_at,
      endedAt: c.ended_at,
    })),
  });
}
