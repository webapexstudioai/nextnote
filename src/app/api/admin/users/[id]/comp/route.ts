import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { addCredits, hasBeenProcessed } from "@/lib/credits";
import { sendWelcomeEmail } from "@/lib/email-templates";

const COMP_BONUS_CREDITS = 100;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const tier = body.tier === "starter" || body.tier === "pro" ? body.tier : "pro";
  const sendEmail = body.sendEmail !== false;

  const { data: target } = await supabaseAdmin
    .from("users")
    .select("id, email, subscription_tier, subscription_status")
    .eq("id", params.id)
    .single();
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const nowIso = new Date().toISOString();
  const { error: updateErr } = await supabaseAdmin
    .from("users")
    .update({
      subscription_tier: tier,
      subscription_status: "active",
      comped_at: nowIso,
      comped_by: guard.userId,
    })
    .eq("id", params.id);
  if (updateErr) {
    console.error("Comp subscription update error:", updateErr);
    return NextResponse.json({ error: "Failed to activate account" }, { status: 500 });
  }

  // Grant welcome credits once per user (idempotent via ref_id). Track
  // failures so the admin UI can show which side effects didn't go through.
  const warnings: string[] = [];
  const refId = `comp_bonus_${params.id}`;
  let bonusGranted = 0;
  if (tier === "pro" && !(await hasBeenProcessed(refId))) {
    try {
      await addCredits(params.id, COMP_BONUS_CREDITS, {
        reason: "comp_activation_bonus",
        refId,
        metadata: { grantedBy: guard.userId, tier },
      });
      bonusGranted = COMP_BONUS_CREDITS;
    } catch (err) {
      console.error("Comp bonus credit grant failed:", err);
      warnings.push("Bonus credits could not be granted. Add them manually.");
    }
  }

  let emailSent = false;
  if (sendEmail && target.email) {
    try {
      await sendWelcomeEmail(target.email, tier);
      emailSent = true;
    } catch (err) {
      console.error("Comp welcome email failed:", err);
      warnings.push(
        `Welcome email to ${target.email} failed to send. The user won't know they've been activated unless you notify them manually.`,
      );
    }
  } else if (!sendEmail) {
    warnings.push("Email notification was disabled — remember to tell the user directly.");
  }

  await logAdminAction(guard.userId, "subscription.comp", params.id, {
    tier,
    bonusGranted,
    emailSent,
    warnings,
    previousStatus: target.subscription_status,
  });

  return NextResponse.json({
    success: true,
    tier,
    bonusGranted,
    emailSent,
    warnings,
    compedAt: nowIso,
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { data: target } = await supabaseAdmin
    .from("users")
    .select("id, comped_at")
    .eq("id", params.id)
    .single();
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (!target.comped_at) {
    return NextResponse.json({ error: "User is not comped" }, { status: 400 });
  }

  const { error: updateErr } = await supabaseAdmin
    .from("users")
    .update({
      subscription_status: "canceled",
      subscription_tier: null,
      comped_at: null,
      comped_by: null,
    })
    .eq("id", params.id);
  if (updateErr) {
    console.error("Comp revoke error:", updateErr);
    return NextResponse.json({ error: "Failed to revoke access" }, { status: 500 });
  }

  await logAdminAction(guard.userId, "subscription.comp_revoke", params.id, {});

  return NextResponse.json({ success: true });
}
