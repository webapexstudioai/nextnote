"use client";

import { useState } from "react";
import { Settings, User, Bell, Shield, Palette, Save, CheckCircle } from "lucide-react";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState({
    name: "Edgar",
    email: "edgar@apexstudio.com",
    company: "Apex Studio",
    role: "Owner",
  });
  const [notifications, setNotifications] = useState({
    newLead: true,
    appointmentReminder: true,
    weeklyDigest: false,
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-[rgba(10,10,15,0.85)] backdrop-blur-xl border-b border-[var(--border)]">
        <div className="px-4 sm:px-6 py-4">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Settings className="w-5 h-5 text-[var(--muted)]" /> Settings
          </h1>
          <p className="text-xs text-[var(--muted)]">Manage your account and preferences</p>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-2xl space-y-6">
        {/* Profile */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-400" /> Profile
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(profile).map(([key, value]) => (
              <div key={key}>
                <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
                  {key}
                </label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" /> Notifications
          </h3>
          <div className="space-y-3">
            {[
              { key: "newLead" as const, label: "New Lead Alerts", desc: "Get notified when a new prospect is added" },
              { key: "appointmentReminder" as const, label: "Appointment Reminders", desc: "Reminder 1 hour before scheduled appointments" },
              { key: "weeklyDigest" as const, label: "Weekly Digest", desc: "Summary of your pipeline activity every Monday" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between px-3 py-3 rounded-lg bg-[var(--background)]">
                <div>
                  <p className="text-sm">{item.label}</p>
                  <p className="text-xs text-[var(--muted)]">{item.desc}</p>
                </div>
                <button
                  onClick={() => setNotifications((n) => ({ ...n, [item.key]: !n[item.key] }))}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    notifications[item.key] ? "bg-[var(--accent)]" : "bg-zinc-700"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                      notifications[item.key] ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* API Keys */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" /> API Configuration
          </h3>
          <div>
            <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
              Anthropic API Key
            </label>
            <input
              type="password"
              placeholder="sk-ant-..."
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
            <p className="text-[10px] text-[var(--muted)] mt-1.5">
              Used for AI-powered import and insights. Set in .env.local for now.
            </p>
          </div>
        </div>

        {/* Theme */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Palette className="w-4 h-4 text-purple-400" /> Appearance
          </h3>
          <div className="flex gap-3">
            <button className="flex-1 px-4 py-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-sm text-indigo-400 font-medium">
              Dark Mode
            </button>
            <button className="flex-1 px-4 py-3 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--muted)] font-medium cursor-not-allowed opacity-50">
              Light Mode (Coming Soon)
            </button>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
        >
          {saved ? (
            <>
              <CheckCircle className="w-4 h-4" /> Saved!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> Save Settings
            </>
          )}
        </button>
      </div>
    </>
  );
}
