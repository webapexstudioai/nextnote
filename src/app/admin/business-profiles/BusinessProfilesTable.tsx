"use client";

import { Fragment, useEffect, useState } from "react";
import { Search, ShieldCheck, Globe, MapPin, ChevronDown, ChevronRight } from "lucide-react";

interface AdminProfile {
  userId: string;
  email: string;
  agencyName: string | null;
  legalName: string;
  ein: string | null;
  businessType: string | null;
  website: string | null;
  location: string;
  repName: string;
  repEmail: string;
  useCase: string;
  tcpaAttested: boolean;
  attestedAt: string | null;
  attestedIp: string | null;
  createdAt: string;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function BusinessProfilesTable() {
  const [profiles, setProfiles] = useState<AdminProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(`/api/admin/business-profiles?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load profiles");
        const data = await res.json();
        if (!cancelled) setProfiles(data.profiles);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by legal name, EIN, or rep email…"
          className="w-full rounded-lg border border-neutral-800 bg-neutral-950 pl-9 pr-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-violet-500/50"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
      )}

      {profiles === null ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : profiles.length === 0 ? (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-8 text-center text-sm text-neutral-500">
          No business profiles submitted yet.
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900/50">
              <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-500">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3">Legal name</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">EIN</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Attested</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const isOpen = expanded === p.userId;
                return (
                  <Fragment key={p.userId}>
                    <tr
                      className="border-t border-neutral-900 hover:bg-neutral-900/40 cursor-pointer transition-colors"
                      onClick={() => setExpanded(isOpen ? null : p.userId)}
                    >
                      <td className="px-4 py-3 text-neutral-500">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="px-4 py-3 font-medium text-neutral-100">
                        <div className="flex items-center gap-2">
                          {p.tcpaAttested && <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                          <span className="truncate">{p.legalName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-400">
                        <div className="truncate">{p.email}</div>
                        {p.agencyName && <div className="text-[11px] text-neutral-600 truncate">{p.agencyName}</div>}
                      </td>
                      <td className="px-4 py-3 text-neutral-400 capitalize">{p.businessType?.replace("_", " ") || "—"}</td>
                      <td className="px-4 py-3 font-mono text-neutral-400">{p.ein || "—"}</td>
                      <td className="px-4 py-3 text-neutral-400">{p.location || "—"}</td>
                      <td className="px-4 py-3 text-neutral-400 whitespace-nowrap">{fmtDate(p.attestedAt)}</td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t border-neutral-900 bg-neutral-900/20">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-xs">
                            <Detail label="Authorized rep" value={`${p.repName} <${p.repEmail}>`} />
                            <Detail label="Attested IP" value={p.attestedIp || "—"} mono />
                            {p.website && (
                              <Detail
                                label="Website"
                                value={
                                  <a
                                    href={p.website.startsWith("http") ? p.website : `https://${p.website}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-violet-300 hover:underline inline-flex items-center gap-1"
                                  >
                                    <Globe className="h-3 w-3" /> {p.website}
                                  </a>
                                }
                              />
                            )}
                            <Detail label="Created" value={fmtDate(p.createdAt)} />
                            <div className="md:col-span-2">
                              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Use case</div>
                              <div className="text-neutral-300 whitespace-pre-wrap">{p.useCase}</div>
                            </div>
                            <div className="md:col-span-2">
                              <a
                                href={`/admin/users/${p.userId}`}
                                className="text-xs text-violet-300 hover:underline inline-flex items-center gap-1"
                              >
                                <MapPin className="h-3 w-3" /> Open user record →
                              </a>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-0.5">{label}</div>
      <div className={`text-neutral-300 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
