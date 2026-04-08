"use client";

import { useState, useEffect } from "react";
import {
  Settings, User, Bell, Shield, Palette, Save, CheckCircle, Loader2,
  Key, Eye, EyeOff, Trash2, Zap, Crown, AlertCircle, Sun, Moon,
} from "lucide-react";
import { TIERS } from "@/lib/subscriptions";
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
  theme_mode: string;
}

type KeyValidationState = "idle" | "validating" | "valid" | "invalid";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
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
    theme_mode: "dark",
  });

  // API key input state
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [anthropicValidation, setAnthropicValidation] = useState<KeyValidationState>("idle");
  const [openaiValidation, setOpenaiValidation] = useState<KeyValidationState>("idle");
  const [anthropicError, setAnthropicError] = useState("");
  const [openaiError, setOpenaiError] = useState("");

  // Theme state
  const [themeMode, setThemeMode] = useState("dark");

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
          setThemeMode(s.theme_mode || "dark");
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function validateKey(provider: "anthropic" | "openai", key: string) {
    if (!key.trim()) return;
    const setValidation = provider === "anthropic" ? setAnthropicValidation : setOpenaiValidation;
    const setError = provider === "anthropic" ? setAnthropicError : setOpenaiError;
    setValidation("validating");
    setError("");
    try {
      const res = await fetch("/api/settings/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, api_key: key }),
      });
      const data = await res.json();
      if (data.valid) {
        setValidation("valid");
      } else {
        setValidation("invalid");
        setError(data.reason || "Invalid key");
      }
    } catch {
      setValidation("invalid");
      setError("Validation request failed");
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    try {
      const body: Record<string, string | null> = {
        name: profile.name,
        email: profile.email,
        agency_name: profile.agencyName,
        theme_mode: themeMode,
      };
      if (anthropicKey && anthropicValidation === "valid") body.anthropic_api_key = anthropicKey;
      if (openaiKey && openaiValidation === "valid") body.openai_api_key = openaiKey;

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      // Refresh settings
      const settingsRes = await fetch("/api/settings");
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setSettings(s);
      }
      setAnthropicKey("");
      setOpenaiKey("");
      setAnthropicValidation("idle");
      setOpenaiValidation("idle");
      // Apply theme live
      applyTheme(themeMode);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
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

  function applyTheme(mode: string) {
    document.documentElement.setAttribute("data-theme", mode);
  }

  function handleThemeChange(mode: string) {
    setThemeMode(mode);
    applyTheme(mode);
  }

  const tierConfig = TIERS[profile.subscriptionTier] || TIERS.starter;

  const inputClass =
    "w-full px-4 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--muted)]" />
      </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-30 bg-[var(--header-bg)] backdrop-blur-xl border-b border-[var(--border)]">
        <div className="px-4 sm:px-6 py-4">
          <h1 className="text-xl font-bold flex items-center gap-2 text-[var(--foreground)]">
            <Settings className="w-5 h-5 text-[var(--muted)]" /> Settings
          </h1>
          <p className="text-xs text-[var(--muted)]">Manage your account, API keys, and preferences</p>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-2xl space-y-6">
        {/* Profile */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2 text-[var(--foreground)]">
            <User className="w-4 h-4 text-[var(--accent)]" /> Profile
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1.5 block">Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                className={inputClass}
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1.5 block">Email</label>
              <div className="relative">
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                  className={inputClass + " pr-20"}
                  placeholder="you@example.com"
                />
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
              <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1.5 block">Agency Name</label>
              <input
                type="text"
                value={profile.agencyName}
                onChange={(e) => setProfile((p) => ({ ...p, agencyName: e.target.value }))}
                className={inputClass}
                placeholder="Your agency"
              />
            </div>
          </div>
        </div>

        {/* Subscription Plan */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2 text-[var(--foreground)]">
            <Crown className="w-4 h-4 text-amber-400" /> Subscription Plan
          </h3>
          <div className="flex items-center gap-3 mb-4">
            <div className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
              profile.subscriptionTier === "agency" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
              profile.subscriptionTier === "pro" ? "bg-[rgba(232,85,61,0.1)] text-[var(--accent)] border border-[rgba(232,85,61,0.2)]" :
              "bg-[var(--background)] text-[var(--muted)] border border-[var(--border)]"
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
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2 text-[var(--foreground)]">
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
                  : "bg-zinc-500/10 text-zinc-500 border border-zinc-500/20"
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
              <div>
                <div className="relative">
                  <input
                    type={showAnthropicKey ? "text" : "password"}
                    placeholder="sk-ant-api03-..."
                    value={anthropicKey}
                    onChange={(e) => { setAnthropicKey(e.target.value); setAnthropicValidation("idle"); setAnthropicError(""); }}
                    className={inputClass + " pr-20"}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                      className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                    >
                      {showAnthropicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {anthropicKey && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => validateKey("anthropic", anthropicKey)}
                      disabled={anthropicValidation === "validating"}
                      className="px-3 py-1.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-medium hover:bg-[var(--accent)]/20 transition-colors disabled:opacity-50"
                    >
                      {anthropicValidation === "validating" ? (
                        <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Validating...</span>
                      ) : "Validate Key"}
                    </button>
                    {anthropicValidation === "valid" && (
                      <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle className="w-3 h-3" /> Valid</span>
                    )}
                    {anthropicValidation === "invalid" && (
                      <span className="flex items-center gap-1 text-xs text-red-400"><AlertCircle className="w-3 h-3" /> {anthropicError}</span>
                    )}
                  </div>
                )}
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
                  : "bg-zinc-500/10 text-zinc-500 border border-zinc-500/20"
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
              <div>
                <div className="relative">
                  <input
                    type={showOpenaiKey ? "text" : "password"}
                    placeholder="sk-..."
                    value={openaiKey}
                    onChange={(e) => { setOpenaiKey(e.target.value); setOpenaiValidation("idle"); setOpenaiError(""); }}
                    className={inputClass + " pr-20"}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                      className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                    >
                      {showOpenaiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {openaiKey && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => validateKey("openai", openaiKey)}
                      disabled={openaiValidation === "validating"}
                      className="px-3 py-1.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-medium hover:bg-[var(--accent)]/20 transition-colors disabled:opacity-50"
                    >
                      {openaiValidation === "validating" ? (
                        <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Validating...</span>
                      ) : "Validate Key"}
                    </button>
                    {openaiValidation === "valid" && (
                      <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle className="w-3 h-3" /> Valid</span>
                    )}
                    {openaiValidation === "invalid" && (
                      <span className="flex items-center gap-1 text-xs text-red-400"><AlertCircle className="w-3 h-3" /> {openaiError}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="text-[10px] text-[var(--muted)] mt-3 flex items-start gap-1.5">
            <Shield className="w-3 h-3 mt-0.5 shrink-0" />
            Keys are encrypted at rest and never exposed in the frontend. Validate before saving to confirm your key works.
          </p>
        </div>

        {/* Notifications */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2 text-[var(--foreground)]">
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
                  <p className="text-sm text-[var(--foreground)]">{item.label}</p>
                  <p className="text-xs text-[var(--muted)]">{item.desc}</p>
                </div>
                <button
                  onClick={() => setNotifications((n) => ({ ...n, [item.key]: !n[item.key] }))}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    notifications[item.key] ? "bg-[var(--accent)]" : "bg-[var(--border)]"
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

        {/* Appearance — Dark/Light Mode Only */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2 text-[var(--foreground)]">
            <Palette className="w-4 h-4 text-purple-400" /> Appearance
          </h3>
          <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-3 block">
            Theme
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => handleThemeChange("dark")}
              className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                themeMode === "dark"
                  ? "bg-[rgba(232,85,61,0.1)] border border-[rgba(232,85,61,0.3)] text-[var(--accent)]"
                  : "bg-[var(--background)] border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/30"
              }`}
            >
              <Moon className="w-4 h-4" /> Dark Mode
            </button>
            <button
              onClick={() => handleThemeChange("light")}
              className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                themeMode === "light"
                  ? "bg-[rgba(232,85,61,0.1)] border border-[rgba(232,85,61,0.3)] text-[var(--accent)]"
                  : "bg-[var(--background)] border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/30"
              }`}
            >
              <Sun className="w-4 h-4" /> Light Mode
            </button>
          </div>
        </div>

        {/* Save */}
        {saveError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {saveError}
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
        >
          {saved ? (
            <>
              <CheckCircle className="w-4 h-4" /> Saved Successfully!
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
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2 text-[var(--foreground)]">
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
