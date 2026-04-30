import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("sms_sequence_enrollments")
    .update({
      status: "halted_manual",
      next_send_at: null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
