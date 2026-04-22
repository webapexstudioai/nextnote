import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthSession } from "@/lib/session";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { data: target } = await supabaseAdmin
    .from("users")
    .select("id, name, email, agency_name")
    .eq("id", params.id)
    .single();
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const session = await getAuthSession();
  // Preserve the admin's original identity. If already impersonating, keep the original impersonator.
  if (!session.impersonatorUserId) {
    session.impersonatorUserId = guard.userId;
    session.impersonatorEmail = session.email;
  }
  session.userId = target.id;
  session.name = target.name ?? undefined;
  session.agencyName = target.agency_name ?? undefined;
  session.email = target.email;
  session.isLoggedIn = true;
  await session.save();

  await logAdminAction(guard.userId, "user.impersonate_start", params.id, {});

  return NextResponse.json({ success: true, redirectTo: "/dashboard" });
}
