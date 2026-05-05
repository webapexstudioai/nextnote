"use client";

import { useState, useEffect, useRef } from "react";
import {
  Settings, User, Bell, Palette, Save, CheckCircle, Loader2,
  Crown, Sun, Moon, AlertCircle,
  Shield, Camera, ArrowUpRight, ArrowDownRight, Phone, Coins, Link2, Calendar, Compass,
} from "lucide-react";
import { TIERS } from "@/lib/subscriptions";
import type { SubscriptionTier } from "@/lib/subscriptions";
import { startGuidedTour } from "@/components/dashboard/GuidedTour";
import { PersonalPhoneCard } from "@/components/settings/PersonalPhoneCard";

type SettingsTab = "profile" | "subscription" | "credits" | "caller_id" | "integrations" | "appearance" | "notifications";

interface CallerId {
  id: string;
  phone_number: string;
  friendly_name: string | null;
  verified: boolean;
  verified_at: string | null;
}

interface UserProfile {
  name: string;
  email: string;
  agencyName: string;
  emailVerified: boolean;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: string;
  profileImageUrl: string | null;
}

interface SettingsData {
  preferred_provider: string;
  theme_mode: string;
}

const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "subscription", label: "Subscription", icon: Crown },
  { id: "credits", label: "Credits", icon: Coins },
  { id: "caller_id", label: "Caller ID", icon: Phone },
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [tabVisible, setTabVisible] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<UserProfile>({
    name: "", email: "", agencyName: "",
    emailVerified: false, subscriptionTier: "starter", subscriptionStatus: "active",
    profileImageUrl: null,
  });
  const [notifications, setNotifications] = useState({
    newLead: true,
    appointmentReminder: true,
    weeklyDigest: false,
  });
  const [settings, setSettings] = useState<SettingsData>({
    preferred_provider: "anthropic",
    theme_mode: "dark",
  });
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  // Theme state
  const [themeMode, setThemeMode] = useState("dark");
  const [accentColor, setAccentColor] = useState("#e8553d");
  const [bgIntensity, setBgIntensity] = useState<"minimal" | "balanced" | "cinematic">("balanced");

  // Avatar state
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscription change state
  const [changingPlan, setChangingPlan] = useState(false);
  const [planError, setPlanError] = useState("");
  const [planSuccess, setPlanSuccess] = useState("");
  const [subInfo, setSubInfo] = useState<{ cancelAtPeriodEnd: boolean; currentPeriodEnd: number | null } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Caller ID state (for voicemail drops)
  const [callerIds, setCallerIds] = useState<CallerId[]>([]);
  const [callerIdsLoading, setCallerIdsLoading] = useState(false);
  const [callerIdError, setCallerIdError] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [startingVerification, setStartingVerification] = useState(false);
  const [pendingVerification, setPendingVerification] = useState<{ phone: string; code: string } | null>(null);
  const [checkingVerification, setCheckingVerification] = useState(false);

  async function loadCallerIds() {
    setCallerIdsLoading(true);
    try {
      const res = await fetch("/api/voicemail/caller-ids");
      if (res.ok) {
        const data = await res.json();
        setCallerIds(data.caller_ids || []);
      }
    } finally {
      setCallerIdsLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "caller_id") loadCallerIds();
  }, [activeTab]);


  async function loadSubscription() {
    try {
      const res = await fetch("/api/stripe/subscription");
      if (!res.ok) return;
      const data = await res.json();
      if (data.subscription) {
        setSubInfo({
          cancelAtPeriodEnd: data.subscription.cancelAtPeriodEnd,
          currentPeriodEnd: data.subscription.currentPeriodEnd ?? null,
        });
      } else {
        setSubInfo(null);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (activeTab === "subscription") loadSubscription();
  }, [activeTab]);

  async function handleCancelSubscription() {
    setCancelling(true);
    setPlanError("");
    setPlanSuccess("");
    try {
      const res = await fetch("/api/stripe/cancel-subscription", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setPlanError(data.error || "Failed to cancel subscription");
        return;
      }
      setSubInfo({
        cancelAtPeriodEnd: true,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
      });
      setShowCancelConfirm(false);
      const endDate = data.currentPeriodEnd
        ? new Date(data.currentPeriodEnd * 1000).toLocaleDateString()
        : "the end of the billing period";
      setPlanSuccess(`Subscription cancelled. You'll keep access until ${endDate}.`);
      setTimeout(() => setPlanSuccess(""), 8000);
    } catch {
      setPlanError("Network error. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  async function handleStartVerification() {
    setCallerIdError("");
    setStartingVerification(true);
    try {
      const res = await fetch("/api/voicemail/caller-ids/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: newPhone, friendly_name: newLabel || "My Phone" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCallerIdError(data.error || "Failed to start verification");
        return;
      }
      setPendingVerification({ phone: data.phone_number, code: data.validation_code });
    } catch {
      setCallerIdError("Network error");
    } finally {
      setStartingVerification(false);
    }
  }

  async function handleCheckVerification() {
    if (!pendingVerification) return;
    setCallerIdError("");
    setCheckingVerification(true);
    try {
      const res = await fetch("/api/voicemail/caller-ids/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: pendingVerification.phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCallerIdError(data.error || "Check failed");
        return;
      }
      if (data.verified) {
        setPendingVerification(null);
        setNewPhone("");
        setNewLabel("");
        await loadCallerIds();
      } else {
        setCallerIdError(data.message || "Not verified yet — answer the call and enter the code.");
      }
    } catch {
      setCallerIdError("Network error");
    } finally {
      setCheckingVerification(false);
    }
  }

  async function handleRemoveCallerId(phone: string) {
    try {
      await fetch("/api/voicemail/caller-ids", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone }),
      });
      await loadCallerIds();
    } catch {
      setCallerIdError("Failed to remove");
    }
  }

  // Google Calendar integration state
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; email: string } | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);

  async function loadGoogleStatus() {
    setGoogleLoading(true);
    try {
      const res = await fetch("/api/auth/status");
      if (res.ok) {
        const data = await res.json();
        setGoogleStatus({ connected: !!data.connected, email: data.email || "" });
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "integrations") loadGoogleStatus();
  }, [activeTab]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      setActiveTab("integrations");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    const deepLinkTab = params.get("tab") as SettingsTab | null;
    const validTabs: SettingsTab[] = ["profile", "subscription", "credits", "caller_id", "integrations", "appearance", "notifications"];
    if (deepLinkTab && validTabs.includes(deepLinkTab)) {
      setActiveTab(deepLinkTab);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  function handleConnectGoogle() {
    const returnTo = "/dashboard/settings?connected=true";
    window.location.href = `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
  }

  async function handleDisconnectGoogle() {
    setDisconnectingGoogle(true);
    try {
      await fetch("/api/auth/disconnect", { method: "POST" });
      await loadGoogleStatus();
    } finally {
      setDisconnectingGoogle(false);
    }
  }

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
            profileImageUrl: meData.user.profileImageUrl || null,
          });
        }
        if (settingsRes.ok) {
          const s = await settingsRes.json();
          setSettings(s);
          setThemeMode(s.theme_mode || "dark");
          if (s.accent_color) setAccentColor(s.accent_color);
          if (s.background_intensity === "minimal" || s.background_intensity === "cinematic" || s.background_intensity === "balanced") {
            setBgIntensity(s.background_intensity);
          }
        }
        const balRes = await fetch("/api/credits/balance");
        if (balRes.ok) {
          const b = await balRes.json();
          setCreditBalance(b.balance ?? 0);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }
    load();

    // Check for upgrade success from redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "true") {
      setPlanSuccess("Plan updated successfully!");
      setActiveTab("subscription");
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(() => setPlanSuccess(""), 5000);
    }
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    try {
      const body: Record<string, string | null> = {
        name: profile.name,
        email: profile.email,
        agency_name: profile.agencyName,
        theme_mode: themeMode,
        accent_color: accentColor,
        background_intensity: bgIntensity,
      };

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }

      try {
        const preview = {
          name: profile.name,
          agencyName: profile.agencyName,
          subscriptionTier: profile.subscriptionTier,
          profileImageUrl: profile.profileImageUrl,
        };
        window.localStorage.setItem("nextnote_profile_preview", JSON.stringify(preview));
        window.dispatchEvent(new Event("nextnote:profile-updated"));
      } catch {}

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      const settingsRes = await fetch("/api/settings");
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setSettings(s);
      }
      applyTheme(themeMode);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function applyTheme(mode: string) {
    document.documentElement.setAttribute("data-theme", mode);
    try { window.localStorage.setItem("nextnote_theme", mode); } catch {}
  }

  function handleThemeChange(mode: string) {
    setThemeMode(mode);
    applyTheme(mode);
  }

  function applyAccentColor(hex: string) {
    const clean = /^#?([0-9a-fA-F]{6})$/.exec(hex)?.[1];
    if (!clean) return;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    const lighten = (c: number) => Math.min(255, Math.round(c + (255 - c) * 0.15));
    const hover = `#${[lighten(r), lighten(g), lighten(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
    const root = document.documentElement;
    root.style.setProperty("--accent", `#${clean}`);
    root.style.setProperty("--accent-hover", hover);
    root.style.setProperty("--accent-rgb", `${r}, ${g}, ${b}`);
    try { window.localStorage.setItem("nextnote_accent", `#${clean}`); } catch {}
  }

  function handleAccentChange(hex: string) {
    setAccentColor(hex);
    applyAccentColor(hex);
  }

  function handleBgIntensityChange(value: "minimal" | "balanced" | "cinematic") {
    setBgIntensity(value);
    document.documentElement.setAttribute("data-bg-intensity", value);
    try { window.localStorage.setItem("nextnote_bg_intensity", value); } catch {}
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/settings/avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        setProfile((p) => ({ ...p, profileImageUrl: data.url }));
        try {
          const preview = {
            name: profile.name,
            agencyName: profile.agencyName,
            subscriptionTier: profile.subscriptionTier,
            profileImageUrl: data.url,
          };
          window.localStorage.setItem("nextnote_profile_preview", JSON.stringify(preview));
          window.dispatchEvent(new Event("nextnote:profile-updated"));
        } catch {}
      } else {
        setSaveError(data.error || "Avatar upload failed");
      }
    } catch {
      setSaveError("Avatar upload failed");
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    try {
      const res = await fetch("/api/settings/avatar", { method: "DELETE" });
      if (res.ok) {
        setProfile((p) => ({ ...p, profileImageUrl: null }));
        try {
          const preview = {
            name: profile.name,
            agencyName: profile.agencyName,
            subscriptionTier: profile.subscriptionTier,
            profileImageUrl: null,
          };
          window.localStorage.setItem("nextnote_profile_preview", JSON.stringify(preview));
          window.dispatchEvent(new Event("nextnote:profile-updated"));
        } catch {}
      }
    } catch {
      setSaveError("Failed to remove avatar");
    }
  }

  async function handleChangePlan(newPlan: SubscriptionTier) {
    if (newPlan === profile.subscriptionTier) return;
    setChangingPlan(true);
    setPlanError("");
    setPlanSuccess("");
    try {
      const res = await fetch("/api/stripe/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: newPlan }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPlanError(data.error || "Failed to change plan");
        return;
      }
      if (data.url) {
        // Redirect to Stripe Checkout for new subscription
        window.location.href = data.url;
        return;
      }
      if (data.success) {
        setProfile((p) => ({ ...p, subscriptionTier: newPlan, subscriptionStatus: "active" }));
        setPlanSuccess(`Successfully ${newPlan === "pro" ? "upgraded" : "switched"} to ${TIERS[newPlan].name}!`);
        try {
          const preview = {
            name: profile.name,
            agencyName: profile.agencyName,
            subscriptionTier: newPlan,
            profileImageUrl: profile.profileImageUrl,
          };
          window.localStorage.setItem("nextnote_profile_preview", JSON.stringify(preview));
          window.dispatchEvent(new Event("nextnote:profile-updated"));
        } catch {}
        setTimeout(() => setPlanSuccess(""), 5000);
      }
    } catch {
      setPlanError("Network error. Please try again.");
    } finally {
      setChangingPlan(false);
    }
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
    <div className="min-h-full">
      <header className="sticky top-0 z-30 liquid-glass-strong border-b border-white/5">
        <div className="px-4 sm:px-6 py-4">
          <h1 className="text-xl font-bold flex items-center gap-2 text-[var(--foreground)]">
            <Settings className="w-5 h-5 text-[var(--accent)]" /> Settings
          </h1>
          <p className="text-xs text-[var(--muted)]">Manage your account, subscriptions, and preferences</p>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-4 p-4 sm:p-6">
        {/* Settings Navigation */}
        <nav className="liquid-glass rounded-2xl p-2 lg:w-56 shrink-0 lg:self-start lg:sticky lg:top-24">
          <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === activeTab) return;
                    setTabVisible(false);
                    setTimeout(() => { setActiveTab(tab.id); setTabVisible(true); }, 200);
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30 shadow-[0_0_24px_rgba(232,85,61,0.18)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/[0.04] border border-transparent"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Settings Content */}
        <div className="flex-1 liquid-glass rounded-2xl p-4 sm:p-6 max-w-2xl">
          {/* Global save error */}
          {saveError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" /> {saveError}
              <button onClick={() => setSaveError("")} className="ml-auto text-red-400/60 hover:text-red-400">&times;</button>
            </div>
          )}

          <div className={`transition-all duration-200 ease-out ${ tabVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2" }`}>
          {/* ─── Profile Tab ─── */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div className="rounded-xl liquid-glass p-5">
                <h3 className="text-sm font-medium mb-5 flex items-center gap-2 text-[var(--foreground)]">
                  <User className="w-4 h-4 text-[var(--accent)]" /> Profile Information
                </h3>

                {/* Avatar */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative group">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-[#e8553d] to-[#ff8a6a] flex items-center justify-center shrink-0">
                      {profile.profileImageUrl ? (
                        <img src={profile.profileImageUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold text-xl">{profile.name.charAt(0).toUpperCase() || "U"}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={avatarUploading}
                      className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      {avatarUploading ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      ) : (
                        <Camera className="w-5 h-5 text-white" />
                      )}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">Profile Photo</p>
                    <p className="text-xs text-[var(--muted)] mb-2">JPG, PNG, WebP, or GIF. Max 2MB.</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarUploading}
                        className="px-3 py-1 rounded-md text-xs font-medium bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)] transition-colors disabled:opacity-50"
                      >
                        {avatarUploading ? "Uploading..." : "Upload"}
                      </button>
                      {profile.profileImageUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="px-3 py-1 rounded-md text-xs font-medium border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

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

              {/* Save button for profile */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
              >
                {saved ? (
                  <><CheckCircle className="w-4 h-4" /> Saved!</>
                ) : saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4" /> Save Profile</>
                )}
              </button>

              {/* Replay tour */}
              <div className="rounded-xl liquid-glass p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-medium flex items-center gap-2 text-[var(--foreground)]">
                      <Compass className="w-4 h-4 text-[var(--accent)]" /> Guided tour
                    </h3>
                    <p className="text-xs text-[var(--muted)] mt-1 max-w-md">
                      Replay the 30-second walkthrough of NextNote&apos;s dashboard — Prospects, Sources, Agents, and more.
                    </p>
                  </div>
                  <button
                    onClick={startGuidedTour}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-xs font-medium transition-colors"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    Take the tour
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── Subscription Tab ─── */}
          {activeTab === "subscription" && (
            <div className="space-y-6">
              {/* Current Plan */}
              <div className="rounded-xl liquid-glass p-5">
                <h3 className="text-sm font-medium mb-4 flex items-center gap-2 text-[var(--foreground)]">
                  <Crown className="w-4 h-4 text-amber-400" /> Current Plan
                </h3>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                    profile.subscriptionTier === "pro"
                      ? "bg-[rgba(232,85,61,0.1)] text-[var(--accent)] border border-[rgba(232,85,61,0.2)]"
                      : "bg-[var(--background)] text-[var(--muted)] border border-[var(--border)]"
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
              </div>

              {/* Plan Options */}
              <div className="rounded-xl liquid-glass p-5">
                <h3 className="text-sm font-medium mb-4 text-[var(--foreground)]">Change Plan</h3>

                {planError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {planError}
                  </div>
                )}
                {planSuccess && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm mb-4">
                    <CheckCircle className="w-4 h-4 shrink-0" /> {planSuccess}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(["starter", "pro"] as SubscriptionTier[]).map((tier) => {
                    const t = TIERS[tier];
                    const isCurrent = profile.subscriptionTier === tier;
                    const isUpgrade = tier === "pro" && profile.subscriptionTier === "starter";
                    return (
                      <div
                        key={tier}
                        className={`rounded-xl border p-4 transition-all ${
                          isCurrent
                            ? "border-[var(--accent)] bg-[rgba(232,85,61,0.05)]"
                            : "border-[var(--border)] bg-[var(--background)] hover:border-[var(--accent)]/30"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-[var(--foreground)]">{t.name}</h4>
                          {isCurrent && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--muted)] mb-2">{t.tagline}</p>
                        <div className="text-lg font-bold text-[var(--foreground)] mb-3">
                          ${tier === "starter" ? "29" : "79"}<span className="text-xs font-normal text-[var(--muted)]">/mo</span>
                        </div>
                        <div className="space-y-1.5 mb-4">
                          {t.features.slice(0, 4).map((f) => (
                            <div key={f} className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                              <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                              {f}
                            </div>
                          ))}
                          {t.features.length > 4 && (
                            <p className="text-[11px] text-[var(--muted)]/60">+{t.features.length - 4} more</p>
                          )}
                        </div>
                        {isCurrent ? (
                          <div className="w-full py-2 rounded-lg text-xs font-medium text-center text-[var(--muted)] bg-[var(--background)] border border-[var(--border)]">
                            Active Plan
                          </div>
                        ) : (
                          <button
                            onClick={() => handleChangePlan(tier)}
                            disabled={changingPlan}
                            className={`w-full py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 ${
                              isUpgrade
                                ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
                                : "bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)]/30"
                            }`}
                          >
                            {changingPlan ? (
                              <><Loader2 className="w-3 h-3 animate-spin" /> Processing...</>
                            ) : isUpgrade ? (
                              <><ArrowUpRight className="w-3 h-3" /> Upgrade to {t.name}</>
                            ) : (
                              <><ArrowDownRight className="w-3 h-3" /> Switch to {t.name}</>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="text-[10px] text-[var(--muted)] mt-4">
                  Changes are processed through Stripe. Upgrades are prorated. Downgrades take effect at the next billing cycle.
                </p>
              </div>

              {/* Feature Access */}
              <div className="rounded-xl liquid-glass p-5">
                <h3 className="text-sm font-medium mb-3 text-[var(--foreground)]">Feature Access</h3>
                <div className="space-y-2 text-xs text-[var(--muted)]">
                  {[
                    { label: "AI Summaries & Insights", check: tierConfig.limits.aiSummariesPerMonth > 0, detail: tierConfig.limits.aiSummariesPerMonth > 0 ? `${tierConfig.limits.aiSummariesPerMonth}/mo` : "Pro" },
                    { label: "Spreadsheet Import", check: tierConfig.limits.spreadsheetImport, detail: tierConfig.limits.spreadsheetImport ? "Included" : "Pro" },
                    { label: "Google Calendar", check: tierConfig.limits.googleCalendar, detail: tierConfig.limits.googleCalendar ? "Included" : "Pro" },
                    { label: "Bonus AI Credits", check: true, detail: `${tierConfig.bonusCredits} credits` },
                    { label: "Team Members", check: true, detail: tierConfig.limits.teamMembers === 1 ? "Solo" : `Up to ${tierConfig.limits.teamMembers}` },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--background)]">
                      <span>{item.label}</span>
                      <span className={item.check ? "text-emerald-400" : "text-zinc-600"}>{item.detail}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cancel Subscription */}
              {subInfo && (
                <div className="rounded-xl liquid-glass p-5 border border-red-500/10">
                  <h3 className="text-sm font-medium mb-2 text-[var(--foreground)]">Cancel Subscription</h3>
                  {subInfo.cancelAtPeriodEnd ? (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Cancellation scheduled</p>
                        <p className="text-xs text-amber-400/80 mt-1">
                          You&apos;ll keep full access until{" "}
                          {subInfo.currentPeriodEnd
                            ? new Date(subInfo.currentPeriodEnd * 1000).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })
                            : "the end of the current billing period"}
                          . To resume, you&apos;ll need to subscribe again after that date.
                        </p>
                      </div>
                    </div>
                  ) : showCancelConfirm ? (
                    <div className="space-y-3">
                      <p className="text-xs text-[var(--muted)]">
                        Are you sure? Your subscription will stop renewing, but you&apos;ll keep access until your current billing period ends. You&apos;ll have to pay again if you change your mind.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCancelSubscription}
                          disabled={cancelling}
                          className="px-4 py-2 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/15 disabled:opacity-50 flex items-center gap-2"
                        >
                          {cancelling ? (
                            <><Loader2 className="w-3 h-3 animate-spin" /> Cancelling...</>
                          ) : (
                            "Yes, cancel my subscription"
                          )}
                        </button>
                        <button
                          onClick={() => setShowCancelConfirm(false)}
                          disabled={cancelling}
                          className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)]/30"
                        >
                          Keep subscription
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-[var(--muted)] mb-3">
                        You&apos;ll keep full access until the end of your current billing period. To resume afterwards, you&apos;ll need to subscribe again.
                      </p>
                      <button
                        onClick={() => setShowCancelConfirm(true)}
                        className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--background)] border border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        Cancel subscription
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── Credits Tab ─── */}
          {activeTab === "credits" && (
            <div className="space-y-6">
              {/* Balance Card */}
              <div className="rounded-xl liquid-glass p-5 overflow-hidden relative">
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(232,85,61,0.12),transparent_40%)]" />
                <div className="relative z-10">
                  <h3 className="text-sm font-medium flex items-center gap-2 text-[var(--foreground)] mb-4">
                    <Coins className="w-4 h-4 text-[var(--accent)]" /> Credit Balance
                  </h3>
                  <div className="rounded-2xl border border-[rgba(232,85,61,0.18)] bg-[linear-gradient(135deg,rgba(232,85,61,0.12),rgba(255,255,255,0.03))] p-6 text-center">
                    <p className="text-5xl font-bold text-[var(--foreground)]">
                      {creditBalance !== null ? creditBalance.toLocaleString() : "..."}
                    </p>
                    <p className="text-sm text-[var(--muted)] mt-1">credits remaining</p>
                  </div>
                </div>
              </div>

              {/* Credit Rates */}
              <div className="rounded-xl liquid-glass p-5">
                <h3 className="text-sm font-medium mb-3 text-[var(--foreground)]">Credit Usage Rates</h3>
                <div className="space-y-2 text-xs">
                  {[
                    { label: "AI Website (Standard)", cost: "50 credits" },
                    { label: "AI Website (White-label)", cost: "200 credits" },
                    { label: "AI Receptionist Builder", cost: "25 credits" },
                    { label: "AI Pipeline Insights", cost: "15 credits" },
                    { label: "Spreadsheet AI Import", cost: "5 credits" },
                    { label: "Note Summarization", cost: "5 credits" },
                    { label: "Agent Test Chat (per msg)", cost: "3 credits" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[var(--background)]">
                      <span className="text-[var(--muted)]">{item.label}</span>
                      <span className="text-[var(--foreground)] font-medium">{item.cost}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Buy Credits CTA */}
              <div className="rounded-xl liquid-glass p-5">
                <h3 className="text-sm font-medium mb-2 text-[var(--foreground)]">Need more credits?</h3>
                <p className="text-xs text-[var(--muted)] mb-4">
                  Top up credits any time at $0.01 each. They power voice calls, AI agents, and voicemail drops.
                </p>
                <a
                  href="/dashboard/billing"
                  className="block text-center w-full py-3 rounded-xl bg-gradient-to-r from-[#e8553d] to-[#d44429] text-white text-sm font-semibold shadow-lg shadow-[#e8553d]/25 hover:shadow-xl hover:shadow-[#e8553d]/35 hover:-translate-y-0.5 transition-all duration-300"
                >
                  Buy Credits
                </a>
              </div>
            </div>
          )}

          {/* ─── Caller ID Tab ─── */}
          {activeTab === "caller_id" && (
            <div className="space-y-6">
              <div className="rounded-xl liquid-glass p-5">
                <h3 className="text-sm font-medium mb-1 flex items-center gap-2 text-[var(--foreground)]">
                  <Phone className="w-4 h-4 text-[var(--accent)]" /> Verified Caller IDs
                </h3>
                <p className="text-xs text-[var(--muted)] mb-4">
                  Verify your personal phone number so voicemail drops appear to come from you. We'll call the number with a 6-digit code — enter it on your keypad to verify.
                </p>

                {callerIdError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {callerIdError}
                    <button onClick={() => setCallerIdError("")} className="ml-auto text-red-400/60 hover:text-red-400">&times;</button>
                  </div>
                )}

                {pendingVerification ? (
                  <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-5 space-y-4">
                    <div>
                      <p className="text-xs text-[var(--muted)] uppercase tracking-wider mb-1">Verifying</p>
                      <p className="text-sm font-medium text-[var(--foreground)]">{pendingVerification.phone}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2">Enter this code on your phone</p>
                      <div className="text-4xl font-bold font-mono tracking-[0.5em] text-[var(--accent)] text-center py-4 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                        {pendingVerification.code}
                      </div>
                      <p className="text-[11px] text-[var(--muted)] mt-2 text-center">
                        Calling now. Answer the call and enter these digits on your keypad.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCheckVerification}
                        disabled={checkingVerification}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
                      >
                        {checkingVerification ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Checking...</>
                        ) : (
                          <><CheckCircle className="w-4 h-4" /> I&apos;ve entered the code</>
                        )}
                      </button>
                      <button
                        onClick={() => setPendingVerification(null)}
                        className="px-4 py-2.5 rounded-lg border border-[var(--border)] text-[var(--muted)] text-sm hover:text-[var(--foreground)] hover:bg-white/[0.04] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 mb-4">
                    <div className="space-y-2">
                      <input
                        type="tel"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="+1 555 123 4567"
                        className={inputClass}
                      />
                      <input
                        type="text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="Label (e.g. My Cell)"
                        className={inputClass}
                      />
                    </div>
                    <button
                      onClick={handleStartVerification}
                      disabled={startingVerification || !newPhone.trim()}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 h-fit"
                    >
                      {startingVerification ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Calling...</>
                      ) : (
                        <><Phone className="w-4 h-4" /> Verify Number</>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-xl liquid-glass p-5">
                <h3 className="text-sm font-medium mb-3 text-[var(--foreground)]">Your Numbers</h3>
                {callerIdsLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--muted)]" />
                  </div>
                ) : callerIds.length === 0 ? (
                  <p className="text-xs text-[var(--muted)] text-center py-6">
                    No verified numbers yet. Add one above to start sending voicemail drops.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {callerIds.map((c) => (
                      <div key={c.id} className="flex items-center justify-between px-3 py-3 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                        <div className="flex items-center gap-3 min-w-0">
                          <Phone className="w-4 h-4 text-[var(--muted)] shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--foreground)] truncate">{c.phone_number}</p>
                            {c.friendly_name && (
                              <p className="text-[11px] text-[var(--muted)] truncate">{c.friendly_name}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            c.verified
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}>
                            {c.verified ? "Verified" : "Pending"}
                          </span>
                          <button
                            onClick={() => handleRemoveCallerId(c.phone_number)}
                            className="text-xs px-2 py-1 rounded-md border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Integrations Tab ─── */}
          {activeTab === "integrations" && (
            <div className="space-y-6">
              <div className="rounded-xl liquid-glass p-5">
                <h3 className="text-sm font-medium mb-1 flex items-center gap-2 text-[var(--foreground)]">
                  <Link2 className="w-4 h-4 text-[var(--accent)]" /> Integrations
                </h3>
                <p className="text-xs text-[var(--muted)] mb-5">
                  Connect third-party services to automate your workflow.
                </p>

                {/* Google Calendar card */}
                <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/15 to-emerald-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-[var(--foreground)]">Google Calendar</h4>
                        {googleStatus?.connected && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Connected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--muted)] mt-1">
                        Auto-book appointments with Google Meet links, send invites to prospects, and keep your calendar in sync.
                      </p>
                      {googleStatus?.connected && googleStatus.email && (
                        <p className="text-[11px] text-[var(--muted)] mt-2">
                          Signed in as <span className="text-[var(--foreground)] font-medium">{googleStatus.email}</span>
                        </p>
                      )}
                      <div className="mt-4">
                        {googleLoading ? (
                          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
                          </div>
                        ) : googleStatus?.connected ? (
                          <button
                            onClick={handleDisconnectGoogle}
                            disabled={disconnectingGoogle}
                            className="px-4 py-2 rounded-lg border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50 flex items-center gap-2"
                          >
                            {disconnectingGoogle ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Disconnecting...</>
                            ) : (
                              "Disconnect"
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={handleConnectGoogle}
                            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-2"
                          >
                            <Link2 className="w-3.5 h-3.5" /> Connect Google Calendar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-[var(--muted)] mt-4">
                  More integrations coming soon — Slack, Zapier, and HubSpot.
                </p>
              </div>
            </div>
          )}

          {/* ─── Appearance Tab ─── */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              {/* Theme */}
              <div className="rounded-xl liquid-glass p-5">
                <h3 className="text-sm font-medium mb-4 flex items-center gap-2 text-[var(--foreground)]">
                  <Palette className="w-4 h-4 text-[var(--accent)]" /> Theme
                </h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleThemeChange("dark")}
                    className={`flex-1 px-4 py-4 rounded-lg text-sm font-medium transition-all flex flex-col items-center gap-2 ${
                      themeMode === "dark"
                        ? "bg-[var(--accent)]/10 border-2 border-[var(--accent)]/40 text-[var(--accent)]"
                        : "bg-[var(--background)] border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/30"
                    }`}
                  >
                    <Moon className="w-5 h-5" />
                    Dark Mode
                  </button>
                  <button
                    onClick={() => handleThemeChange("light")}
                    className={`flex-1 px-4 py-4 rounded-lg text-sm font-medium transition-all flex flex-col items-center gap-2 ${
                      themeMode === "light"
                        ? "bg-[var(--accent)]/10 border-2 border-[var(--accent)]/40 text-[var(--accent)]"
                        : "bg-[var(--background)] border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/30"
                    }`}
                  >
                    <Sun className="w-5 h-5" />
                    Light Mode
                  </button>
                </div>
              </div>

              {/* Accent color */}
              <div className="rounded-xl liquid-glass p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-medium flex items-center gap-2 text-[var(--foreground)]">
                    <span className="w-3.5 h-3.5 rounded-full" style={{ background: accentColor }} /> Accent color
                  </h3>
                  <p className="text-[11px] text-[var(--muted)] mt-1">Recolors buttons, highlights, and the background wash. Previews live.</p>
                </div>
                <div className="grid grid-cols-6 gap-2 mb-4">
                  {[
                    { name: "Ember", hex: "#e8553d" },
                    { name: "Indigo", hex: "#6366f1" },
                    { name: "Emerald", hex: "#10b981" },
                    { name: "Violet", hex: "#a855f7" },
                    { name: "Amber", hex: "#f59e0b" },
                    { name: "Rose", hex: "#f43f5e" },
                  ].map((preset) => {
                    const active = accentColor.toLowerCase() === preset.hex.toLowerCase();
                    return (
                      <button
                        key={preset.hex}
                        onClick={() => handleAccentChange(preset.hex)}
                        title={preset.name}
                        className={`relative aspect-square rounded-xl border-2 transition-all ${
                          active ? "border-[var(--foreground)] scale-105" : "border-transparent hover:scale-105"
                        }`}
                        style={{ background: preset.hex, boxShadow: active ? `0 0 24px ${preset.hex}66` : undefined }}
                      >
                        {active && <CheckCircle className="w-4 h-4 text-white absolute inset-0 m-auto" />}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-[var(--muted)] shrink-0">Custom hex</label>
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => handleAccentChange(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border border-[var(--border)]"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAccentColor(v);
                      if (/^#[0-9a-fA-F]{6}$/.test(v)) applyAccentColor(v);
                    }}
                    placeholder="#e8553d"
                    className="flex-1 px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm font-mono focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>
              </div>

              {/* Background intensity */}
              <div className="rounded-xl liquid-glass p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-[var(--foreground)]">Background intensity</h3>
                  <p className="text-[11px] text-[var(--muted)] mt-1">Controls how prominent the red wash and grain are on the dashboard.</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { id: "minimal", label: "Minimal", blurb: "Flat, zero grain" },
                    { id: "balanced", label: "Balanced", blurb: "Default wash" },
                    { id: "cinematic", label: "Cinematic", blurb: "Boosted + grain" },
                  ] as const).map((opt) => {
                    const active = bgIntensity === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleBgIntensityChange(opt.id)}
                        className={`rounded-xl p-3 text-left transition-all border-2 ${
                          active
                            ? "border-[var(--accent)]/50 bg-[var(--accent)]/[0.06]"
                            : "border-[var(--border)] bg-[var(--background)] hover:border-[var(--accent)]/30"
                        }`}
                      >
                        <div className={`h-14 rounded-lg mb-2 relative overflow-hidden border border-[var(--border)]`}>
                          <div className="absolute inset-0" style={{
                            background: opt.id === "minimal"
                              ? `linear-gradient(180deg, #0b0508, #050104)`
                              : opt.id === "cinematic"
                              ? `radial-gradient(ellipse at 20% 10%, ${accentColor}aa, transparent 70%), linear-gradient(135deg, #160509, #060104)`
                              : `radial-gradient(ellipse at 20% 10%, ${accentColor}66, transparent 70%), linear-gradient(135deg, #0c0307, #050104)`
                          }} />
                        </div>
                        <p className="text-xs font-semibold">{opt.label}</p>
                        <p className="text-[10px] text-[var(--muted)] mt-0.5">{opt.blurb}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
              >
                {saved ? (
                  <><CheckCircle className="w-4 h-4" /> Saved!</>
                ) : saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4" /> Save Appearance</>
                )}
              </button>
            </div>
          )}

          {/* ─── Notifications Tab ─── */}
          {activeTab === "notifications" && (
            <div className="space-y-6">
              <PersonalPhoneCard />

              <div className="rounded-xl liquid-glass p-5">
                <h3 className="text-sm font-medium mb-4 flex items-center gap-2 text-[var(--foreground)]">
                  <Bell className="w-4 h-4 text-amber-400" /> Notification Preferences
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

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
              >
                {saved ? (
                  <><CheckCircle className="w-4 h-4" /> Saved!</>
                ) : saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4" /> Save Notifications</>
                )}
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
