import { Suspense } from "react";
import BusinessProfilesTable from "./BusinessProfilesTable";

export default function AdminBusinessProfilesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Business profiles</h1>
        <p className="mt-1 text-sm text-neutral-500">
          KYB + TCPA attestations submitted by users before purchasing a phone number. This is your audit trail for carrier compliance.
        </p>
      </div>
      <Suspense fallback={<div className="text-sm text-neutral-500">Loading…</div>}>
        <BusinessProfilesTable />
      </Suspense>
    </div>
  );
}
