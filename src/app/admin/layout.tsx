import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

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
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-lg font-semibold tracking-tight">
              NextNote Admin
            </Link>
            <nav className="flex gap-4 text-sm text-neutral-400">
              <Link href="/admin" className="hover:text-white">Dashboard</Link>
              <Link href="/admin/users" className="hover:text-white">Users</Link>
              <Link href="/admin/support" className="hover:text-white">Support</Link>
              <Link href="/admin/audit" className="hover:text-white">Audit log</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs text-neutral-500">
            <span className="rounded bg-amber-500/10 px-2 py-1 text-amber-400">LOCAL DEV</span>
            <span>{user.email}</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
