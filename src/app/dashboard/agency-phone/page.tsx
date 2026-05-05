"use client";

import Link from "next/link";
import { Phone, ArrowRight } from "lucide-react";

export default function AgencyPhonePage() {
  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8">
        <div className="w-12 h-12 rounded-xl bg-[rgba(232,85,61,0.1)] flex items-center justify-center mb-4">
          <Phone className="w-6 h-6 text-[var(--accent)]" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Agency Phone has been retired</h1>
        <p className="text-sm text-[var(--muted)] leading-relaxed mb-6">
          NextNote has moved away from agency-owned phone lines. Outreach now uses your own verified
          personal number, so ringless voicemail drops, SMS, and replies all come from a number your
          prospects already trust.
        </p>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/50 p-4 mb-6">
          <p className="text-xs uppercase tracking-wider text-[var(--muted)] font-semibold mb-2">
            What to do next
          </p>
          <ul className="text-sm space-y-1.5 text-[var(--foreground)]">
            <li>1. Verify your personal phone in Settings.</li>
            <li>2. Use Voicedrops to send ringless voicemails from your number.</li>
            <li>3. Use Messages or Templates for SMS outreach.</li>
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors"
          >
            Go to Settings <ArrowRight className="w-3.5 h-3.5" />
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
