import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";

export async function GET(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const prospectId = req.nextUrl.searchParams.get("prospect_id");
  if (!prospectId) return NextResponse.json({ error: "prospect_id required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("sms_messages")
    .select("id, direction, body, to_number, from_number, status, error_message, sent_at, delivered_at, created_at")
    .eq("user_id", userId)
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}
