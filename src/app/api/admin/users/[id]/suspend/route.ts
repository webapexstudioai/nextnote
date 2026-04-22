import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const suspend = Boolean(body.suspend);

  const { data, error } = await supabaseAdmin
    .from("users")
    .update({ suspended_at: suspend ? new Date().toISOString() : null })
    .eq("id", params.id)
    .select("id, suspended_at")
    .single();

  if (error || !data) {
    console.error("Suspend update error:", error);
    return NextResponse.json({ error: "Failed to update suspension" }, { status: 500 });
  }

  await logAdminAction(guard.userId, suspend ? "user.suspend" : "user.unsuspend", params.id, {});

  return NextResponse.json({ success: true, suspendedAt: data.suspended_at });
}
