import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";
import { logAdminAction } from "@/lib/admin";

// Not gated by requireAdmin — the session itself proves admin via impersonatorUserId.
// Works even in prod in case impersonation ever bled to prod (defensive).
export async function POST() {
  const session = await getAuthSession();
  const adminId = session.impersonatorUserId;
  if (!adminId) {
    return NextResponse.json({ error: "Not impersonating" }, { status: 400 });
  }

  const { data: admin } = await supabaseAdmin
    .from("users")
    .select("id, name, email, agency_name, is_admin")
    .eq("id", adminId)
    .single();

  if (!admin?.is_admin) {
    // Clear session and redirect to login — something is off.
    session.destroy();
    return NextResponse.json({ error: "Admin account no longer valid" }, { status: 403 });
  }

  const impersonatedId = session.userId;

  session.userId = admin.id;
  session.name = admin.name ?? undefined;
  session.agencyName = admin.agency_name ?? undefined;
  session.email = admin.email;
  session.impersonatorUserId = undefined;
  session.impersonatorEmail = undefined;
  session.isLoggedIn = true;
  await session.save();

  await logAdminAction(admin.id, "user.impersonate_stop", impersonatedId ?? null, {});

  return NextResponse.json({ success: true, redirectTo: "/admin" });
}
