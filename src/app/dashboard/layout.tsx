import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";
import DashboardShell from "./DashboardShell";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    redirect("/auth/login");
  }

  const isImpersonating = Boolean(session.impersonatorUserId);

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("subscription_status")
    .eq("id", session.userId)
    .single();

  // Impersonation skips the subscription gate so admins can debug any account.
  if (!isImpersonating && (!user || !ACTIVE_STATUSES.has(user.subscription_status))) {
    redirect("/pricing");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
