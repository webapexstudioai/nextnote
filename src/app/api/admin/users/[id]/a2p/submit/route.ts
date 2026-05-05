import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { submitCustomerProfile } from "@/lib/a2p";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const userId = params.id;

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: profile } = await supabaseAdmin
    .from("user_business_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile || !profile.tcpa_attested) {
    return NextResponse.json({ error: "Business profile not completed" }, { status: 412 });
  }

  const { data: existing } = await supabaseAdmin
    .from("a2p_registrations")
    .select("status, customer_profile_sid")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing?.customer_profile_sid && existing.status !== "profile_rejected") {
    return NextResponse.json(
      { error: "Already submitted", status: existing.status, customer_profile_sid: existing.customer_profile_sid },
      { status: 409 },
    );
  }

  try {
    const result = await submitCustomerProfile(user.email, profile);

    await supabaseAdmin.from("a2p_registrations").upsert(
      {
        user_id: userId,
        customer_profile_sid: result.customer_profile_sid,
        end_user_sid: result.end_user_sid,
        status: result.status,
        submitted_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    await logAdminAction(guard.userId, "a2p_submit", userId, {
      customer_profile_sid: result.customer_profile_sid,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Submission failed";
    await supabaseAdmin.from("a2p_registrations").upsert(
      {
        user_id: userId,
        status: "profile_rejected",
        error_message: msg,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
