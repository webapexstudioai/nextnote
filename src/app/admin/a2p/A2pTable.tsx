"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCcw, Check, X, AlertCircle, CheckCircle2, Clock, Mail } from "lucide-react";

interface Row {
  user_id: string;
  email: string;
  agency_name: string | null;
  legal_name: string;
  profile_complete: boolean;
  a2p_status: string;
  customer_profile_sid: string | null;
  brand_sid: string | null;
  messaging_service_sid: string | null;
  campaign_sid: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  error_message: string | null;
  admin_notes: string | null;
  last_synced_at: string | null;
}

function statusTone(s: string): { color: string; icon: typeof Clock } {
  if (s === "admin_approved" || s === "profile_approved" || s === "brand_approved" || s === "campaign_approved" || s === "live") {
    return { color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", icon: CheckCircle2 };
  }
  if (s === "admin_rejected" || s === "profile_rejected" || s === "brand_rejected" || s === "campaign_rejected") {
    return { color: "border-rose-500/30 bg-rose-500/10 text-rose-300", icon: AlertCircle };
  }
  if (s === "not_started") {
    return { color: "border-neutral-700 bg-neutral-900 text-neutral-400", icon: Clock };
  }
  return { color: "border-amber-500/30 bg-amber-500/10 text-amber-300", icon: Clock };
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function A2pTable() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [rejectingUser, setRejectingUser] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/admin/a2p/list");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setRows(data.registrations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(userId: string) {
    setBusyUser(userId);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${userId}/a2p/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approve failed");
      if (data.email_error) {
        setError(`Approved, but email failed: ${data.email_error}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusyUser(null);
    }
  }

  async function reject(userId: string) {
    if (!rejectNote.trim()) {
      setError("Add a note explaining what to fix.");
      return;
    }
    setBusyUser(userId);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${userId}/a2p/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_notes: rejectNote.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reject failed");
      if (data.email_error) {
        setError(`Rejected, but email failed: ${data.email_error}`);
      }
      setRejectingUser(null);
      setRejectNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusyUser(null);
    }
  }

  async function sync(userId: string) {
    setBusyUser(userId);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${userId}/a2p/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusyUser(null);
    }
  }

  if (rows === null) return <div className="text-sm text-neutral-500">Loading…</div>;

  const reviewable = (s: string) => s === "pending_admin_review";
  const synceable = (s: string) =>
    s === "profile_pending" || s === "profile_approved" || s === "brand_pending" || s === "brand_approved" ||
    s === "campaign_pending" || s === "campaign_approved";

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-8 text-center text-sm text-neutral-500">
          No business profiles yet — users need to complete the KYB form first.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900/50 text-left text-[11px] uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const tone = statusTone(r.a2p_status);
                const Icon = tone.icon;
                const isBusy = busyUser === r.user_id;
                const isRejecting = rejectingUser === r.user_id;
                return (
                  <tr key={r.user_id} className="border-t border-neutral-900 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-neutral-100">{r.legal_name}</div>
                      {r.error_message && (
                        <div className="mt-1 text-[11px] text-rose-300">{r.error_message}</div>
                      )}
                      {r.admin_notes && r.a2p_status === "admin_rejected" && (
                        <div className="mt-1 text-[11px] text-amber-300">Note sent: {r.admin_notes}</div>
                      )}
                      {r.customer_profile_sid && (
                        <div className="font-mono text-[10px] text-neutral-600">{r.customer_profile_sid}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-300">
                      <div>{r.email}</div>
                      {r.agency_name && <div className="text-[11px] text-neutral-500">{r.agency_name}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone.color}`}>
                        <Icon className="h-3 w-3" />
                        {r.a2p_status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-neutral-400">{fmt(r.submitted_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {!r.profile_complete ? (
                        <span className="text-[11px] text-neutral-500">Profile incomplete</span>
                      ) : reviewable(r.a2p_status) || r.a2p_status === "admin_rejected" || r.a2p_status === "admin_approved" ? (
                        isRejecting ? (
                          <div className="flex flex-col items-end gap-2">
                            <textarea
                              value={rejectNote}
                              onChange={(e) => setRejectNote(e.target.value)}
                              placeholder="What does the user need to fix?"
                              rows={3}
                              className="w-72 rounded-md border border-neutral-800 bg-neutral-900 p-2 text-xs text-neutral-200 focus:border-violet-500 focus:outline-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setRejectingUser(null);
                                  setRejectNote("");
                                }}
                                disabled={isBusy}
                                className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => reject(r.user_id)}
                                disabled={isBusy || !rejectNote.trim()}
                                className="inline-flex items-center gap-1.5 rounded-md bg-rose-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-400 disabled:opacity-50"
                              >
                                {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                                Send rejection
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setRejectingUser(r.user_id);
                                setRejectNote(r.admin_notes || "");
                              }}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                            >
                              <X className="h-3 w-3" />
                              Reject
                            </button>
                            <button
                              onClick={() => approve(r.user_id)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-400 disabled:opacity-50"
                            >
                              {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              Approve
                            </button>
                          </div>
                        )
                      ) : synceable(r.a2p_status) ? (
                        <button
                          onClick={() => sync(r.user_id)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
                        >
                          {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
                          Refresh
                        </button>
                      ) : (
                        <span className="text-[11px] text-neutral-500">No action</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
