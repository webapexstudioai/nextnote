"use client";

import Link from "next/link";
import { Phone, ArrowRight } from "lucide-react";

export default function CallsPage() {
  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8">
        <div className="w-12 h-12 rounded-xl bg-[rgba(232,85,61,0.1)] flex items-center justify-center mb-4">
          <Phone className="w-6 h-6 text-[var(--accent)]" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Calls has been retired</h1>
        <p className="text-sm text-[var(--muted)] leading-relaxed mb-6">
          NextNote no longer routes calls through agency-owned numbers. Reach prospects directly from
          your own verified phone, and log notes from each conversation on the prospect&apos;s file.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/prospects"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors"
          >
            Go to Prospects <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/dashboard/voicedrops"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium hover:bg-[var(--card-hover)] transition-colors"
          >
            Voicedrops
          </Link>
        </div>
      </div>
    </div>
  );
}
