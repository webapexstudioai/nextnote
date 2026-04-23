import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";

// Returns admin-granted credit events from the last 7 days so the client can
// show a celebration animation for any the user hasn't seen yet. The client
// tracks "seen" in localStorage — this endpoint is stateless.
export async function GET() {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("credit_transactions")
    .select("id, delta, reason, metadata, created_at")
    .eq("user_id", userId)
    .eq("reason", "admin_grant")
    .gt("delta", 0)
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Fetch gifts error:", error);
    return NextResponse.json({ gifts: [] });
  }

  const gifts = (data ?? []).map((row) => ({
    id: row.id,
    amount: row.delta,
    note: (row.metadata as { note?: string | null } | null)?.note ?? null,
    createdAt: row.created_at,
  }));

  return NextResponse.json({ gifts });
}
