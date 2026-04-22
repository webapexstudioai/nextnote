import Link from "next/link";
import AdminThreadView from "./AdminThreadView";

export default function AdminThreadPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <Link href="/admin/support" className="text-sm text-neutral-400 hover:text-white">
        ← All threads
      </Link>
      <AdminThreadView threadId={params.id} />
    </div>
  );
}
