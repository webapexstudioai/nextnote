import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";

const TIER_MONTHLY_USD: Record<string, number> = {
  starter: 27,
  pro: 47,
  agency: 97,
};

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    totalUsersRes,
    signups24hRes,
    signups7dRes,
    signups30dRes,
    activeUsersRes,
    pendingUsersRes,
    canceledUsersRes,
    pastDueUsersRes,
    tierBreakdownRes,
    txThisMonthRes,
    suspendedCountRes,
    openThreadsRes,
    adminUnreadRes,
  ] = await Promise.all([
    supabaseAdmin.from("users").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("users").select("id", { count: "exact", head: true }).gte("created_at", dayAgo),
    supabaseAdmin.from("users").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    supabaseAdmin.from("users").select("id", { count: "exact", head: true }).gte("created_at", monthAgo),
    supabaseAdmin.from("users").select("id", { count: "exact", head: true }).in("subscription_status", ["active", "trialing"]),
    supabaseAdmin.from("users").select("id", { count: "exact", head: true }).eq("subscription_status", "pending"),
    supabaseAdmin.from("users").select("id", { count: "exact", head: true }).eq("subscription_status", "canceled"),
    supabaseAdmin.from("users").select("id", { count: "exact", head: true }).eq("subscription_status", "past_due"),
    supabaseAdmin
      .from("users")
      .select("subscription_tier")
      .in("subscription_status", ["active", "trialing"]),
    supabaseAdmin
      .from("credit_transactions")
      .select("delta, reason")
      .gte("created_at", monthStart),
    supabaseAdmin.from("users").select("id", { count: "exact", head: true }).not("suspended_at", "is", null),
    supabaseAdmin.from("support_threads").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabaseAdmin.from("support_threads").select("id", { count: "exact", head: true }).eq("admin_unread", true),
  ]);

  const tierCounts: Record<string, number> = {};
  for (const row of tierBreakdownRes.data ?? []) {
    const tier = row.subscription_tier ?? "unknown";
    tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
  }

  let mrrUsd = 0;
  for (const [tier, count] of Object.entries(tierCounts)) {
    const price = TIER_MONTHLY_USD[tier];
    if (price) mrrUsd += price * count;
  }

  let creditsGranted = 0;
  let creditsPurchased = 0;
  let creditsSpent = 0;
  for (const row of txThisMonthRes.data ?? []) {
    const delta = Number(row.delta) || 0;
    if (delta > 0) {
      if (row.reason === "purchase") creditsPurchased += delta;
      else creditsGranted += delta;
    } else {
      creditsSpent += Math.abs(delta);
    }
  }

  return NextResponse.json({
    users: {
      total: totalUsersRes.count ?? 0,
      signups24h: signups24hRes.count ?? 0,
      signups7d: signups7dRes.count ?? 0,
      signups30d: signups30dRes.count ?? 0,
      active: activeUsersRes.count ?? 0,
      pending: pendingUsersRes.count ?? 0,
      canceled: canceledUsersRes.count ?? 0,
      pastDue: pastDueUsersRes.count ?? 0,
      suspended: suspendedCountRes.count ?? 0,
    },
    subscriptions: {
      byTier: tierCounts,
      mrrUsd,
      annualRunRateUsd: mrrUsd * 12,
    },
    credits: {
      thisMonth: {
        purchased: creditsPurchased,
        granted: creditsGranted,
        spent: creditsSpent,
      },
    },
    support: {
      openThreads: openThreadsRes.count ?? 0,
      unreadByAdmin: adminUnreadRes.count ?? 0,
    },
  });
}
