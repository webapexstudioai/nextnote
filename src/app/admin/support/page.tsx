import SupportInbox from "./SupportInbox";

export default function AdminSupportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Support inbox</h1>
        <p className="text-sm text-neutral-400">Customer threads. Unread highlighted.</p>
      </div>
      <SupportInbox />
    </div>
  );
}
