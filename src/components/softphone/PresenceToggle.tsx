"use client";

import { Phone, PhoneOff, Loader2 } from "lucide-react";
import { useSoftphone } from "@/context/SoftphoneProvider";

export default function PresenceToggle({ compact }: { compact?: boolean }) {
  const { available, ready, setAvailable, configError } = useSoftphone();

  const tooltip = configError
    ? configError
    : available
      ? ready
        ? "Calls ring in this browser. Toggle off to fall back to your cell."
        : "Connecting…"
      : "Toggle on to receive calls in your browser.";

  if (compact) {
    return (
      <button
        onClick={() => setAvailable(!available)}
        title={tooltip}
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
          available
            ? "border-[rgba(232,85,61,0.4)] bg-[rgba(232,85,61,0.12)] text-[#ff8a6a]"
            : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
        }`}
      >
        {available ? (
          ready ? (
            <Phone className="h-3.5 w-3.5" />
          ) : (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )
        ) : (
          <PhoneOff className="h-3.5 w-3.5" />
        )}
        <span>{available ? "Available" : "Not taking calls"}</span>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-900 bg-[rgba(255,255,255,0.02)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-neutral-100">
            {available ? "Available for calls" : "Not taking calls"}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">{tooltip}</p>
        </div>
        <button
          onClick={() => setAvailable(!available)}
          aria-pressed={available}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors ${
            available
              ? "border-[rgba(232,85,61,0.5)] bg-[#e8553d]"
              : "border-neutral-700 bg-neutral-800"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 translate-x-0.5 transform rounded-full bg-white shadow transition-transform ${
              available ? "translate-x-[22px]" : ""
            }`}
          />
        </button>
      </div>
      {configError && (
        <p className="mt-2 rounded-md bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300">
          {configError}
        </p>
      )}
    </div>
  );
}
