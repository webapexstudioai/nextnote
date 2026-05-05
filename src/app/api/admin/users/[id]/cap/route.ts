import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { getDailySpend } from "@/lib/credits";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("daily_credit_cap")
    .eq("id", params.id)
    .maybeSingle();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const spent24h = await getDailySpend(params.id);

  return NextResponse.json({
    cap: user.daily_credit_cap,
    spent24h,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const raw = body.cap;
  let cap: number | null;
  if (raw === null || raw === "") {
    cap = null; // unlimited
  } else {
    cap = Number(raw);
    if (!Number.isFinite(cap) || cap < 0) {
      return NextResponse.json({ error: "cap must be null or a non-negative number" }, { status: 400 });
    }
    cap = Math.floor(cap);
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update({ daily_credit_cap: cap })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(guard.userId, "set_daily_credit_cap", params.id, { cap });

  return NextResponse.json({ cap });
}
