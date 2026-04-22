import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("targetUserId");

  let query = supabaseAdmin
    .from("admin_audit_log")
    .select("id, action, admin_user_id, target_user_id, metadata, created_at, admin:admin_user_id(email), target:target_user_id(email)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (targetUserId) query = query.eq("target_user_id", targetUserId);

  const { data, error } = await query;
  if (error) {
    console.error("Fetch audit error:", error);
    return NextResponse.json({ error: "Failed to load audit log" }, { status: 500 });
  }

  type Row = {
    id: string;
    action: string;
    admin_user_id: string | null;
    target_user_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    admin: { email: string } | null;
    target: { email: string } | null;
  };

  return NextResponse.json({
    entries: ((data ?? []) as unknown as Row[]).map((r) => ({
      id: r.id,
      action: r.action,
      adminUserId: r.admin_user_id,
      adminEmail: r.admin?.email ?? null,
      targetUserId: r.target_user_id,
      targetEmail: r.target?.email ?? null,
      metadata: r.metadata,
      createdAt: r.created_at,
    })),
  });
}
