import AuditLog from "./AuditLog";

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-neutral-500">Every admin action, newest first.</p>
      </div>
      <AuditLog />
    </div>
  );
}
