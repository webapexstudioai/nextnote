"use client";

import { useState, useEffect } from "react";
import {
  Settings, User, Bell, Shield, Palette, Save, CheckCircle, Loader2,
  Key, Eye, EyeOff, Trash2, Zap, Crown,
} from "lucide-react";
import { ACCENT_COLORS, UI_DENSITIES, TIERS } from "@/lib/subscriptions";
import type { SubscriptionTier } from "@/lib/subscriptions";

interface UserProfile {
  name: string;
  email: string;
  agencyName: string;
  emailVerified: boolean;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: string;
}

interface SettingsData {
  anthropic_api_key: string | null;
  openai_api_key: string | null;
  anthropic_connected: boolean;
  openai_connected: boolean;
  accent_color: string;
  ui_density: string;
}

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<UserProfile>({
    name: "", email: "", agencyName: "",
    emailVerified: false, subscriptionTier: "starter", subscriptionStatus: "active",
  });
  const [notifications, setNotifications] = useState({
    newLead: true,
    appointmentReminder: true,
    weeklyDigest: false,
  });
  const [settings, setSettings] = useState<SettingsData>({
    anthropic_api_key: null, openai_api_key: null,
    anthropic_connected: false, openai_connected: false,
    accent_color: "red-orange", ui_density: "default",
  });

  // API key input state
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);

  // Customization state
  const [accentColor, setAccentColor] = useState("red-orange");
  const [uiDensity, setUiDensity] = useState("default");

  useEffect(() => {
    async function load() {
      try {
        const [meRes, settingsRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/settings"),
        ]);
        if (meRes.ok) {
          const meData = await meRes.json();
          setProfile({
            name: meData.user.name || "",
            email: meData.user.email || "",
            agencyName: meData.user.agencyName || "",
            emailVerified: meData.user.emailVerified ?? false,
            subscriptionTier: meData.user.subscriptionTier || "starter",
            subscriptionStatus: meData.user.subscriptionStatus || "active",
          });
        }
        if (settingsRes.ok) {
          const s = await settingsRes.json();
          setSettings(s);
          setAccentColor(s.accent_color || "red-orange");
          setUiDensity(s.ui_density || "default");
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, string | null> = {
        accent_color: accentColor,
        ui_density: uiDensity,
      };
      if (anthropicKey) body.anthropic_api_key = anthropicKey;
      if (openaiKey) body.openai_api_key = openaiKey;

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        // Refresh settings
        const settingsRes = await fetch("/api/settings");
        if (settingsRes.ok) {
          const s = await settingsRes.json();
          setSettings(s);
        }
        setAnthropicKey("");
        setOpenaiKey("");
        // Apply accent color live
        applyAccentColor(accentColor);
        applyUiDensity(uiDensity);
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }

  async function removeApiKey(provider: "anthropic" | "openai") {
    const body: Record<string, null> = {};
    if (provider === "anthropic") body.anthropic_api_key = null;
    else body.openai_api_key = null;

    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const settingsRes = await fetch("/api/settings");
      if (settingsRes.ok) setSettings(await settingsRes.json());
    }
  }

  function applyAccentColor(colorId: string) {
    const color = ACCENT_COLORS.find((c) => c.id === colorId);
    if (color) {
      document.documentElement.style.setProperty("--accent", color.css);
      document.documentElement.style.setProperty("--accent-hover", color.hover);
      document.documentElement.style.setProperty("--accent-glow", color.glow);
    }
  }

  function applyUiDensity(densityId: string) {
    const density = UI_DENSITIES.find((d) => d.id === densityId);
    if (density) {
      document.documentElement.style.setProperty("--ui-scale", density.scale.toString());
    }
  }

  const tierConfig = TIERS[profile.subscriptionTier] || TIERS.starter;

  const inputClass =
    "w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--muted)]" />
      </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-30 bg-[rgba(10,10,15,0.85)] backdrop-blur-xl border-b border-[var(--border)]">
        <div className="px-4 sm:px-6 py-4">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Settings className="w-5 h-5 text-[var(--muted)]" /> Settings
          </h1>
          <p className="text-xs text-[var(--muted)]">Manage your account, API keys, and preferences</p>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-2xl space-y-6">
        {/* Profile */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-[var(--accent)]" /> Profile
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1.5 block">Name</label>
              <input type="text" value={profile.name} readOnly className={inputClass + " opacity-70 cursor-default"} />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1.5 block">Email</label>
              <div className="relative">
                <input type="text" value={profile.email} readOnly className={inputClass + " opacity-70 cursor-default pr-20"} />
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  profile.emailVerified
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                }`}>
                  {profile.emailVerified ? "Verified" : "Unverified"}
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1.5 block">Agency</label>
              <input type="text" value={profile.agencyName} readOnly className={inputClass + " opacity-70 cursor-default"} />
            </div>
          </div>
        </div>

        {/* Subscription Plan */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" /> Subscription Plan
          </h3>
          <div className="flex items-center gap-3 mb-4">
            <div className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
              profile.subscriptionTier === "agency" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
              profile.subscriptionTier === "pro" ? "bg-[rgba(232,85,61,0.1)] text-[var(--accent)] border border-[rgba(232,85,61,0.2)]" :
              "bg-zinc-800 text-zinc-300 border border-zinc-700"
            }`}>
              {tierConfig.name}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              profile.subscriptionStatus === "active"
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-amber-500/10 text-amber-400"
            }`}>
              {profile.subscriptionStatus}
            </span>
          </div>
          <p className="text-xs text-[var(--muted)] mb-3">{tierConfig.tagline}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {tierConfig.features.map((f) => (
              <div key={f} className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                {f}
              </div>
            ))}
          </div>
          {profile.subscriptionTier !== "agency" && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--muted)]">
                Upgrade coming soon. More features and higher limits are on the way.
              </p>
            </div>
          )}
        </div>

        {/* API Keys */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Key className="w-4 h-4 text-emerald-400" /> AI API Keys
          </h3>
          <p className="text-xs text-[var(--muted)] mb-4">
            Add your own API keys to power AI features like summaries, parsing, and insights.
          </p>

          {/* Anthropic */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Anthropic API Key</label>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                settings.anthropic_connected
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-zinc-800 text-zinc-500 border border-zinc-700"
              }`}>
                {settings.anthropic_connected ? "Connected" : "Not connected"}
              </span>
            </div>
            {settings.anthropic_connected ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--muted)] font-mono">
                  {settings.anthropic_api_key}
                </div>
                <button
                  onClick={() => removeApiKey("anthropic")}
                  className="p-2.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Remove key"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type={showAnthropicKey ? "text" : "password"}
                  placeholder="sk-ant-api03-..."
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  {showAnthropicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>

          {/* OpenAI */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">OpenAI API Key</label>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                settings.openai_connected
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-zinc-800 text-zinc-500 border border-zinc-700"
              }`}>
                {settings.openai_connected ? "Connected" : "Not connected"}
              </span>
            </div>
            {settings.openai_connected ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--muted)] font-mono">
                  {settings.openai_api_key}
                </div>
                <button
                  onClick={() => removeApiKey("openai")}
                  className="p-2.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Remove key"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type={showOpenaiKey ? "text" : "password"}
                  placeholder="sk-..."
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  {showOpenaiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>

          <p className="text-[10px] text-[var(--muted)] mt-3 flex items-start gap-1.5">
            <Shield className="w-3 h-3 mt-0.5 shrink-0" />
            Keys are encrypted at rest and never exposed in the frontend. They power AI-driven features like import parsing and note summaries.
          </p>
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

        {/* Appearance / Customization */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Palette className="w-4 h-4 text-purple-400" /> Appearance
          </h3>

          {/* Accent Color */}
          <div className="mb-5">
            <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-3 block">
              Accent Color
            </label>
            <div className="flex flex-wrap gap-2">
              {ACCENT_COLORS.map((color) => (
                <button
                  key={color.id}
                  onClick={() => {
                    setAccentColor(color.id);
                    applyAccentColor(color.id);
                  }}
                  className={`w-10 h-10 rounded-lg border-2 transition-all flex items-center justify-center ${
                    accentColor === color.id
                      ? "border-white scale-110 shadow-lg"
                      : "border-transparent hover:border-zinc-600"
                  }`}
                  style={{ backgroundColor: color.css + "20" }}
                  title={color.label}
                >
                  <div
                    className="w-5 h-5 rounded-full"
                    style={{ backgroundColor: color.css }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* UI Density */}
          <div className="mb-5">
            <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-3 block">
              UI Density
            </label>
            <div className="flex gap-2">
              {UI_DENSITIES.map((density) => (
                <button
                  key={density.id}
                  onClick={() => {
                    setUiDensity(density.id);
                    applyUiDensity(density.id);
                  }}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    uiDensity === density.id
                      ? "bg-[rgba(232,85,61,0.1)] border border-[rgba(232,85,61,0.3)] text-[var(--accent)]"
                      : "bg-[var(--background)] border border-[var(--border)] text-[var(--muted)] hover:border-zinc-600"
                  }`}
                >
                  {density.label}
                </button>
              ))}
            </div>
          </div>

          {/* Theme (dark only for now) */}
          <div>
            <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-3 block">
              Theme
            </label>
            <div className="flex gap-3">
              <button className="flex-1 px-4 py-3 rounded-lg bg-[rgba(232,85,61,0.1)] border border-[rgba(232,85,61,0.3)] text-sm text-[var(--accent)] font-medium">
                Dark Mode
              </button>
              <button className="flex-1 px-4 py-3 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--muted)] font-medium cursor-not-allowed opacity-50">
                Light Mode (Coming Soon)
              </button>
            </div>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
        >
          {saved ? (
            <>
              <CheckCircle className="w-4 h-4" /> Saved!
            </>
          ) : saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> Save Settings
            </>
          )}
        </button>

        {/* Quick feature info */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" /> Feature Access
          </h3>
          <div className="space-y-2 text-xs text-[var(--muted)]">
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--background)]">
              <span>AI Summaries & Insights</span>
              <span className={tierConfig.limits.aiSummariesPerMonth > 0 ? "text-emerald-400" : "text-zinc-600"}>
                {tierConfig.limits.aiSummariesPerMonth > 0
                  ? `${tierConfig.limits.aiSummariesPerMonth}/mo`
                  : "Pro+"}
              </span>
            </div>
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--background)]">
              <span>Spreadsheet Import</span>
              <span className={tierConfig.limits.spreadsheetImport ? "text-emerald-400" : "text-zinc-600"}>
                {tierConfig.limits.spreadsheetImport ? "Included" : "Pro+"}
              </span>
            </div>
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--background)]">
              <span>Google Calendar</span>
              <span className={tierConfig.limits.googleCalendar ? "text-emerald-400" : "text-zinc-600"}>
                {tierConfig.limits.googleCalendar ? "Included" : "Pro+"}
              </span>
            </div>
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--background)]">
              <span>API Key Support</span>
              <span className={tierConfig.limits.apiKeySupport ? "text-emerald-400" : "text-zinc-600"}>
                {tierConfig.limits.apiKeySupport ? "Included" : "Pro+"}
              </span>
            </div>
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--background)]">
              <span>Team Members</span>
              <span className="text-zinc-400">{tierConfig.limits.teamMembers === 1 ? "Solo" : `Up to ${tierConfig.limits.teamMembers}`}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
