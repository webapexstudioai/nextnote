import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { TIERS, type SubscriptionTier } from "@/lib/subscriptions";

export type TierGuardResult =
  | { ok: true; tier: SubscriptionTier }
  | { ok: false; response: NextResponse };

async function getTier(userId: string): Promise<SubscriptionTier> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("subscription_tier")
    .eq("id", userId)
    .single();
  return (data?.subscription_tier as SubscriptionTier) ?? "starter";
}

export async function requirePro(userId: string, feature: string): Promise<TierGuardResult> {
  const tier = await getTier(userId);
  if (tier !== "pro") {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "upgrade_required",
          feature,
          message: `${feature} is a Pro feature. Upgrade to Pro to use it.`,
          requiredTier: "pro",
        },
        { status: 402 },
      ),
    };
  }
  return { ok: true, tier };
}

export async function assertProspectQuota(userId: string, adding = 1): Promise<TierGuardResult> {
  const tier = await getTier(userId);
  const cap = TIERS[tier].limits.prospects;
  const { count } = await supabaseAdmin
    .from("prospects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((count ?? 0) + adding > cap) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "quota_exceeded",
          feature: "prospects",
          message: `You've hit your ${TIERS[tier].name} prospect cap of ${cap}. Upgrade to add more.`,
          current: count ?? 0,
          limit: cap,
          requiredTier: tier === "pro" ? "pro" : "pro",
        },
        { status: 402 },
      ),
    };
  }
  return { ok: true, tier };
}

export async function assertFolderQuota(userId: string): Promise<TierGuardResult> {
  const tier = await getTier(userId);
  const cap = TIERS[tier].limits.folders;
  const { count } = await supabaseAdmin
    .from("folders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((count ?? 0) >= cap) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "quota_exceeded",
          feature: "folders",
          message: `You've hit your ${TIERS[tier].name} folder cap of ${cap}. Upgrade to add more.`,
          current: count ?? 0,
          limit: cap,
          requiredTier: "pro",
        },
        { status: 402 },
      ),
    };
  }
  return { ok: true, tier };
}
