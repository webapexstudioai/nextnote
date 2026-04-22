import UsersTable from "./UsersTable";

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">All users</h1>
        <p className="text-sm text-neutral-400">Search, inspect, and manage every NextNote customer.</p>
      </div>
      <UsersTable />
    </div>
  );
}
