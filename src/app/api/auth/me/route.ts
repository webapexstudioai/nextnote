import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const session = await getAuthSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Fetch fresh user data from Supabase
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("id, name, agency_name, email, email_verified, subscription_tier, subscription_status, profile_image_url, verified_personal_phone")
      .eq("id", session.userId)
      .single();

    if (error || !user) {
      // User no longer exists in DB — destroy stale session
      session.destroy();
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        agencyName: user.agency_name,
        email: user.email,
        emailVerified: user.email_verified ?? false,
        subscriptionTier: user.subscription_tier ?? "starter",
        subscriptionStatus: user.subscription_status ?? "active",
        profileImageUrl: (user as Record<string, unknown>).profile_image_url as string | null ?? null,
        verifiedPersonalPhone:
          ((user as Record<string, unknown>).verified_personal_phone as string | null) ?? null,
      },
      impersonation: session.impersonatorUserId
        ? { adminEmail: session.impersonatorEmail ?? null }
        : null,
    });
  } catch (err) {
    console.error("Auth check error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
