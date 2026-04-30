import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: campaign, error: campErr } = await supabaseAdmin
    .from("voicemail_campaigns")
    .select("id, name, audio_url, from_number, total_drops, successful_drops, failed_drops, credits_spent, created_at")
    .eq("id", params.id)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (campErr || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const { data: drops } = await supabaseAdmin
    .from("voicemail_drops")
    .select("id, prospect_id, prospect_name, to_number, status, error_message, twilio_call_sid, completed_at, created_at")
    .eq("campaign_id", params.id)
    .eq("user_id", session.userId)
    .order("created_at", { ascending: true });

  const { data: callbacks } = await supabaseAdmin
    .from("voicemail_callbacks")
    .select("id, prospect_id, prospect_name, from_number, recording_url, recording_duration_sec, status, started_at")
    .eq("campaign_id", params.id)
    .eq("user_id", session.userId)
    .order("started_at", { ascending: false });

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      name: campaign.name,
      audioUrl: campaign.audio_url,
      fromNumber: campaign.from_number,
      totalDrops: campaign.total_drops,
      successfulDrops: campaign.successful_drops,
      failedDrops: campaign.failed_drops,
      creditsSpent: campaign.credits_spent,
      createdAt: campaign.created_at,
    },
    drops: (drops ?? []).map((d) => ({
      id: d.id,
      prospectId: d.prospect_id,
      prospectName: d.prospect_name,
      toNumber: d.to_number,
      status: d.status,
      errorMessage: d.error_message,
      callSid: d.twilio_call_sid,
      completedAt: d.completed_at,
      createdAt: d.created_at,
    })),
    callbacks: (callbacks ?? []).map((c) => ({
      id: c.id,
      prospectId: c.prospect_id,
      prospectName: c.prospect_name,
      fromNumber: c.from_number,
      recordingUrl: c.recording_url,
      recordingDurationSec: c.recording_duration_sec,
      status: c.status,
      startedAt: c.started_at,
    })),
  });
}
