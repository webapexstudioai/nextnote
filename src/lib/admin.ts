import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

export const IS_PROD = process.env.NODE_ENV === "production";

export type AdminGuardResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<AdminGuardResult> {
  const session = await getAuthSession();
  // During impersonation, the admin's real id is in impersonatorUserId; trust that for admin gates.
  const adminId = session.impersonatorUserId ?? session.userId;

  if (!session.isLoggedIn || !adminId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("is_admin")
    .eq("id", adminId)
    .single();

  if (!user?.is_admin) {
    return { ok: false, response: new NextResponse("Not found", { status: 404 }) };
  }

  return { ok: true, userId: adminId };
}

export async function isAdminUser(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabaseAdmin
    .from("users")
    .select("is_admin")
    .eq("id", userId)
    .single();
  return Boolean(data?.is_admin);
}

export async function logAdminAction(
  adminUserId: string,
  action: string,
  targetUserId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabaseAdmin.from("admin_audit_log").insert({
    admin_user_id: adminUserId,
    action,
    target_user_id: targetUserId,
    metadata,
  });
  if (error) {
    console.error("Audit log write failed:", error, { action, targetUserId });
  }
}
