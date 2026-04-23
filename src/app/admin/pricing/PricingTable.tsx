"use client";

import type { PricingEntry } from "@/lib/credits";

interface Props {
  entries: PricingEntry[];
  retail: number;
}

function marginBadge(marginPct: number) {
  if (marginPct < 0) {
    return "bg-red-500/10 text-red-300 border-red-500/25";
  }
  if (marginPct < 20) {
    return "bg-amber-500/10 text-amber-300 border-amber-500/25";
  }
  if (marginPct < 50) {
    return "bg-sky-500/10 text-sky-300 border-sky-500/25";
  }
  return "bg-emerald-500/10 text-emerald-300 border-emerald-500/25";
}

function verdict(marginPct: number) {
  if (marginPct < 0) return "Losing money";
  if (marginPct < 20) return "Thin";
  if (marginPct < 50) return "OK";
  return "Healthy";
}

export default function PricingTable({ entries, retail }: Props) {
  const rows = entries.map((e) => {
    const retailUsd = e.creditsPerUnit * retail;
    const marginUsd = retailUsd - e.estUpstreamCostUsd;
    const marginPct = retailUsd > 0 ? (marginUsd / retailUsd) * 100 : 0;
    return { ...e, retailUsd, marginUsd, marginPct };
  });

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-900">
      <table className="w-full text-sm">
        <thead className="bg-neutral-950 text-[11px] uppercase tracking-wider text-neutral-500">
          <tr className="border-b border-neutral-900">
            <th className="px-5 py-3 text-left font-medium">Feature</th>
            <th className="px-5 py-3 text-right font-medium">Credits</th>
            <th className="px-5 py-3 text-right font-medium">Retail</th>
            <th className="px-5 py-3 text-right font-medium">Est. cost</th>
            <th className="px-5 py-3 text-right font-medium">Margin</th>
            <th className="px-5 py-3 text-right font-medium">Margin %</th>
            <th className="px-5 py-3 text-left font-medium">Upstream</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-900 bg-neutral-950">
          {rows.map((r) => (
            <tr key={r.key} className="transition-colors hover:bg-neutral-900/60">
              <td className="px-5 py-3">
                <div className="text-neutral-100">{r.label}</div>
                <div className="text-[11px] text-neutral-500">{r.unit}</div>
              </td>
              <td className="px-5 py-3 text-right font-mono text-neutral-300">
                {r.creditsPerUnit.toLocaleString()}
              </td>
              <td className="px-5 py-3 text-right font-mono text-neutral-300">
                ${r.retailUsd.toFixed(3)}
              </td>
              <td className="px-5 py-3 text-right font-mono text-neutral-400">
                ${r.estUpstreamCostUsd.toFixed(3)}
              </td>
              <td className="px-5 py-3 text-right font-mono text-neutral-300">
                {r.marginUsd >= 0 ? "+" : ""}
                ${r.marginUsd.toFixed(3)}
              </td>
              <td className="px-5 py-3 text-right">
                <span
                  className={`rounded-md border px-2 py-0.5 text-[11px] ${marginBadge(r.marginPct)}`}
                  title={verdict(r.marginPct)}
                >
                  {r.marginPct.toFixed(0)}%
                </span>
              </td>
              <td className="px-5 py-3 text-[11px] text-neutral-500">{r.upstream}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
