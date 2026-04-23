import { Suspense } from "react";
import UsersTable from "./UsersTable";

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-neutral-500">Search, inspect, and manage every NextNote customer.</p>
      </div>
      <Suspense fallback={<div className="text-sm text-neutral-500">Loading…</div>}>
        <UsersTable />
      </Suspense>
    </div>
  );
}
