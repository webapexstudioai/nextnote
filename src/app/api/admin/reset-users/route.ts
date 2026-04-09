import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// ONE-TIME USE: Delete all users and related data for clean testing
// Remove this route after use
export async function POST() {
  try {
    // Delete in dependency order
    await supabaseAdmin.from("appointments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("prospects").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("files").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("folders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("email_verification_codes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("password_reset_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("user_settings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("onboarding_responses").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("users").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    return NextResponse.json({ success: true, message: "All users and related data deleted" });
  } catch (err) {
    console.error("Reset users error:", err);
    return NextResponse.json({ error: "Failed to reset users" }, { status: 500 });
  }
}
