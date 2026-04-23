import SupportInbox from "./SupportInbox";

export default function AdminSupportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Support inbox</h1>
        <p className="mt-1 text-sm text-neutral-500">Customer threads · unread highlighted in amber.</p>
      </div>
      <SupportInbox />
    </div>
  );
}
