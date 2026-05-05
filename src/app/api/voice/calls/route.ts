import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const direction = searchParams.get("direction"); // "inbound" | "outbound" | null

  let query = supabaseAdmin
    .from("voice_calls")
    .select(
      "id, prospect_id, direction, from_number, to_number, status, recording_url, recording_duration_sec, transcript, ai_summary, ai_summary_generated_at, started_at, ended_at",
    )
    .eq("user_id", session.userId)
    .order("started_at", { ascending: false })
    .limit(100);

  if (direction === "inbound" || direction === "outbound") {
    query = query.eq("direction", direction);
  }

  const { data: calls, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Hydrate prospect names in one round-trip.
  const prospectIds = Array.from(
    new Set((calls ?? []).map((c) => c.prospect_id).filter((x): x is string => !!x)),
  );
  const prospectsById = new Map<string, { id: string; name: string | null; contact_name: string | null }>();
  if (prospectIds.length) {
    const { data: prospects } = await supabaseAdmin
      .from("prospects")
      .select("id, name, contact_name")
      .in("id", prospectIds);
    for (const p of prospects ?? []) prospectsById.set(p.id, p);
  }

  return NextResponse.json({
    calls: (calls ?? []).map((c) => ({
      id: c.id,
      direction: c.direction,
      fromNumber: c.from_number,
      toNumber: c.to_number,
      status: c.status,
      recordingUrl: c.recording_url,
      recordingDurationSec: c.recording_duration_sec,
      transcript: c.transcript,
      aiSummary: c.ai_summary,
      aiSummaryGeneratedAt: c.ai_summary_generated_at,
      startedAt: c.started_at,
      endedAt: c.ended_at,
      prospect: c.prospect_id ? prospectsById.get(c.prospect_id) ?? null : null,
    })),
  });
}
