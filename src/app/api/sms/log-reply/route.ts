import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";
import { normalizePhone } from "@/lib/twilio";

const PERSONAL_SENTINEL = "personal";

export async function POST(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { prospect_id, body } = await req.json();

  if (!prospect_id || typeof prospect_id !== "string") {
    return NextResponse.json({ error: "prospect_id required" }, { status: 400 });
  }
  if (!body || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }

  const { data: prospect } = await supabaseAdmin
    .from("prospects")
    .select("id, user_id, phone")
    .eq("id", prospect_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  const from = normalizePhone(prospect.phone || "");
  if (!from) return NextResponse.json({ error: "Prospect has no valid phone number" }, { status: 400 });

  const nowIso = new Date().toISOString();
  const { data: message, error: insertErr } = await supabaseAdmin
    .from("sms_messages")
    .insert({
      user_id: userId,
      prospect_id: prospect.id,
      direction: "inbound",
      body: body.trim(),
      to_number: PERSONAL_SENTINEL,
      from_number: from,
      status: "logged_inbound",
    })
    .select()
    .single();

  if (insertErr || !message) {
    return NextResponse.json({ error: insertErr?.message || "DB insert failed" }, { status: 500 });
  }

  return NextResponse.json({
    message_id: message.id,
    body: body.trim(),
  });
}
