import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";

export async function GET(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const prospectId = req.nextUrl.searchParams.get("prospect_id");
  if (!prospectId) return NextResponse.json({ error: "prospect_id required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("sms_sequence_enrollments")
    .select("id, sequence_id, status, current_step_order, next_send_at, enrolled_at, completed_at, last_error, sms_sequences(name)")
    .eq("user_id", userId)
    .eq("prospect_id", prospectId)
    .order("enrolled_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ enrollments: data ?? [] });
}
