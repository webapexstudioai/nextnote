import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";

export async function GET(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const prospectId = req.nextUrl.searchParams.get("prospect_id");
  const remoteNumber = req.nextUrl.searchParams.get("remote_number");

  if (!prospectId && !remoteNumber) {
    return NextResponse.json({ error: "prospect_id or remote_number required" }, { status: 400 });
  }

  let q = supabaseAdmin
    .from("sms_messages")
    .select("id, direction, body, to_number, from_number, status, error_message, sent_at, delivered_at, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (prospectId) {
    q = q.eq("prospect_id", prospectId);
  } else if (remoteNumber) {
    // Unmatched thread: messages to/from this number that aren't linked to any prospect.
    q = q.is("prospect_id", null).or(`from_number.eq.${remoteNumber},to_number.eq.${remoteNumber}`);
  }

  const { data, error } = await q;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}
