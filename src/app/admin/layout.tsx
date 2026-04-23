import { notFound, redirect } from "next/navigation";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";
import AdminSidebar from "./AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();

  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) redirect("/auth/login");

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("is_admin, email")
    .eq("id", session.userId)
    .single();

  if (!user?.is_admin) notFound();

  return (
    <div className="flex min-h-screen bg-neutral-950 text-neutral-100">
      <AdminSidebar email={user.email} />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-neutral-900 bg-neutral-950/80 px-8 py-3 backdrop-blur">
          <span className="rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-amber-400">
            Local dev
          </span>
        </header>
        <main className="flex-1 px-8 py-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
