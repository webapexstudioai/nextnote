import { Suspense } from "react";
import A2pTable from "./A2pTable";

export default function AdminA2pPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">10DLC compliance</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Submit each user&apos;s business profile to Twilio Trust Hub for A2P 10DLC carrier registration. Without this, US carriers (especially T-Mobile) silently drop SMS — that&apos;s the &quot;Undelivered&quot; status you see in conversations.
        </p>
      </div>
      <Suspense fallback={<div className="text-sm text-neutral-500">Loading…</div>}>
        <A2pTable />
      </Suspense>
    </div>
  );
}
