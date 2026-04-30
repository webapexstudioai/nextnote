import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";
import { purchaseAgencyNumber } from "@/lib/agencyPhone";

// Claims a Twilio number for free, with trial_ends_at set 14 days out.
// Each user gets exactly one trial — the `phone_trial_used_at` stamp on
// users guards against re-claim after the trial ends or is cancelled.
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { phoneNumber, friendlyName } = await req.json();
    if (!phoneNumber || typeof phoneNumber !== "string") {
      return NextResponse.json({ error: "phoneNumber is required" }, { status: 400 });
    }

    const { data: existing } = await supabaseAdmin
      .from("user_phone_numbers")
      .select("id")
      .eq("user_id", userId)
      .eq("purpose", "agency")
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "You already have an agency number." }, { status: 409 });
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, phone_trial_used_at")
      .eq("id", userId)
      .single();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.phone_trial_used_at) {
      return NextResponse.json(
        { error: "You've already used your free trial. Buy a number for $5 to keep it permanently." },
        { status: 403 },
      );
    }

    const result = await purchaseAgencyNumber({
      userId,
      phoneNumber,
      friendlyName,
      trial: true,
    });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Stamp the user so this trial can't be claimed again, even if they
    // release the number before the 14 days are up.
    await supabaseAdmin
      .from("users")
      .update({ phone_trial_used_at: new Date().toISOString() })
      .eq("id", userId);

    return NextResponse.json({
      success: true,
      phoneNumber: result.phoneNumber,
      trial: true,
    });
  } catch (err) {
    console.error("Agency phone trial claim error:", err);
    const msg = err instanceof Error ? err.message : "Failed to claim trial";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
