import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { sendA2pRejectedEmail } from "@/lib/email-templates";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const userId = params.id;
  const { admin_notes } = await req.json();

  if (!admin_notes || typeof admin_notes !== "string" || !admin_notes.trim()) {
    return NextResponse.json({ error: "admin_notes required" }, { status: 400 });
  }
  if (admin_notes.length > 2000) {
    return NextResponse.json({ error: "admin_notes too long (max 2000 chars)" }, { status: 400 });
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: profile } = await supabaseAdmin
    .from("user_business_profiles")
    .select("legal_name")
    .eq("user_id", userId)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  const note = admin_notes.trim();
  const { error: upsertErr } = await supabaseAdmin.from("a2p_registrations").upsert(
    {
      user_id: userId,
      status: "admin_rejected",
      admin_notes: note,
      error_message: null,
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
    await sendA2pRejectedEmail(user.email, profile?.legal_name || "your business", note);
  } catch (err) {
    emailSent = false;
    emailError = err instanceof Error ? err.message : "Email send failed";
  }

  await logAdminAction(guard.userId, "a2p_admin_reject", userId, { email_sent: emailSent });

  return NextResponse.json({ ok: true, status: "admin_rejected", email_sent: emailSent, email_error: emailError });
}
