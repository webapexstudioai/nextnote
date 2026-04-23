import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select(
      "id, name, email, agency_name, subscription_tier, subscription_status, stripe_customer_id, stripe_subscription_id, email_verified, is_admin, created_at, suspended_at, comped_at",
    )
    .eq("id", params.id)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: balance } = await supabaseAdmin
    .from("credit_balances")
    .select("balance")
    .eq("user_id", params.id)
    .maybeSingle();

  const { data: recentTx } = await supabaseAdmin
    .from("credit_transactions")
    .select("id, delta, reason, ref_id, metadata, created_at")
    .eq("user_id", params.id)
    .order("created_at", { ascending: false })
    .limit(25);

  const [{ count: prospectCount }, { count: folderCount }, { count: fileCount }] = await Promise.all([
    supabaseAdmin.from("prospects").select("id", { count: "exact", head: true }).eq("user_id", params.id),
    supabaseAdmin.from("folders").select("id", { count: "exact", head: true }).eq("user_id", params.id),
    supabaseAdmin.from("files").select("id", { count: "exact", head: true }).eq("user_id", params.id),
  ]);

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      agencyName: user.agency_name,
      subscriptionTier: user.subscription_tier,
      subscriptionStatus: user.subscription_status,
      stripeCustomerId: user.stripe_customer_id,
      stripeSubscriptionId: user.stripe_subscription_id,
      emailVerified: user.email_verified,
      isAdmin: user.is_admin,
      createdAt: user.created_at,
      creditBalance: balance?.balance ?? 0,
      suspendedAt: user.suspended_at,
      compedAt: user.comped_at,
    },
    stats: {
      prospects: prospectCount ?? 0,
      folders: folderCount ?? 0,
      files: fileCount ?? 0,
    },
    recentTransactions: (recentTx ?? []).map((t) => ({
      id: t.id,
      delta: t.delta,
      reason: t.reason,
      refId: t.ref_id,
      metadata: t.metadata,
      createdAt: t.created_at,
    })),
  });
}
