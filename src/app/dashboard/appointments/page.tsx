"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Calendar, Clock, User, Briefcase, CheckCircle, Video, Mail, Sparkles, Loader2,
  FileText, Save, ChevronLeft, ChevronRight, List, Grid3X3, XCircle, RefreshCw, UserX, BarChart3,
} from "lucide-react";
import { useProspects } from "@/context/ProspectsContext";
import { AppointmentRecord, AppointmentDuration, AppointmentOutcome, CancelReason, Prospect } from "@/types";

const durationLabels: Record<AppointmentDuration, string> = { 15: "15m", 30: "30m", 45: "45m", 60: "1hr", 90: "1.5hr" };
const durations: AppointmentDuration[] = [15, 30, 45, 60, 90];
const cancelReasons: CancelReason[] = ["Changed mind", "Not a fit", "No response", "Other"];

const outcomeBadge: Record<AppointmentOutcome, { label: string; icon: string; cls: string }> = {
  pending: { label: "Pending", icon: "", cls: "bg-amber-500/15 text-amber-400" },
  completed: { label: "Completed", icon: "\u2713", cls: "bg-emerald-500/15 text-emerald-400" },
  "no-show": { label: "No-show", icon: "\u2717", cls: "bg-rose-500/15 text-rose-400" },
  rescheduled: { label: "Rescheduled", icon: "\u21bb", cls: "bg-blue-500/15 text-blue-400" },
  cancelled: { label: "Cancelled", icon: "\u2715", cls: "bg-zinc-500/15 text-zinc-400" },
};

interface FlatAppointment {
  prospect: Prospect;
  appointment: AppointmentRecord;
}

