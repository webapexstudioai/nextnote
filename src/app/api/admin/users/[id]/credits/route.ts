import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { addCredits, deductCredits, getBalance } from "@/lib/credits";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const amount = Number(body.amount);
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ error: "amount must be a non-zero number" }, { status: 400 });
  }

  const { data: target } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", params.id)
    .single();
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const newBalance =
      amount > 0
        ? await addCredits(params.id, amount, {
            reason: "admin_grant",
            metadata: { grantedBy: guard.userId, note: note || null },
          })
        : await deductCredits(params.id, Math.abs(amount), {
            reason: "admin_deduction",
            metadata: { deductedBy: guard.userId, note: note || null },
          });

    await logAdminAction(
      guard.userId,
      amount > 0 ? "credits.grant" : "credits.deduct",
      params.id,
      { amount, note: note || null, newBalance },
    );

    return NextResponse.json({ success: true, newBalance });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to adjust credits";
    const status = message === "Insufficient credits" ? 400 : 500;
    const currentBalance = await getBalance(params.id);
    return NextResponse.json({ error: message, currentBalance }, { status });
  }
}
