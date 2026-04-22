import Link from "next/link";
import UserDetail from "./UserDetail";

export default function AdminUserDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm text-neutral-400 hover:text-white">
        ← All users
      </Link>
      <UserDetail userId={params.id} />
    </div>
  );
}