export default function AppointmentsPage() {
  const { prospects, updateAppointmentOutcome, rescheduleAppointment, bookAppointment, googleConnected, setGoogleConnected, updateMeetingNotes } = useProspects();
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  // View mode
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");

  // Calendar state
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Notes
  const [activeNotesId, setActiveNotesId] = useState<string | null>(null);
  const [notesInput, setNotesInput] = useState("");
  const [summarizing, setSummarizing] = useState(false);

  // Cancel flow
  const [cancelTarget, setCancelTarget] = useState<{ prospectId: string; apptId: string } | null>(null);
  const [cancelReason, setCancelReason] = useState<CancelReason>("Changed mind");

  // Follow-up flow
  const [followUpTarget, setFollowUpTarget] = useState<{ prospectId: string; prospect: Prospect } | null>(null);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("10:00");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [followUpDuration, setFollowUpDuration] = useState<AppointmentDuration>(30);

  // Reschedule flow
  const [rescheduleTarget, setRescheduleTarget] = useState<{ prospectId: string; apptId: string; duration: AppointmentDuration } | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleDuration, setRescheduleDuration] = useState<AppointmentDuration>(30);

  // Flatten all appointments
  const allAppointments = useMemo<FlatAppointment[]>(() => {
    const flat: FlatAppointment[] = [];
    for (const p of prospects) {
      for (const a of p.appointments) {
        flat.push({ prospect: p, appointment: a });
      }
    }
    return flat.sort(
      (a, b) =>
        new Date(`${a.appointment.date}T${a.appointment.time}`).getTime() -
        new Date(`${b.appointment.date}T${b.appointment.time}`).getTime()
    );
  }, [prospects]);

  // Filter by selected day
  const filteredAppointments = useMemo(() => {
    if (!selectedDay) return allAppointments;
    return allAppointments.filter((a) => a.appointment.date === selectedDay);
  }, [allAppointments, selectedDay]);

  const now = new Date();
  const upcoming = filteredAppointments.filter((a) => new Date(`${a.appointment.date}T${a.appointment.time}`) >= now || a.appointment.outcome === "pending");
  const past = filteredAppointments.filter((a) => new Date(`${a.appointment.date}T${a.appointment.time}`) < now && a.appointment.outcome !== "pending");

  // Stats for current month
  const stats = useMemo(() => {
    const month = calendarDate.getMonth();
    const year = calendarDate.getFullYear();
    const monthAppts = allAppointments.filter((a) => {
      const d = new Date(a.appointment.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
    const booked = monthAppts.length;
    const completed = monthAppts.filter((a) => a.appointment.outcome === "completed").length;
    const noShow = monthAppts.filter((a) => a.appointment.outcome === "no-show").length;
    const showRate = booked > 0 ? Math.round(((completed) / (completed + noShow || 1)) * 100) : 0;

    // Avg per week
    const weeksInMonth = 4.33;
    const avgPerWeek = booked > 0 ? (booked / weeksInMonth).toFixed(1) : "0";

    return { booked, showRate, avgPerWeek };
  }, [allAppointments, calendarDate]);

  // Calendar grid helpers
  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();
  const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const monthLabel = calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Days that have appointments
  const appointmentDays = useMemo(() => {
    const days = new Set<number>();
    for (const a of allAppointments) {
      const d = new Date(a.appointment.date);
      if (d.getMonth() === calMonth && d.getFullYear() === calYear) {
        days.add(d.getDate());
      }
    }
    return days;
  }, [allAppointments, calMonth, calYear]);

  // Check Google connection status on mount and after OAuth redirect
  const [googleEmail, setGoogleEmail] = useState("");
  const checkGoogleStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/status");
      const data = await res.json();
      setGoogleConnected(data.connected);
      if (data.email) setGoogleEmail(data.email);
    } catch { /* ignore */ }
  }, [setGoogleConnected]);

  useMemo(() => {
    if (typeof window !== "undefined") {
      checkGoogleStatus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnectGoogle = () => {
    setConnectingGoogle(true);
    window.location.href = "/api/auth/google";
  };

  const handleDisconnectGoogle = async () => {
    await fetch("/api/auth/disconnect", { method: "POST" });
    setGoogleConnected(false);
    setGoogleEmail("");
  };

  const handleSummarize = async (prospectId: string, apptId: string, name: string, service: string) => {
    if (!notesInput.trim()) return;
    setSummarizing(true);
    try {
      const res = await fetch("/api/summarize-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesInput, prospectName: name, service }),
      });
      const data = await res.json();
      if (res.ok && data.summary) {
        updateMeetingNotes(prospectId, apptId, notesInput, data.summary);
      }
    } catch {
      // silently fail
    } finally {
      setSummarizing(false);
    }
  };

  const handleSaveNotes = (prospectId: string, apptId: string) => {
    const prospect = prospects.find((p) => p.id === prospectId);
    const appt = prospect?.appointments.find((a) => a.id === apptId);
    updateMeetingNotes(prospectId, apptId, notesInput, appt?.summarizedNotes);
  };

  const handleMarkOutcome = useCallback((prospectId: string, apptId: string, outcome: AppointmentOutcome) => {
    updateAppointmentOutcome(prospectId, apptId, outcome);
    if (outcome === "completed" || outcome === "no-show") {
      const p = prospects.find((pr) => pr.id === prospectId);
      if (p) {
        setFollowUpTarget({ prospectId, prospect: p });
        // Pre-fill follow-up dates
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setFollowUpDate(tomorrow.toISOString().split("T")[0]);
      }
    }
  }, [updateAppointmentOutcome, prospects]);

  const handleCancelConfirm = () => {
    if (cancelTarget) {
      updateAppointmentOutcome(cancelTarget.prospectId, cancelTarget.apptId, "cancelled", cancelReason);
      setCancelTarget(null);
    }
  };

  const handleRescheduleConfirm = () => {
    if (rescheduleTarget && rescheduleDate && rescheduleTime) {
      const meetLink = googleConnected ? `https://meet.google.com/xxx-yyyy-zzz` : undefined;
      rescheduleAppointment(rescheduleTarget.prospectId, rescheduleTarget.apptId, rescheduleDate, rescheduleTime, rescheduleDuration, meetLink);
      setRescheduleTarget(null);
      setRescheduleDate("");
      setRescheduleTime("");
    }
  };

  const handleFollowUpQuick = (daysAhead: number) => {
    if (!followUpTarget) return;
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const meetLink = googleConnected ? `https://meet.google.com/xxx-yyyy-zzz` : undefined;
    bookAppointment(followUpTarget.prospectId, d.toISOString().split("T")[0], "10:00", 30, undefined, meetLink);
    setFollowUpTarget(null);
  };

  const handleFollowUpCustom = () => {
    if (!followUpTarget || !followUpDate || !followUpTime) return;
    const meetLink = googleConnected ? `https://meet.google.com/xxx-yyyy-zzz` : undefined;
    bookAppointment(followUpTarget.prospectId, followUpDate, followUpTime, followUpDuration, undefined, meetLink);
    setFollowUpTarget(null);
  };

  const prevMonth = () => setCalendarDate(new Date(calYear, calMonth - 1, 1));
  const nextMonth = () => setCalendarDate(new Date(calYear, calMonth + 1, 1));

  const renderAppointmentCard = (fa: FlatAppointment, showActions: boolean) => {
    const { prospect: p, appointment: appt } = fa;
    const badge = outcomeBadge[appt.outcome];
    const isNotesOpen = activeNotesId === appt.id;

    return (
      <div key={appt.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="p-4 hover:bg-[var(--card-hover)] transition-colors">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[rgba(232,85,61,0.1)] flex flex-col items-center justify-center shrink-0">
                <span className="text-xs font-bold text-[var(--accent)]">
                  {new Date(appt.date).toLocaleDateString("en-US", { month: "short" })}
                </span>
                <span className="text-sm font-bold text-[var(--accent-hover)]">
                  {new Date(appt.date).getDate()}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-[var(--muted)]" />
                  <h3 className="font-medium text-sm">{p.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.cls}`}>
                    {badge.icon && <span className="mr-0.5">{badge.icon}</span>}{badge.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Briefcase className="w-3.5 h-3.5 text-[var(--muted)]" />
                  <span className="text-xs text-[var(--muted)]">{p.service}</span>
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[var(--muted)]" />
                    <span className="text-xs text-[var(--muted)]">{appt.time} &middot; {durationLabels[appt.duration]}</span>
                  </div>
                  {p.email && (
                    <div className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-[var(--muted)]" />
                      <span className="text-xs text-[var(--muted)]">{p.email}</span>
                    </div>
                  )}
                </div>
                {appt.agenda && (
                  <p className="text-xs text-[var(--muted)] mt-1 italic">Agenda: {appt.agenda}</p>
                )}
                {appt.meetLink && (
                  <div className="flex items-center gap-1 mt-1">
                    <Video className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs text-emerald-400">Google Meet invite sent</span>
                  </div>
                )}
                {appt.cancelReason && (
                  <p className="text-xs text-zinc-500 mt-1">Cancel reason: {appt.cancelReason}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              {showActions && appt.outcome === "pending" && (
                <>
                  <button
                    onClick={() => handleMarkOutcome(p.id, appt.id, "completed")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                  >
                    <CheckCircle className="w-3 h-3" /> Completed
                  </button>
                  <button
                    onClick={() => handleMarkOutcome(p.id, appt.id, "no-show")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-xs font-medium hover:bg-rose-500/20 transition-colors"
                  >
                    <UserX className="w-3 h-3" /> No-show
                  </button>
                  <button
                    onClick={() => {
                      setRescheduleTarget({ prospectId: p.id, apptId: appt.id, duration: appt.duration });
                      setRescheduleDuration(appt.duration);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Reschedule
                  </button>
                  <button
                    onClick={() => setCancelTarget({ prospectId: p.id, apptId: appt.id })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-500/10 text-zinc-400 text-xs font-medium hover:bg-zinc-500/20 transition-colors"
                  >
                    <XCircle className="w-3 h-3" /> Cancel
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  if (isNotesOpen) { setActiveNotesId(null); }
                  else { setActiveNotesId(appt.id); setNotesInput(appt.meetingNotes || ""); }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(232,85,61,0.1)] text-[var(--accent)] text-xs font-medium hover:bg-[rgba(232,85,61,0.2)] transition-colors"
              >
                <FileText className="w-3 h-3" /> Notes
              </button>
            </div>
          </div>
        </div>

        {/* Meeting Notes */}
        {isNotesOpen && (
          <div className="border-t border-[var(--border)] p-4 bg-[var(--background)] space-y-3">
            <textarea
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              rows={4}
              placeholder="Type your call/meeting notes here..."
              className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs focus:outline-none focus:border-[var(--accent)] resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleSaveNotes(p.id, appt.id)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-xs hover:bg-[var(--card)]"
              >
                <Save className="w-3 h-3" /> Save
              </button>
              <button
                onClick={() => handleSummarize(p.id, appt.id, p.name, p.service)}
                disabled={summarizing || !notesInput.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[rgba(232,85,61,0.1)] text-[var(--accent)] text-xs font-medium hover:bg-[rgba(232,85,61,0.2)] disabled:opacity-50"
              >
                {summarizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {summarizing ? "Summarizing..." : "AI Summarize"}
              </button>
            </div>
            {appt.summarizedNotes && (
              <div className="p-3 rounded-lg bg-[rgba(232,85,61,0.05)] border border-[rgba(232,85,61,0.1)]">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3 h-3 text-[var(--accent)]" />
                  <span className="text-[10px] font-medium text-[var(--accent)] uppercase tracking-wider">AI Summary</span>
                </div>
                <p className="text-xs text-[var(--muted)] leading-relaxed whitespace-pre-wrap">{appt.summarizedNotes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-[var(--header-bg)] backdrop-blur-xl border-b border-[var(--border)]">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4">
          <div>
            <h1 className="text-xl font-bold">Appointments</h1>
            <p className="text-xs text-[var(--muted)]">{allAppointments.length} total appointments</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("calendar")}
              className={`p-2 rounded-lg transition-colors ${viewMode === "calendar" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:bg-[var(--card)]"}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg transition-colors ${viewMode === "list" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:bg-[var(--card)]"}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Google Calendar Connection */}
        <div className={`rounded-xl border p-4 ${
          googleConnected ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                googleConnected ? "bg-emerald-500/10" : "bg-amber-500/10"
              }`}>
                <Calendar className={`w-5 h-5 ${googleConnected ? "text-emerald-400" : "text-amber-400"}`} />
              </div>
              <div>
                <h3 className="text-sm font-medium">
                  {googleConnected ? "Google Calendar Connected" : "Connect Google Calendar"}
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  {googleConnected
                    ? "Calendar events and Google Meet invites are synced"
                    : "Link your Google account to create calendar events and Meet invites"
                  }
                </p>
              </div>
            </div>
            {!googleConnected && (
              <button
                onClick={handleConnectGoogle}
                disabled={connectingGoogle}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50 shrink-0"
              >
                {connectingGoogle ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Connecting...</>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Sign in with Google
                  </>
                )}
              </button>
            )}
            {googleConnected && (
              <div className="flex items-center gap-2">
                {googleEmail && <span className="text-xs text-[var(--muted)]">{googleEmail}</span>}
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                  <CheckCircle className="w-3 h-3" /> Connected
                </span>
                <button
                  onClick={handleDisconnectGoogle}
                  className="px-3 py-1.5 rounded-lg text-xs text-[var(--muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider">Booked This Month</span>
            </div>
            <p className="text-2xl font-bold">{stats.booked}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider">Show Rate</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{stats.showRate}%</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider">Avg / Week</span>
            </div>
            <p className="text-2xl font-bold">{stats.avgPerWeek}</p>
          </div>
        </div>

        {/* Calendar Grid (shown in calendar view) */}
        {viewMode === "calendar" && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-[var(--background)] transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h3 className="text-sm font-medium">{monthLabel}</h3>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-[var(--background)] transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="text-center text-[10px] text-[var(--muted)] font-medium py-1">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const hasAppt = appointmentDays.has(day);
                const isSelected = selectedDay === dateStr;
                const isToday = day === now.getDate() && calMonth === now.getMonth() && calYear === now.getFullYear();

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all relative ${
                      isSelected
                        ? "bg-[var(--accent)] text-white"
                        : isToday
                        ? "bg-[rgba(232,85,61,0.1)] text-[var(--accent)] font-medium"
                        : "hover:bg-[var(--background)] text-[var(--foreground)]"
                    }`}
                  >
                    {day}
                    {hasAppt && (
                      <div className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? "bg-white" : "bg-[var(--accent)]"}`} />
                    )}
                  </button>
                );
              })}
            </div>

            {selectedDay && (
              <button
                onClick={() => setSelectedDay(null)}
                className="mt-3 text-xs text-[var(--accent)] hover:underline"
              >
                Clear filter &middot; Show all
              </button>
            )}
          </div>
        )}

        {/* Cancel Modal */}
        {cancelTarget && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
            <h3 className="text-sm font-medium">Cancel Appointment</h3>
            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value as CancelReason)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
            >
              {cancelReasons.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={handleCancelConfirm} className="flex-1 px-3 py-2 rounded-lg bg-rose-500/20 text-rose-400 text-sm font-medium hover:bg-rose-500/30">
                Confirm Cancel
              </button>
              <button onClick={() => setCancelTarget(null)} className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card-hover)]">
                Back
              </button>
            </div>
          </div>
        )}

        {/* Reschedule Form */}
        {rescheduleTarget && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
            <h3 className="text-sm font-medium">Reschedule Appointment</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--muted)] mb-1 block">New Date</label>
                <input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--muted)] mb-1 block">New Time</label>
                <input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" />
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] mb-1.5 block">Duration</label>
              <div className="flex gap-1.5">
                {durations.map((d) => (
                  <button key={d} onClick={() => setRescheduleDuration(d)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      rescheduleDuration === d ? "bg-[var(--accent)] text-white" : "bg-[var(--background)] border border-[var(--border)] text-[var(--muted)]"
                    }`}>{durationLabels[d]}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleRescheduleConfirm} disabled={!rescheduleDate || !rescheduleTime}
                className="flex-1 px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50">
                Confirm Reschedule
              </button>
              <button onClick={() => setRescheduleTarget(null)} className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card-hover)]">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Follow-up Prompt */}
        {followUpTarget && (
          <div className="rounded-xl border border-[rgba(232,85,61,0.2)] bg-[rgba(232,85,61,0.05)] p-4 space-y-3">
            <h3 className="text-sm font-medium text-[var(--accent)]">Schedule a follow-up with {followUpTarget.prospect.name}?</h3>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => handleFollowUpQuick(1)} className="px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs hover:bg-[var(--card-hover)]">
                Tomorrow
              </button>
              <button onClick={() => handleFollowUpQuick(3)} className="px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs hover:bg-[var(--card-hover)]">
                In 3 Days
              </button>
              <button onClick={() => handleFollowUpQuick(7)} className="px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs hover:bg-[var(--card-hover)]">
                Next Week
              </button>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-[var(--muted)] mb-1 block">Custom Date</label>
                <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-[var(--muted)] mb-1 block">Time</label>
                <input type="time" value={followUpTime} onChange={(e) => setFollowUpTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <button onClick={handleFollowUpCustom} disabled={!followUpDate || !followUpTime}
                className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50">
                Book
              </button>
            </div>
            <button onClick={() => setFollowUpTarget(null)} className="text-xs text-[var(--muted)] hover:underline">
              Skip follow-up
            </button>
          </div>
        )}

        {/* Upcoming */}
        <div>
          <h2 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Upcoming ({upcoming.length})
          </h2>
          {upcoming.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted)]">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No upcoming appointments</p>
              <p className="text-xs mt-1">Book appointments from the prospect detail panel</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((fa) => renderAppointmentCard(fa, true))}
            </div>
          )}
        </div>

        {/* Past */}
        {past.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Past ({past.length})
            </h2>
            <div className="space-y-2 opacity-60">
              {past.map((fa) => renderAppointmentCard(fa, false))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
