import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status")?.trim();

  let query = supabaseAdmin
    .from("users")
    .select("id, name, email, agency_name, subscription_tier, subscription_status, email_verified, is_admin, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (q) {
    query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%,agency_name.ilike.%${q}%`);
  }
  if (status) {
    query = query.eq("subscription_status", status);
  }

  const { data: users, error } = await query;
  if (error) {
    console.error("Admin users list error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  const ids = (users ?? []).map((u) => u.id);
  const balancesById = new Map<string, number>();
  if (ids.length) {
    const { data: balances } = await supabaseAdmin
      .from("credit_balances")
      .select("user_id, balance")
      .in("user_id", ids);
    for (const b of balances ?? []) balancesById.set(b.user_id, b.balance);
  }

  return NextResponse.json({
    users: (users ?? []).map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      agencyName: u.agency_name,
      subscriptionTier: u.subscription_tier,
      subscriptionStatus: u.subscription_status,
      emailVerified: u.email_verified,
      isAdmin: u.is_admin,
      createdAt: u.created_at,
      creditBalance: balancesById.get(u.id) ?? 0,
    })),
  });
}
