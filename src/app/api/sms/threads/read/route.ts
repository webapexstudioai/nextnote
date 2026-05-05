import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";

// POST { prospect_id } or { remote_number } — clears unread on inbound msgs.
// We accept either because unmatched threads (from an unknown number) don't
// have a prospect_id, just the remote phone number.

export async function POST(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { prospect_id, remote_number } = await req.json();
  if (!prospect_id && !remote_number) {
    return NextResponse.json({ error: "prospect_id or remote_number required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  let q = supabaseAdmin
    .from("sms_messages")
    .update({ read_at: now })
    .eq("user_id", userId)
    .eq("direction", "inbound")
    .is("read_at", null);

  if (prospect_id) {
    q = q.eq("prospect_id", prospect_id);
  } else {
    q = q.is("prospect_id", null).eq("from_number", remote_number);
  }

  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
