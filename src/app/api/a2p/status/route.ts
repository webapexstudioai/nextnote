import { NextResponse } from "next/server";
import { requireUser } from "@/lib/crm";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: reg } = await supabaseAdmin
    .from("a2p_registrations")
    .select("status, error_message, admin_notes, submitted_at, approved_at")
    .eq("user_id", userId)
    .maybeSingle();

  return NextResponse.json({
    status: reg?.status || "not_started",
    error_message: reg?.error_message || null,
    admin_notes: reg?.admin_notes || null,
    submitted_at: reg?.submitted_at || null,
    approved_at: reg?.approved_at || null,
  });
}
