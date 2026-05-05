import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { sendA2pApprovedEmail } from "@/lib/email-templates";

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
    .select("legal_name, tcpa_attested")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile || !profile.tcpa_attested) {
    return NextResponse.json({ error: "Business profile not completed" }, { status: 412 });
  }

  const nowIso = new Date().toISOString();
  const { error: upsertErr } = await supabaseAdmin.from("a2p_registrations").upsert(
    {
      user_id: userId,
      status: "admin_approved",
      approved_at: nowIso,
      error_message: null,
      admin_notes: null,
      updated_at: nowIso,
    },
    { onConflict: "user_id" },
  );
  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  let emailSent = true;
  let emailError: string | null = null;
  try {
    await sendA2pApprovedEmail(user.email, profile.legal_name || "your business");
  } catch (err) {
    emailSent = false;
    emailError = err instanceof Error ? err.message : "Email send failed";
  }

  await logAdminAction(guard.userId, "a2p_admin_approve", userId, { email_sent: emailSent });

  return NextResponse.json({ ok: true, status: "admin_approved", email_sent: emailSent, email_error: emailError });
}
