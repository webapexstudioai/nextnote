"use client";

import { useCallback, useEffect, useState } from "react";

interface UserDetail {
  id: string;
  name: string | null;
  email: string;
  agencyName: string | null;
  subscriptionTier: string | null;
  subscriptionStatus: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
  creditBalance: number;
  suspendedAt?: string | null;
}

interface Transaction {
  id: string;
  delta: number;
  reason: string;
  refId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface Stats {
  prospects: number;
  folders: number;
  files: number;
}

interface DetailResponse {
  user: UserDetail;
  stats: Stats;
  recentTransactions: Transaction[];
}

interface Note {
  id: string;
  body: string;
  createdAt: string;
  createdByEmail: string | null;
}

interface Charge {
  id: string;
  amount: number;
  currency: string;
  description: string | null;
  created: number;
  paid: boolean;
  refunded: boolean;
  amountRefunded: number;
  status: string;
  receiptUrl: string | null;
  metadata: Record<string, string>;
}

export default function UserDetail({ userId }: { userId: string }) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [subTier, setSubTier] = useState<string>("");
  const [subStatus, setSubStatus] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    const res = await fetch(`/api/admin/users/${userId}`);
    if (!res.ok) throw new Error("Failed to load user");
    const d = (await res.json()) as DetailResponse;
    setData(d);
    setSubTier(d.user.subscriptionTier ?? "");
    setSubStatus(d.user.subscriptionStatus ?? "");
  }, [userId]);

  const loadNotes = useCallback(async () => {
    const res = await fetch(`/api/admin/users/${userId}/notes`);
    if (res.ok) {
      const json = await res.json();
      setNotes(json.notes ?? []);
    }
  }, [userId]);

  const loadCharges = useCallback(async () => {
    const res = await fetch(`/api/admin/users/${userId}/charges`);
    if (res.ok) {
      const json = await res.json();
      setCharges(json.charges ?? []);
    }
  }, [userId]);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadDetail(), loadNotes(), loadCharges()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    })();
  }, [loadDetail, loadNotes, loadCharges]);

  function say(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3500);
  }

  async function submitCredits() {
    const amount = Number(creditAmount);
    if (!Number.isFinite(amount) || amount === 0) {
      say("Enter a non-zero amount (negative to deduct).");
      return;
    }
    setBusy("credits");
    try {
      const res = await fetch(`/api/admin/users/${userId}/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, note: creditNote }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      say(`Balance updated → ${json.newBalance.toLocaleString()} credits`);
      setCreditAmount("");
      setCreditNote("");
      await loadDetail();
    } catch (err) {
      say(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function submitSubscription() {
    setBusy("sub");
    try {
      const res = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionTier: subTier === "" ? null : subTier,
          subscriptionStatus: subStatus,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      say("Subscription updated.");
      await loadDetail();
    } catch (err) {
      say(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function addNote() {
    const body = noteDraft.trim();
    if (!body) return;
    setBusy("note");
    try {
      const res = await fetch(`/api/admin/users/${userId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed");
      }
      setNoteDraft("");
      await loadNotes();
    } catch (err) {
      say(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function deleteNote(noteId: string) {
    if (!confirm("Delete this note?")) return;
    const res = await fetch(`/api/admin/users/${userId}/notes?noteId=${noteId}`, { method: "DELETE" });
    if (res.ok) await loadNotes();
  }

  async function impersonate() {
    if (!confirm("Log in as this user? You'll see their dashboard exactly as they see it.")) return;
    setBusy("imp");
    try {
      const res = await fetch(`/api/admin/users/${userId}/impersonate`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      window.location.href = json.redirectTo || "/dashboard";
    } catch (err) {
      say(err instanceof Error ? err.message : "Failed");
      setBusy(null);
    }
  }

  async function suspend(next: boolean) {
    const verb = next ? "Suspend" : "Unsuspend";
    if (!confirm(`${verb} this user?`)) return;
    setBusy("suspend");
    try {
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspend: next }),
      });
      if (!res.ok) throw new Error("Failed");
      say(`${verb}d.`);
      await loadDetail();
    } catch (err) {
      say(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function resendVerification() {
    setBusy("verify");
    try {
      const res = await fetch(`/api/admin/users/${userId}/resend-verification`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      say("Verification email sent.");
    } catch (err) {
      say(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function sendPasswordReset() {
    if (!confirm("Send a password reset email to this user?")) return;
    setBusy("pwreset");
    try {
      const res = await fetch(`/api/admin/users/${userId}/password-reset`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      say("Password reset email sent.");
    } catch (err) {
      say(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function refund(chargeId: string, amount: number) {
    if (!confirm(`Refund ${(amount / 100).toFixed(2)}? This will also deduct the matching credits if any.`)) return;
    setBusy(`refund-${chargeId}`);
    try {
      const res = await fetch(`/api/admin/users/${userId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargeId, reverseCredits: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      say(`Refund ${json.status}. Credits reversed: ${json.creditsReversed ?? 0}`);
      await Promise.all([loadDetail(), loadCharges()]);
    } catch (err) {
      say(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  if (error) return <div className="text-red-400 text-sm">{error}</div>;
  if (!data) return <div className="text-neutral-500 text-sm">Loading...</div>;

  const { user, stats, recentTransactions } = data;
  const isSuspended = Boolean(user.suspendedAt);

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{user.name || user.email}</h2>
            <div className="mt-1 text-sm text-neutral-400">
              {user.email}
              {user.agencyName ? ` · ${user.agencyName}` : ""}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded bg-neutral-800 px-2 py-1 text-neutral-300">
                Status: {user.subscriptionStatus ?? "—"}
              </span>
              <span className="rounded bg-neutral-800 px-2 py-1 text-neutral-300">
                Tier: {user.subscriptionTier ?? "—"}
              </span>
              <span className="rounded bg-neutral-800 px-2 py-1 text-neutral-300">
                Email verified: {user.emailVerified ? "yes" : "no"}
              </span>
              {user.isAdmin && (
                <span className="rounded bg-amber-500/15 px-2 py-1 text-amber-400">admin</span>
              )}
              {isSuspended && (
                <span className="rounded bg-red-500/15 px-2 py-1 text-red-400">suspended</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Credits</div>
            <div className="font-mono text-3xl text-neutral-100">{user.creditBalance.toLocaleString()}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4 text-sm">
          <Stat label="Prospects" value={stats.prospects} />
          <Stat label="Folders" value={stats.folders} />
          <Stat label="Files" value={stats.files} />
        </div>

        <div className="mt-6 grid gap-3 text-xs text-neutral-500 md:grid-cols-2">
          <div>Joined: {new Date(user.createdAt).toLocaleString()}</div>
          <div>Stripe customer: {user.stripeCustomerId ?? "—"}</div>
          <div>Stripe subscription: {user.stripeSubscriptionId ?? "—"}</div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <ActionButton onClick={impersonate} busy={busy === "imp"} color="amber">
            Log in as user
          </ActionButton>
          {!user.emailVerified && (
            <ActionButton onClick={resendVerification} busy={busy === "verify"} color="neutral">
              Resend verification
            </ActionButton>
          )}
          <ActionButton onClick={sendPasswordReset} busy={busy === "pwreset"} color="neutral">
            Send password reset
          </ActionButton>
          <ActionButton
            onClick={() => suspend(!isSuspended)}
            busy={busy === "suspend"}
            color={isSuspended ? "emerald" : "red"}
          >
            {isSuspended ? "Unsuspend" : "Suspend"}
          </ActionButton>
        </div>
      </section>

      {flash && (
        <div className="rounded-md border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm text-neutral-200">
          {flash}
        </div>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-6">
          <h3 className="text-lg font-semibold">Adjust credits</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Positive values add credits. Negative values deduct.
          </p>
          <div className="mt-4 space-y-3">
            <input
              type="number"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="e.g. 500"
              className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-neutral-600 focus:outline-none"
            />
            <input
              value={creditNote}
              onChange={(e) => setCreditNote(e.target.value)}
              placeholder="Note (optional)"
              className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-neutral-600 focus:outline-none"
            />
            <button
              onClick={submitCredits}
              disabled={busy === "credits"}
              className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy === "credits" ? "Applying..." : "Apply"}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-6">
          <h3 className="text-lg font-semibold">Override subscription</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Bypasses Stripe. Use for comped accounts or to grant dashboard access manually.
          </p>
          <div className="mt-4 space-y-3">
            <label className="block text-xs text-neutral-400">Status</label>
            <select
              value={subStatus}
              onChange={(e) => setSubStatus(e.target.value)}
              className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-neutral-600 focus:outline-none"
            >
              <option value="active">active</option>
              <option value="trialing">trialing</option>
              <option value="past_due">past_due</option>
              <option value="canceled">canceled</option>
              <option value="pending">pending</option>
              <option value="incomplete">incomplete</option>
            </select>
            <label className="block text-xs text-neutral-400">Tier</label>
            <select
              value={subTier}
              onChange={(e) => setSubTier(e.target.value)}
              className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-neutral-600 focus:outline-none"
            >
              <option value="">— none —</option>
              <option value="starter">starter</option>
              <option value="pro">pro</option>
              <option value="agency">agency</option>
            </select>
            <button
              onClick={submitSubscription}
              disabled={busy === "sub"}
              className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {busy === "sub" ? "Saving..." : "Save override"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-6">
        <h3 className="text-lg font-semibold">Internal notes</h3>
        <p className="mt-1 text-xs text-neutral-500">Visible only to admins.</p>
        <div className="mt-4 space-y-3">
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Add a note…"
            rows={3}
            className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-neutral-600 focus:outline-none"
          />
          <button
            onClick={addNote}
            disabled={busy === "note" || !noteDraft.trim()}
            className="rounded-md bg-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
          >
            {busy === "note" ? "Saving..." : "Add note"}
          </button>
          <div className="mt-4 space-y-2">
            {notes.length === 0 && <div className="text-xs text-neutral-500">No notes yet.</div>}
            {notes.map((n) => (
              <div key={n.id} className="rounded border border-neutral-800 bg-neutral-950/60 p-3">
                <div className="whitespace-pre-wrap text-sm text-neutral-200">{n.body}</div>
                <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                  <span>
                    {n.createdByEmail ?? "admin"} · {new Date(n.createdAt).toLocaleString()}
                  </span>
                  <button onClick={() => deleteNote(n.id)} className="text-red-400 hover:text-red-300">
                    delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-6">
        <h3 className="text-lg font-semibold">Stripe charges</h3>
        <div className="mt-4 overflow-hidden rounded border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left">When</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {charges.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-neutral-500">
                    No charges on file.
                  </td>
                </tr>
              )}
              {charges.map((c) => {
                const amount = (c.amount / 100).toFixed(2);
                const fullyRefunded = c.refunded || c.amountRefunded >= c.amount;
                return (
                  <tr key={c.id}>
                    <td className="px-3 py-2 text-neutral-400">
                      {new Date(c.created * 1000).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-neutral-300">{c.description ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-neutral-200">
                      ${amount} {c.currency.toUpperCase()}
                    </td>
                    <td className="px-3 py-2">
                      {fullyRefunded ? (
                        <span className="text-red-400">refunded</span>
                      ) : c.amountRefunded > 0 ? (
                        <span className="text-amber-400">
                          partial (${(c.amountRefunded / 100).toFixed(2)})
                        </span>
                      ) : c.paid ? (
                        <span className="text-emerald-400">paid</span>
                      ) : (
                        <span className="text-neutral-500">{c.status}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!fullyRefunded && c.paid && (
                        <button
                          onClick={() => refund(c.id, c.amount)}
                          disabled={busy === `refund-${c.id}`}
                          className="rounded bg-red-600/20 px-2 py-1 text-xs text-red-300 hover:bg-red-600/30 disabled:opacity-50"
                        >
                          {busy === `refund-${c.id}` ? "Refunding…" : "Refund"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-6">
        <h3 className="text-lg font-semibold">Recent credit activity</h3>
        <div className="mt-4 overflow-hidden rounded border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left">When</th>
                <th className="px-3 py-2 text-right">Delta</th>
                <th className="px-3 py-2 text-left">Reason</th>
                <th className="px-3 py-2 text-left">Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {recentTransactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-neutral-500">
                    No activity yet.
                  </td>
                </tr>
              )}
              {recentTransactions.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2 text-neutral-400">
                    {new Date(t.createdAt).toLocaleString()}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-mono ${
                      t.delta >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {t.delta >= 0 ? `+${t.delta}` : t.delta}
                  </td>
                  <td className="px-3 py-2 text-neutral-300">{t.reason}</td>
                  <td className="px-3 py-2 text-neutral-500 font-mono text-xs">{t.refId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-950/60 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="font-mono text-lg text-neutral-100">{value.toLocaleString()}</div>
    </div>
  );
}

function ActionButton({
  onClick,
  busy,
  color,
  children,
}: {
  onClick: () => void;
  busy: boolean;
  color: "amber" | "red" | "emerald" | "neutral";
  children: React.ReactNode;
}) {
  const palette = {
    amber: "bg-amber-600 hover:bg-amber-500",
    red: "bg-red-600 hover:bg-red-500",
    emerald: "bg-emerald-600 hover:bg-emerald-500",
    neutral: "bg-neutral-700 hover:bg-neutral-600",
  }[color];
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 ${palette}`}
    >
      {busy ? "Working…" : children}
    </button>
  );
}
