import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";

const ALLOWED_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "canceled",
  "incomplete",
  "pending",
]);

const ALLOWED_TIERS = new Set(["starter", "pro", null]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  if (body.subscriptionStatus !== undefined) {
    if (!ALLOWED_STATUSES.has(body.subscriptionStatus)) {
      return NextResponse.json({ error: "Invalid subscription status" }, { status: 400 });
    }
    updates.subscription_status = body.subscriptionStatus;
  }

  if (body.subscriptionTier !== undefined) {
    const tier = body.subscriptionTier === "" ? null : body.subscriptionTier;
    if (!ALLOWED_TIERS.has(tier)) {
      return NextResponse.json({ error: "Invalid subscription tier" }, { status: 400 });
    }
    updates.subscription_tier = tier;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .update(updates)
    .eq("id", params.id)
    .select("id, subscription_status, subscription_tier")
    .single();

  if (error || !user) {
    console.error("Admin subscription override error:", error);
    return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 });
  }

  await logAdminAction(guard.userId, "subscription.override", params.id, updates);

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      subscriptionStatus: user.subscription_status,
      subscriptionTier: user.subscription_tier,
    },
  });
}
