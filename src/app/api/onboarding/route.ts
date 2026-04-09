import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { reason_chose, what_stood_out, dedication_score } = await req.json();

    if (!reason_chose?.trim() || !what_stood_out?.trim() || !dedication_score) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    if (dedication_score < 1 || dedication_score > 10) {
      return NextResponse.json({ error: "Dedication score must be 1-10" }, { status: 400 });
    }

    // Upsert onboarding response
    const { error: upsertError } = await supabaseAdmin
      .from("onboarding_responses")
      .upsert({
        user_id: session.userId,
        reason_chose: reason_chose.trim(),
        what_stood_out: what_stood_out.trim(),
        dedication_score,
      }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("Onboarding upsert error:", upsertError);
      return NextResponse.json({ error: "Failed to save responses" }, { status: 500 });
    }

    // Mark onboarding as complete
    await supabaseAdmin
      .from("users")
      .update({ onboarding_complete: true })
      .eq("id", session.userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Onboarding error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
