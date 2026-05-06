"use client";

import { Prospect, ProspectStatus, AppointmentDuration, CancelReason } from "@/types";
import { X, Phone, Mail, Briefcase, FileText, Calendar, ArrowRight, Video, Wand2, Loader2, Save, Check, XCircle, RefreshCw, UserX, Voicemail, Trash2, Bot, DollarSign, ExternalLink, User as UserIcon, Building2, MapPin, Globe, Pencil, Plus } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProspects } from "@/context/ProspectsContext";
import { useSoftphone } from "@/context/SoftphoneProvider";
import ConfirmModal from "@/components/ui/ConfirmModal";
import MessageThread from "@/components/messages/MessageThread";
import VoicedropModal from "@/components/dashboard/VoicedropModal";
import ReceptionistBuilderModal from "@/components/dashboard/ReceptionistBuilderModal";
import { SendToMyPhoneButton } from "@/components/SendToMyPhoneButton";

interface DetailPanelProps {
  prospect: Prospect;
  onClose: () => void;
}

const pipeline: ProspectStatus[] = ["New", "Contacted", "Qualified", "Booked", "Closed"];

const pipelineColors: Record<ProspectStatus, string> = {
  New: "bg-blue-500",
  Contacted: "bg-amber-500",
  Qualified: "bg-purple-500",
  Booked: "bg-emerald-500",
  Closed: "bg-rose-500",
};

const durations: AppointmentDuration[] = [15, 30, 45, 60, 90];
const durationLabels: Record<AppointmentDuration, string> = { 15: "15m", 30: "30m", 45: "45m", 60: "1hr", 90: "1.5hr" };

const cancelReasons: CancelReason[] = ["Changed mind", "Not a fit", "No response", "Other"];

const outcomeStyles: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-amber-500/15 text-amber-400" },
  completed: { label: "Completed", cls: "bg-emerald-500/15 text-emerald-400" },
  "no-show": { label: "No-show", cls: "bg-rose-500/15 text-rose-400" },
  rescheduled: { label: "Rescheduled", cls: "bg-blue-500/15 text-blue-400" },
  cancelled: { label: "Cancelled", cls: "bg-zinc-500/15 text-zinc-400" },
};

function extractMapsName(url: string): string {
  if (!url) return url;
  try {
    const placeMatch = url.match(/\/maps\/place\/([^/@?]+)/);
    if (placeMatch) {
      return decodeURIComponent(placeMatch[1].replace(/\+/g, " ")).trim();
    }
    const qMatch = url.match(/[?&]q=([^&]+)/);
    if (qMatch) {
      return decodeURIComponent(qMatch[1].replace(/\+/g, " ")).trim();
    }
    const queryMatch = url.match(/[?&]query=([^&]+)/);
    if (queryMatch) {
      return decodeURIComponent(queryMatch[1].replace(/\+/g, " ")).trim();
    }
    if (/maps\.app\.goo\.gl|goo\.gl\/maps/.test(url)) {
      return "Open in Google Maps";
    }
    return url;
  } catch {
    return url;
  }
}

export default function DetailPanel({ prospect, onClose }: DetailPanelProps) {
  const { updateStatus, bookAppointment, updateProspect, updateMeetingNotes, updateAppointmentOutcome, rescheduleAppointment, googleConnected, deleteProspect } = useProspects();
  const { startCall, available: softphoneAvailable, ready: softphoneReady } = useSoftphone();
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Contact field inline editing
  type ContactKey = "name" | "contactName" | "phone" | "email" | "service" | "address" | "website" | "mapsUrl";
  const [editingField, setEditingField] = useState<ContactKey | null>(null);
  const [fieldDraft, setFieldDraft] = useState("");

  const startEditField = (key: ContactKey) => {
    setEditingField(key);
    const current = (prospect[key] as string | undefined) ?? "";
    setFieldDraft(current);
  };

  const saveField = (key: ContactKey) => {
    const trimmed = fieldDraft.trim();
    // Required fields (name, phone, service) fall back to existing value if empty.
    if (!trimmed && (key === "name" || key === "phone" || key === "service")) {
      setEditingField(null);
      return;
    }
    updateProspect(prospect.id, { [key]: trimmed } as Partial<Prospect>);
    setEditingField(null);
  };

  // Deal value
  const [editingDeal, setEditingDeal] = useState(false);
  const [dealInput, setDealInput] = useState(prospect.dealValue?.toString() ?? "");

  const saveDeal = () => {
    const parsed = parseFloat(dealInput);
    const value = Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
    const patch: Partial<Prospect> = { dealValue: value };
    if (value && !prospect.closedAt) patch.closedAt = new Date().toISOString();
    updateProspect(prospect.id, patch);
    setEditingDeal(false);
  };

  // Booking form
  const [showBooking, setShowBooking] = useState(false);
  const [bookDate, setBookDate] = useState("");
  const [bookTime, setBookTime] = useState("");
  const [bookDuration, setBookDuration] = useState<AppointmentDuration>(30);
  const [bookEmail, setBookEmail] = useState(prospect.email || "");
  const [bookAgenda, setBookAgenda] = useState("");
  const [sendMeetInvite, setSendMeetInvite] = useState(true);

  // Reschedule
  const [rescheduleApptId, setRescheduleApptId] = useState<string | null>(null);

  // Cancel
  const [cancelApptId, setCancelApptId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<CancelReason>("Changed mind");

  // Notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(prospect.notes);

  // Meeting notes per appointment
  const [activeNotesApptId, setActiveNotesApptId] = useState<string | null>(null);
  const [meetingNotesValue, setMeetingNotesValue] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [summarizeError, setSummarizeError] = useState("");

  // Appointment history
  const [apptTab, setApptTab] = useState<"upcoming" | "past">("upcoming");
  const [expandedApptId, setExpandedApptId] = useState<string | null>(null);

  // Voicemail drop (uses shared VoicedropModal — verified caller-id dropdown built in)
  const [showVoicemailModal, setShowVoicemailModal] = useState(false);

  // SMS / call history (SMS sending now happens via the user's own phone — sms: link in Quick Actions)
  type SmsMessage = {
    id: string;
    direction: "inbound" | "outbound";
    body: string;
    status: string;
    error_message: string | null;
    created_at: string;
    sent_at: string | null;
    delivered_at: string | null;
    from_number: string;
    to_number: string;
  };
  type CallLog = { id: string; outcome: string; notes: string | null; created_at: string };

  const [smsHistory, setSmsHistory] = useState<SmsMessage[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  type Enrollment = {
    id: string;
    sequence_id: string;
    status: string;
    current_step_order: number;
    next_send_at: string | null;
    enrolled_at: string;
    completed_at: string | null;
    last_error: string | null;
    sms_sequences: { name: string } | { name: string }[] | null;
  };
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [haltingEnrollmentId, setHaltingEnrollmentId] = useState<string | null>(null);
  const [loggingOutcome, setLoggingOutcome] = useState<string | null>(null);

  // Build Receptionist
  const [showReceptionistBuilder, setShowReceptionistBuilder] = useState(false);

  const currentIndex = pipeline.indexOf(prospect.status);

  // Get latest pending appointment
  const latestPending = [...prospect.appointments]
    .filter((a) => a.outcome === "pending")
    .sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime())[0];

  const pastAppointments = prospect.appointments.filter((a) => a.outcome !== "pending");
  const upcomingAppointments = [...prospect.appointments]
    .filter((a) => a.outcome === "pending")
    .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

  // Stats
  const apptStats = (() => {
    const total = prospect.appointments.length;
    const completed = prospect.appointments.filter((a) => a.outcome === "completed").length;
    const noShow = prospect.appointments.filter((a) => a.outcome === "no-show").length;
    const scored = completed + noShow;
    const showRate = scored > 0 ? Math.round((completed / scored) * 100) : null;
    const sorted = [...prospect.appointments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let avgGapDays: number | null = null;
    if (sorted.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        gaps.push((new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) / 86400000);
      }
      avgGapDays = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    }
    return { total, completed, noShow, showRate, avgGapDays };
  })();

  const countdownTo = (date: string, time: string): string => {
    const ms = new Date(`${date}T${time}`).getTime() - Date.now();
    if (ms < 0) return "Now";
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    if (days >= 1) return `in ${days}d ${hours}h`;
    if (hours >= 1) return `in ${hours}h ${mins}m`;
    return `in ${mins}m`;
  };

  const applyQuickSlot = (daysFromToday: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromToday);
    const iso = d.toISOString().split("T")[0];
    const hh = String(hour).padStart(2, "0");
    setBookDate(iso);
    setBookTime(`${hh}:00`);
    setShowBooking(true);
  };

  const handleBook = () => {
    if (bookDate && bookTime) {
      const meetLink = sendMeetInvite && googleConnected
        ? `https://meet.google.com/xxx-yyyy-zzz`
        : undefined;
      bookAppointment(prospect.id, bookDate, bookTime, bookDuration, bookEmail, meetLink, bookAgenda || undefined);
      setShowBooking(false);
      setBookDate("");
      setBookTime("");
      setBookDuration(30);
      setBookAgenda("");
    }
  };

  const handleReschedule = () => {
    if (rescheduleApptId && bookDate && bookTime) {
      const meetLink = sendMeetInvite && googleConnected
        ? `https://meet.google.com/xxx-yyyy-zzz`
        : undefined;
      rescheduleAppointment(prospect.id, rescheduleApptId, bookDate, bookTime, bookDuration, meetLink, bookAgenda || undefined);
      setRescheduleApptId(null);
      setShowBooking(false);
      setBookDate("");
      setBookTime("");
      setBookDuration(30);
      setBookAgenda("");
    }
  };

  const handleCancel = () => {
    if (cancelApptId) {
      updateAppointmentOutcome(prospect.id, cancelApptId, "cancelled", cancelReason);
      setCancelApptId(null);
    }
  };

  const handleSaveNotes = () => {
    updateProspect(prospect.id, { notes: notesValue });
    setEditingNotes(false);
  };

  const handleSaveMeetingNotes = (apptId: string) => {
    const appt = prospect.appointments.find((a) => a.id === apptId);
    updateMeetingNotes(prospect.id, apptId, meetingNotesValue, appt?.summarizedNotes);
    setActiveNotesApptId(null);
  };

  const handleSummarizeNotes = async (apptId: string) => {
    if (!meetingNotesValue.trim()) return;
    setSummarizing(true);
    setSummarizeError("");
    try {
      const res = await fetch("/api/summarize-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: meetingNotesValue,
          prospectName: prospect.name,
          service: prospect.service,
        }),
      });
      const data = await res.json();
      if (res.ok && data.summary) {
        updateMeetingNotes(prospect.id, apptId, meetingNotesValue, data.summary);
      } else if (data.error) {
        setSummarizeError(data.error);
      }
    } catch {
      setSummarizeError("Failed to summarize notes. Check your AI settings.");
    } finally {
      setSummarizing(false);
    }
  };

  // ---- SMS / call-log helpers ----
  const loadSmsHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/sms/messages?prospect_id=${prospect.id}`);
      const data = await res.json();
      if (res.ok) setSmsHistory(data.messages || []);
    } catch {}
  }, [prospect.id]);

  const loadCallLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/prospects/call-logs?prospect_id=${prospect.id}`);
      const data = await res.json();
      if (res.ok) setCallLogs(data.call_logs || []);
    } catch {}
  }, [prospect.id]);

  const loadEnrollments = useCallback(async () => {
    try {
      const res = await fetch(`/api/sms/enrollments?prospect_id=${prospect.id}`);
      const data = await res.json();
      if (res.ok) setEnrollments(data.enrollments || []);
    } catch {}
  }, [prospect.id]);

  useEffect(() => {
    loadSmsHistory();
    loadCallLogs();
    loadEnrollments();
  }, [loadSmsHistory, loadCallLogs, loadEnrollments]);

  const handleHaltEnrollment = async (id: string) => {
    setHaltingEnrollmentId(id);
    try {
      const res = await fetch(`/api/sms/enrollments/${id}/halt`, { method: "POST" });
      if (res.ok) loadEnrollments();
    } catch {}
    finally {
      setHaltingEnrollmentId(null);
    }
  };

  const handleLogCall = async (outcome: string) => {
    setLoggingOutcome(outcome);
    try {
      const res = await fetch("/api/prospects/call-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospect_id: prospect.id, outcome }),
      });
      if (res.ok) {
        loadCallLogs();
        loadEnrollments();
      }
    } catch {}
    finally {
      setLoggingOutcome(null);
    }
  };

  const renderBookingForm = (isReschedule: boolean) => (
    <div className="p-4 rounded-lg bg-[var(--background)] space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[var(--muted)] mb-1 block">Date</label>
          <input
            type="date"
            value={bookDate}
            onChange={(e) => setBookDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--muted)] mb-1 block">Time</label>
          <input
            type="time"
            value={bookTime}
            onChange={(e) => setBookTime(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {/* Duration pills */}
      <div>
        <label className="text-xs text-[var(--muted)] mb-1.5 block">Duration</label>
        <div className="flex gap-1.5">
          {durations.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setBookDuration(d)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                bookDuration === d
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {durationLabels[d]}
            </button>
          ))}
        </div>
      </div>

      {/* Agenda */}
      <div>
        <label className="text-xs text-[var(--muted)] mb-1 block">Agenda / Pre-meeting Notes</label>
        <textarea
          value={bookAgenda}
          onChange={(e) => setBookAgenda(e.target.value)}
          rows={2}
          placeholder="Topics to discuss, goals for the meeting..."
          className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs focus:outline-none focus:border-[var(--accent)] resize-none placeholder:text-zinc-600"
        />
      </div>

      {/* Email */}
      {!isReschedule && (
        <div>
          <label className="text-xs text-[var(--muted)] mb-1 block">Prospect Email (for invite)</label>
          <input
            type="email"
            value={bookEmail}
            onChange={(e) => setBookEmail(e.target.value)}
            placeholder={prospect.email || "Enter email address"}
            className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder:text-zinc-600"
          />
        </div>
      )}

      {/* Google Meet toggle */}
      <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-[var(--muted)]" />
          <div>
            <p className="text-xs font-medium">Send Google Meet invite</p>
            <p className="text-[10px] text-[var(--muted)]">
              {googleConnected ? "Connected to Google Calendar" : "Connect Google account first"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setSendMeetInvite(!sendMeetInvite)}
          disabled={!googleConnected}
          className={`w-10 h-5 rounded-full transition-colors relative ${
            sendMeetInvite && googleConnected ? "bg-[var(--accent)]" : "bg-[var(--border)]"
          } ${!googleConnected ? "opacity-40 cursor-not-allowed" : ""}`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
              sendMeetInvite && googleConnected ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={isReschedule ? handleReschedule : handleBook}
          disabled={!bookDate || !bookTime}
          className="flex-1 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isReschedule ? "Confirm Reschedule" : "Confirm Booking"}
        </button>
        <button
          onClick={() => { setShowBooking(false); setRescheduleApptId(null); }}
          className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card-hover)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  const stageTheme: Record<string, { rgb: string; label: string; ring: string; strip: string }> = {
    New:       { rgb: "148, 163, 184", label: "slate",   ring: "0 0 0 1px rgba(148,163,184,0.14), 0 20px 60px rgba(0,0,0,0.40), 0 1px 0 rgba(255,255,255,0.04) inset", strip: "linear-gradient(90deg, transparent, rgba(148,163,184,0.55), transparent)" },
    Contacted: { rgb: "245, 158, 11",  label: "amber",   ring: "0 0 0 1px rgba(245,158,11,0.16),  0 20px 60px rgba(0,0,0,0.42), 0 1px 0 rgba(255,255,255,0.04) inset", strip: "linear-gradient(90deg, transparent, rgba(245,158,11,0.65), transparent)" },
    Qualified: { rgb: "168, 85, 247",  label: "violet",  ring: "0 0 0 1px rgba(168,85,247,0.18),  0 20px 60px rgba(0,0,0,0.44), 0 1px 0 rgba(255,255,255,0.05) inset", strip: "linear-gradient(90deg, transparent, rgba(168,85,247,0.7), transparent)" },
    Booked:    { rgb: "16, 185, 129",  label: "emerald", ring: "0 0 0 1px rgba(16,185,129,0.20),  0 22px 64px rgba(0,0,0,0.46), 0 1px 0 rgba(255,255,255,0.05) inset", strip: "linear-gradient(90deg, transparent, rgba(16,185,129,0.75), transparent)" },
    Closed:    { rgb: "var(--accent-rgb)", label: "accent", ring: "0 0 0 1px rgba(var(--accent-rgb),0.28), 0 24px 72px rgba(0,0,0,0.48), 0 1px 0 rgba(255,255,255,0.06) inset", strip: "linear-gradient(90deg, transparent, rgba(var(--accent-rgb),0.85), transparent)" },
  };
  const theme = stageTheme[prospect.status] || stageTheme.New;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm transition-opacity duration-300" onClick={onClose} />
      <div
        className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-[28px] border border-[var(--border)] animate-[fadeIn_0.28s_ease-out] transition-shadow duration-500"
        style={{
          boxShadow: theme.ring,
          backgroundImage: `linear-gradient(180deg, rgba(${typeof theme.rgb === "string" && theme.rgb.startsWith("var") ? "var(--accent-rgb)" : theme.rgb},0.06), transparent 240px), linear-gradient(180deg, var(--card-hover, var(--card)), var(--card))`,
        }}
      >
        <div
          className="pointer-events-none absolute top-0 left-0 right-0 h-[2px] rounded-t-[28px] transition-all duration-500"
          style={{ background: theme.strip }}
        />
        {prospect.status === "Closed" && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
            <div
              className="absolute inset-x-0 top-0 h-56 opacity-80"
              style={{ background: "radial-gradient(ellipse at top, rgba(var(--accent-rgb),0.26), transparent 65%)" }}
            />
            <div
              className="absolute -left-1/3 top-0 h-full w-[160%] animate-[liquid-sheen_2.4s_ease-out_1]"
              style={{ background: "linear-gradient(110deg, transparent 35%, rgba(var(--accent-rgb),0.14) 50%, transparent 65%)" }}
            />
            <div className="absolute inset-x-0 top-0 h-full">
              {Array.from({ length: 36 }).map((_, i) => {
                const colors = ["var(--accent)", "#f59e0b", "#10b981", "#a855f7", "#3b82f6", "#ec4899"];
                const left = (i * 137.5) % 100;
                const delay = (i % 12) * 120;
                const duration = 2400 + ((i * 173) % 1600);
                const size = 6 + (i % 3) * 2;
                const rotate = (i * 53) % 360;
                return (
                  <span
                    key={i}
                    className="absolute top-[-20px]"
                    style={{
                      left: `${left}%`,
                      width: `${size}px`,
                      height: `${size * 0.4}px`,
                      background: colors[i % colors.length],
                      transform: `rotate(${rotate}deg)`,
                      animation: `confettiFall ${duration}ms ${delay}ms cubic-bezier(0.23, 0.94, 0.64, 1) forwards`,
                      opacity: 0,
                      borderRadius: "1px",
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}
      {/* Header */}
      <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--border)] p-5 flex items-center justify-between z-10 rounded-t-[28px]">
        <div>
          <h2 className="text-lg font-bold">{prospect.name}</h2>
          <p className="text-sm text-[var(--muted)]">
            Added {new Date(prospect.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors"
            aria-label="Delete prospect"
            title="Delete prospect"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--background)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Pipeline */}
        <div>
          <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-3">Pipeline Stage</h3>
          <div className="flex items-center gap-1">
            {pipeline.map((stage, i) => (
              <button
                key={stage}
                onClick={() => updateStatus(prospect.id, stage)}
                className="flex-1 group relative"
              >
                <div
                  className={`h-2 rounded-full transition-all ${
                    i <= currentIndex ? pipelineColors[stage] : "bg-[var(--border)]"
                  } ${i <= currentIndex ? "opacity-100" : "opacity-40"} group-hover:opacity-100`}
                />
                <span className={`block text-[10px] mt-1.5 text-center transition-colors ${
                  i === currentIndex ? "text-[var(--foreground)] font-medium" : "text-[var(--muted)]"
                } group-hover:text-[var(--foreground)]`}>
                  {stage}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Contact Details */}
        {(() => {
          type FieldConfig = {
            key: ContactKey;
            label: string;
            icon: typeof Phone;
            type: string;
            placeholder: string;
            multiline: boolean;
            linkHref: ((v: string) => string) | null;
            displayValue: ((v: string) => string) | null;
            openInNewTab?: boolean;
          };

          const fields: Record<string, FieldConfig> = {
            name:        { key: "name", label: "Company Name", icon: Building2, type: "text", placeholder: "Business name", multiline: false, linkHref: null, displayValue: null },
            contactName: { key: "contactName", label: "Contact Name", icon: UserIcon, type: "text", placeholder: "Who you speak with", multiline: false, linkHref: null, displayValue: null },
            phone:       { key: "phone", label: "Phone", icon: Phone, type: "tel", placeholder: "+1 555 555 5555", multiline: false, linkHref: (v) => `tel:${v}`, displayValue: null },
            email:       { key: "email", label: "Email", icon: Mail, type: "email", placeholder: "name@company.com", multiline: false, linkHref: (v) => `mailto:${v}`, displayValue: null },
            service:     { key: "service", label: "Service", icon: Briefcase, type: "text", placeholder: "What they need", multiline: false, linkHref: null, displayValue: null },
            address:     { key: "address", label: "Address", icon: MapPin, type: "text", placeholder: "Street, city, state", multiline: true, linkHref: (v) => `https://maps.google.com/?q=${encodeURIComponent(v)}`, displayValue: null, openInNewTab: true },
            website:     { key: "website", label: "Website", icon: Globe, type: "url", placeholder: "https://example.com", multiline: false, linkHref: (v) => (v.startsWith("http") ? v : `https://${v}`), displayValue: null, openInNewTab: true },
            mapsUrl:     { key: "mapsUrl", label: "Google Maps Link", icon: MapPin, type: "url", placeholder: "Paste Google Maps URL", multiline: false, linkHref: (v) => v, displayValue: (v) => extractMapsName(v), openInNewTab: true },
          };

          const renderRow = (cfg: FieldConfig) => {
            const Icon = cfg.icon;
            const value = (prospect[cfg.key] as string | undefined) ?? "";
            const isEditing = editingField === cfg.key;
            const isEmpty = !value.trim();
            return (
              <div key={cfg.key} className="group relative flex items-start gap-3 p-3 hover:bg-[var(--card)]/40 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-[var(--accent)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-medium">{cfg.label}</div>
                  {isEditing ? (
                    <div className="mt-1 flex items-center gap-2">
                      {cfg.multiline ? (
                        <textarea
                          autoFocus
                          value={fieldDraft}
                          onChange={(e) => setFieldDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setEditingField(null);
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveField(cfg.key);
                          }}
                          rows={2}
                          placeholder={cfg.placeholder}
                          className="flex-1 bg-[var(--card)] border border-[var(--accent)]/40 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)] resize-none"
                        />
                      ) : (
                        <input
                          autoFocus
                          type={cfg.type}
                          value={fieldDraft}
                          onChange={(e) => setFieldDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setEditingField(null);
                            if (e.key === "Enter") saveField(cfg.key);
                          }}
                          placeholder={cfg.placeholder}
                          className="flex-1 bg-[var(--card)] border border-[var(--accent)]/40 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)]"
                        />
                      )}
                      <button onClick={() => saveField(cfg.key)} className="p-1.5 rounded-md bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors" aria-label="Save">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEditingField(null)} className="p-1.5 rounded-md bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors" aria-label="Cancel">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="mt-0.5 flex items-center gap-2">
                      {isEmpty ? (
                        <button onClick={() => startEditField(cfg.key)} className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline">
                          <Plus className="w-3 h-3" /> Add {cfg.label.toLowerCase()}
                        </button>
                      ) : (
                        <>
                          {cfg.linkHref ? (
                            <a
                              href={cfg.linkHref(value)}
                              target={cfg.openInNewTab ? "_blank" : undefined}
                              rel="noopener noreferrer"
                              className="text-sm text-[var(--foreground)] hover:text-[var(--accent)] transition-colors truncate"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {cfg.displayValue ? cfg.displayValue(value) : value}
                            </a>
                          ) : (
                            <span className="text-sm text-[var(--foreground)] truncate">{value}</span>
                          )}
                          <button onClick={() => startEditField(cfg.key)} className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--muted)] hover:text-[var(--accent)] transition-all" aria-label={`Edit ${cfg.label}`}>
                            <Pencil className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          };

          const initials = (prospect.name || "?")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((s) => s[0]?.toUpperCase() ?? "")
            .join("") || "?";

          const statusPillCls: Record<ProspectStatus, string> = {
            New: "bg-blue-500/15 text-blue-300 border-blue-500/25",
            Contacted: "bg-amber-500/15 text-amber-300 border-amber-500/25",
            Qualified: "bg-purple-500/15 text-purple-300 border-purple-500/25",
            Booked: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
            Closed: "bg-[rgba(232,85,61,0.15)] text-[var(--accent)] border-[rgba(232,85,61,0.3)]",
          };

          const formatRelative = (iso: string): string => {
            const ms = Date.now() - new Date(iso).getTime();
            const min = Math.round(ms / 60000);
            if (min < 1) return "just now";
            if (min < 60) return `${min}m ago`;
            const hrs = Math.round(min / 60);
            if (hrs < 24) return `${hrs}h ago`;
            const days = Math.round(hrs / 24);
            if (days < 30) return `${days}d ago`;
            const months = Math.round(days / 30);
            if (months < 12) return `${months}mo ago`;
            return `${Math.round(months / 12)}y ago`;
          };

          const lastContactedIso = callLogs[0]?.created_at || smsHistory[0]?.created_at || null;
          const groups: Array<{ title: string; rows: FieldConfig[] }> = [
            { title: "Identity", rows: [fields.name, fields.contactName, fields.service] },
            { title: "Reach", rows: [fields.phone, fields.email] },
            { title: "Location", rows: [fields.address, fields.mapsUrl] },
            { title: "Web", rows: [fields.website] },
          ];

          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Contact Details</h3>
                <span className="text-[10px] text-[var(--muted)]">Click any field to edit</span>
              </div>

              {/* Identity header card */}
              <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--card)] via-[var(--card)] to-[var(--background)]/60 p-4">
                <div
                  className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-20 blur-3xl"
                  style={{ background: `rgb(${theme.rgb.startsWith("var") ? "var(--accent-rgb)" : theme.rgb})` }}
                />
                <div className="relative flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg shrink-0"
                    style={{
                      background: `linear-gradient(135deg, rgb(${theme.rgb.startsWith("var") ? "var(--accent-rgb)" : theme.rgb}) 0%, rgba(${theme.rgb.startsWith("var") ? "var(--accent-rgb)" : theme.rgb}, 0.7) 100%)`,
                    }}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[15px] font-semibold truncate text-[var(--foreground)]">{prospect.name || "Untitled prospect"}</span>
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusPillCls[prospect.status]}`}>
                        {prospect.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[var(--muted)] flex-wrap">
                      {prospect.contactName && (
                        <span className="inline-flex items-center gap-1">
                          <UserIcon className="w-3 h-3" /> {prospect.contactName}
                        </span>
                      )}
                      {prospect.service && (
                        <span className="inline-flex items-center gap-1">
                          <Briefcase className="w-3 h-3" /> {prospect.service}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Added {formatRelative(prospect.createdAt)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {lastContactedIso ? `Last contact ${formatRelative(lastContactedIso)}` : "Never contacted"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grouped field sections */}
              <div className="grid sm:grid-cols-2 gap-3">
                {groups.map((g) => (
                  <div key={g.title} className="rounded-2xl border border-[var(--border)] bg-[var(--background)]/60 overflow-hidden">
                    <div className="px-3 pt-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {g.title}
                    </div>
                    <div className="divide-y divide-[var(--border)]">
                      {g.rows.map((cfg) => renderRow(cfg))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            {prospect.phone && (
              softphoneAvailable && softphoneReady ? (
                <button
                  onClick={() => {
                    if (!prospect.phone) return;
                    startCall({ to: prospect.phone, prospectId: prospect.id, prospectName: prospect.name });
                  }}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-[rgba(232,85,61,0.12)] border border-[rgba(232,85,61,0.4)] text-[#ff8a6a] hover:bg-[rgba(232,85,61,0.18)] transition-colors"
                  title="Call in browser"
                >
                  <Phone className="w-3 h-3" /> Call
                </button>
              ) : (
                <a href={`tel:${prospect.phone}`} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/40 transition-colors">
                  <Phone className="w-3 h-3" /> Call
                </a>
              )
            )}
            {prospect.phone && (
              <a href={`sms:${prospect.phone}`} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/40 transition-colors">
                <FileText className="w-3 h-3" /> Text
              </a>
            )}
            {prospect.email && (
              <a href={`mailto:${prospect.email}`} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/40 transition-colors">
                <Mail className="w-3 h-3" /> Email
              </a>
            )}
            {prospect.website && (
              <a href={prospect.website.startsWith("http") ? prospect.website : `https://${prospect.website}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/40 transition-colors">
                <ExternalLink className="w-3 h-3" /> Visit site
              </a>
            )}
                <SendToMyPhoneButton
                  label="Text me details"
                  body={[
                    `${prospect.name}${prospect.service ? ` — ${prospect.service}` : ""}`,
                    prospect.contactName ? `Contact: ${prospect.contactName}` : null,
                    prospect.phone ? `Phone: ${prospect.phone}` : null,
                    prospect.email ? `Email: ${prospect.email}` : null,
                    prospect.address ? `Address: ${prospect.address}` : null,
                    prospect.website ? `Site: ${prospect.website}` : null,
                  ].filter(Boolean).join("\n")}
                />
              </div>
            </div>
          );
        })()}

        {/* Deal Value */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Deal Value</h3>
            {!editingDeal ? (
              <button
                onClick={() => { setEditingDeal(true); setDealInput(prospect.dealValue?.toString() ?? ""); }}
                className="text-[10px] text-[var(--accent)] hover:underline"
              >
                {prospect.dealValue ? "Edit" : "Add"}
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={saveDeal} className="flex items-center gap-1 text-[10px] text-emerald-400 hover:underline">
                  <Check className="w-3 h-3" /> Save
                </button>
                <button onClick={() => setEditingDeal(false)} className="text-[10px] text-[var(--muted)] hover:underline">
                  Cancel
                </button>
              </div>
            )}
          </div>
          <div className="p-3 rounded-lg bg-[var(--background)] flex items-center gap-3">
            <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
            {editingDeal ? (
              <input
                type="number"
                step="0.01"
                min="0"
                autoFocus
                value={dealInput}
                onChange={(e) => setDealInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveDeal()}
                placeholder="e.g., 2500"
                className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-zinc-600"
              />
            ) : prospect.dealValue ? (
              <div className="flex-1 flex items-center justify-between">
                <span className="text-sm font-semibold text-emerald-400">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(prospect.dealValue)}
                </span>
                {prospect.closedAt && (
                  <span className="text-[10px] text-[var(--muted)]">
                    Closed {new Date(prospect.closedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm text-[var(--muted)]">No deal value logged yet</span>
            )}
          </div>
        </div>

        {/* Landing Page shortcut */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Landing Page</h3>
            {prospect.generatedWebsiteId && (
              <a
                href={`/api/websites/${prospect.generatedWebsiteId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-[var(--accent)] hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> View site
              </a>
            )}
          </div>
          <button
            onClick={() => router.push(`/dashboard/websites`)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-4 flex items-center gap-3 hover:bg-[var(--card)]/40 transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{prospect.generatedWebsiteId ? "Manage Landing Page" : "Generate a Landing Page"}</p>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">
                {prospect.generatedWebsiteId ? "Open, copy URL, or regenerate" : "AI creates a professional site from this prospect\u2019s info"}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors shrink-0" />
          </button>
        </div>

        {/* Editable Notes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Notes</h3>
            {!editingNotes ? (
              <button
                onClick={() => { setEditingNotes(true); setNotesValue(prospect.notes); }}
                className="text-[10px] text-[var(--accent)] hover:underline"
              >
                Edit
              </button>
            ) : (
              <div className="flex gap-1">
                <button onClick={handleSaveNotes} className="flex items-center gap-1 text-[10px] text-emerald-400 hover:underline">
                  <Check className="w-3 h-3" /> Save
                </button>
                <button onClick={() => setEditingNotes(false)} className="text-[10px] text-[var(--muted)] hover:underline ml-2">
                  Cancel
                </button>
              </div>
            )}
          </div>
          {editingNotes ? (
            <textarea
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              rows={4}
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] resize-none"
            />
          ) : (
            <div className="p-3 rounded-lg bg-[var(--background)] flex items-start gap-3">
              <FileText className="w-4 h-4 text-[var(--muted)] mt-0.5 shrink-0" />
              <p className="text-sm leading-relaxed text-[var(--muted)]">{prospect.notes || "No notes yet. Click edit to add."}</p>
            </div>
          )}
        </div>

        {/* Appointments */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Appointments</h3>
            {!showBooking && prospect.appointments.length > 0 && (
              <button
                onClick={() => setShowBooking(true)}
                className="inline-flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline"
              >
                <Plus className="w-3 h-3" /> Book new
              </button>
            )}
          </div>

          {/* Stats strip */}
          {prospect.appointments.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: "Booked", value: apptStats.total, tone: "text-[var(--foreground)]" },
                { label: "Show rate", value: apptStats.showRate === null ? "—" : `${apptStats.showRate}%`, tone: apptStats.showRate !== null && apptStats.showRate < 60 ? "text-rose-400" : "text-emerald-400" },
                { label: "No-shows", value: apptStats.noShow, tone: apptStats.noShow > 0 ? "text-rose-400" : "text-[var(--muted)]" },
                { label: "Avg gap", value: apptStats.avgGapDays === null ? "—" : `${apptStats.avgGapDays}d`, tone: "text-[var(--foreground)]" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-[var(--background)]/60 border border-[var(--border)] px-2 py-1.5">
                  <div className="text-[9px] text-[var(--muted)] uppercase tracking-wider">{s.label}</div>
                  <div className={`text-sm font-semibold ${s.tone}`}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Hero: booking form, latest pending w/ countdown, or empty CTA */}
          {showBooking ? (
            renderBookingForm(!!rescheduleApptId)
          ) : latestPending ? (
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-4">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[var(--foreground)]">
                      {new Date(latestPending.date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                    </div>
                    <div className="text-xs text-[var(--muted)]">{latestPending.time} · {durationLabels[latestPending.duration]}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-emerald-400/70 uppercase tracking-wider">Upcoming</div>
                  <div className="text-xs font-semibold text-emerald-400">{countdownTo(latestPending.date, latestPending.time)}</div>
                </div>
              </div>
              {latestPending.agenda && (
                <div className="text-xs text-[var(--muted)] mb-3 line-clamp-2">{latestPending.agenda}</div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {latestPending.meetLink && (
                  <a href={latestPending.meetLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors">
                    <Video className="w-3 h-3" /> Join Meet
                  </a>
                )}
                <button onClick={() => updateAppointmentOutcome(prospect.id, latestPending.id, "completed")} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs hover:border-emerald-500/40 transition-colors">
                  <Check className="w-3 h-3" /> Complete
                </button>
                <button onClick={() => updateAppointmentOutcome(prospect.id, latestPending.id, "no-show")} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs hover:border-rose-500/40 transition-colors">
                  <UserX className="w-3 h-3" /> No-show
                </button>
                <button onClick={() => { setRescheduleApptId(latestPending.id); setShowBooking(true); setBookDuration(latestPending.duration); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs hover:border-blue-500/40 transition-colors">
                  <RefreshCw className="w-3 h-3" /> Reschedule
                </button>
                <button onClick={() => setCancelApptId(latestPending.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs hover:border-zinc-500/40 text-[var(--muted)] transition-colors">
                  <XCircle className="w-3 h-3" /> Cancel
                </button>
                <button
                  onClick={() => {
                    if (activeNotesApptId === latestPending.id) setActiveNotesApptId(null);
                    else { setActiveNotesApptId(latestPending.id); setMeetingNotesValue(latestPending.meetingNotes || ""); }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs hover:border-[var(--accent)]/40 transition-colors"
                >
                  <FileText className="w-3 h-3" /> Notes
                </button>
              </div>
              {cancelApptId === latestPending.id && (
                <div className="mt-3 p-3 rounded-lg bg-[var(--background)] space-y-2">
                  <label className="text-xs text-[var(--muted)]">Cancel reason</label>
                  <select value={cancelReason} onChange={(e) => setCancelReason(e.target.value as CancelReason)} className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]">
                    {cancelReasons.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <button onClick={handleCancel} className="flex-1 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-400 text-xs font-medium hover:bg-rose-500/30">Confirm</button>
                    <button onClick={() => setCancelApptId(null)} className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs hover:bg-[var(--card-hover)]">Back</button>
                  </div>
                </div>
              )}
              {activeNotesApptId === latestPending.id && (
                <div className="mt-3 space-y-2 p-3 rounded-lg bg-[var(--background)]">
                  <textarea value={meetingNotesValue} onChange={(e) => setMeetingNotesValue(e.target.value)} rows={4} placeholder="Meeting notes..." className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs focus:outline-none focus:border-[var(--accent)] resize-none" />
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveMeetingNotes(latestPending.id)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs hover:bg-[var(--card-hover)]">
                      <Save className="w-3 h-3" /> Save
                    </button>
                    <button onClick={() => handleSummarizeNotes(latestPending.id)} disabled={summarizing || !meetingNotesValue.trim()} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[rgba(232,85,61,0.1)] text-[var(--accent)] text-xs font-medium hover:bg-[rgba(232,85,61,0.2)] disabled:opacity-50">
                      {summarizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} AI Summary
                    </button>
                  </div>
                  {summarizeError && <p className="text-[10px] text-rose-400">{summarizeError}</p>}
                  {latestPending.summarizedNotes && (
                    <div className="p-2 rounded bg-[rgba(232,85,61,0.05)] border border-[rgba(232,85,61,0.1)]">
                      <div className="text-[10px] text-[var(--accent)] uppercase tracking-wider mb-1 font-medium">AI Summary</div>
                      <div className="text-xs text-[var(--muted)] whitespace-pre-wrap">{latestPending.summarizedNotes}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <p className="text-sm font-medium mb-1">No upcoming appointments</p>
              <p className="text-[11px] text-[var(--muted)] mb-3">Book a call or pick a quick slot below</p>
              <div className="flex flex-wrap gap-1.5 justify-center mb-3">
                <button onClick={() => applyQuickSlot(0, 15)} className="px-2.5 py-1 rounded-full bg-[var(--card)] border border-[var(--border)] text-[11px] hover:border-[var(--accent)]/40 transition-colors">Today 3pm</button>
                <button onClick={() => applyQuickSlot(1, 10)} className="px-2.5 py-1 rounded-full bg-[var(--card)] border border-[var(--border)] text-[11px] hover:border-[var(--accent)]/40 transition-colors">Tomorrow 10am</button>
                <button onClick={() => applyQuickSlot(1, 14)} className="px-2.5 py-1 rounded-full bg-[var(--card)] border border-[var(--border)] text-[11px] hover:border-[var(--accent)]/40 transition-colors">Tomorrow 2pm</button>
                <button onClick={() => applyQuickSlot(2, 11)} className="px-2.5 py-1 rounded-full bg-[var(--card)] border border-[var(--border)] text-[11px] hover:border-[var(--accent)]/40 transition-colors">+2 days 11am</button>
              </div>
              <button onClick={() => setShowBooking(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors">
                <Plus className="w-3.5 h-3.5" /> Custom booking
              </button>
            </div>
          )}

          {/* Tabs + list */}
          {prospect.appointments.length > 0 && !showBooking && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)]/40 overflow-hidden">
              <div className="flex items-center border-b border-[var(--border)]">
                {([
                  { key: "upcoming" as const, label: "Upcoming", count: upcomingAppointments.length },
                  { key: "past" as const, label: "Past", count: pastAppointments.length },
                ]).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setApptTab(t.key)}
                    className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${apptTab === t.key ? "text-[var(--accent)] bg-[var(--accent)]/5 border-b-2 border-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
                  >
                    {t.label} <span className="text-[10px] opacity-60">({t.count})</span>
                  </button>
                ))}
              </div>
              <div className="divide-y divide-[var(--border)] max-h-80 overflow-y-auto">
                {(apptTab === "upcoming" ? upcomingAppointments : pastAppointments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())).map((appt) => {
                  const style = outcomeStyles[appt.outcome];
                  const dotColor = appt.outcome === "completed" ? "bg-emerald-400" : appt.outcome === "no-show" ? "bg-rose-400" : appt.outcome === "rescheduled" ? "bg-blue-400" : appt.outcome === "cancelled" ? "bg-zinc-400" : "bg-amber-400";
                  const isExpanded = expandedApptId === appt.id;
                  const d = new Date(appt.date);
                  return (
                    <div key={appt.id}>
                      <button
                        onClick={() => setExpandedApptId(isExpanded ? null : appt.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--card)]/40 transition-colors text-left"
                      >
                        <div className="w-8 shrink-0 text-center leading-none">
                          <div className="text-[8px] text-[var(--muted)] uppercase font-medium tracking-wide">{d.toLocaleDateString("en-US", { month: "short" })}</div>
                          <div className="text-[13px] font-bold mt-0.5">{d.getDate()}</div>
                        </div>
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{appt.time} · {durationLabels[appt.duration]}</div>
                          {appt.agenda && <div className="text-[11px] text-[var(--muted)] truncate">{appt.agenda}</div>}
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${style.cls}`}>{style.label}</span>
                      </button>
                      {isExpanded && (appt.agenda || appt.meetingNotes || appt.summarizedNotes || appt.cancelReason || appt.meetLink) && (
                        <div className="px-3 pb-3 space-y-2 bg-[var(--background)]/40">
                          {appt.agenda && (
                            <div>
                              <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-medium mb-0.5">Agenda</div>
                              <div className="text-xs text-[var(--foreground)]">{appt.agenda}</div>
                            </div>
                          )}
                          {appt.cancelReason && (
                            <div className="text-[11px] text-[var(--muted)]">Cancel reason: <span className="text-[var(--foreground)]">{appt.cancelReason}</span></div>
                          )}
                          {appt.meetLink && (
                            <a href={appt.meetLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 hover:underline">
                              <Video className="w-3 h-3" /> Meeting link
                            </a>
                          )}
                          {appt.meetingNotes && (
                            <div>
                              <div className="text-[10px] text-[var(--muted)] uppercase tracking-wider font-medium mb-0.5">Notes</div>
                              <div className="text-xs text-[var(--foreground)] whitespace-pre-wrap">{appt.meetingNotes}</div>
                            </div>
                          )}
                          {appt.summarizedNotes && (
                            <div className="p-2 rounded-lg bg-[rgba(232,85,61,0.05)] border border-[rgba(232,85,61,0.1)]">
                              <div className="text-[10px] text-[var(--accent)] uppercase tracking-wider mb-1 font-medium flex items-center gap-1">
                                <Wand2 className="w-3 h-3" /> AI Summary
                              </div>
                              <div className="text-xs text-[var(--muted)] whitespace-pre-wrap">{appt.summarizedNotes}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {(apptTab === "upcoming" ? upcomingAppointments : pastAppointments).length === 0 && (
                  <div className="py-6 text-center text-[11px] text-[var(--muted)]">
                    {apptTab === "upcoming" ? "Nothing scheduled" : "No past appointments yet"}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2">Quick Actions</h3>
          <div className="space-y-2">
            <button
              onClick={() => setShowReceptionistBuilder(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[rgba(232,85,61,0.2)] bg-[rgba(232,85,61,0.08)] text-[var(--accent)] text-sm font-medium hover:bg-[rgba(232,85,61,0.12)] transition-colors"
            >
              <Bot className="w-4 h-4" />
              Build Receptionist
            </button>
            {currentIndex < pipeline.length - 1 && (
              <button
                onClick={() => updateStatus(prospect.id, pipeline[currentIndex + 1])}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
              >
                Move to {pipeline[currentIndex + 1]}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {prospect.phone && (
              <button
                onClick={() => setShowVoicemailModal(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--card-hover)] transition-colors"
              >
                <Voicemail className="w-4 h-4 text-amber-400" />
                Send Voicemail Drop
              </button>
            )}
          </div>
        </div>

        {/* Log call outcome */}
        {prospect.phone && (
          <div>
            <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2">Log Call Outcome</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { key: "answered", label: "Answered", cls: "text-emerald-400 hover:bg-emerald-500/10" },
                { key: "no_answer", label: "No answer", cls: "text-amber-400 hover:bg-amber-500/10" },
                { key: "voicemail", label: "Voicemail", cls: "text-blue-400 hover:bg-blue-500/10" },
                { key: "busy", label: "Busy", cls: "text-zinc-400 hover:bg-zinc-500/10" },
                { key: "wrong_number", label: "Wrong #", cls: "text-rose-400 hover:bg-rose-500/10" },
              ] as const).map((o) => (
                <button
                  key={o.key}
                  onClick={() => handleLogCall(o.key)}
                  disabled={loggingOutcome === o.key}
                  className={`px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-[11px] font-medium transition-colors disabled:opacity-50 ${o.cls}`}
                >
                  {loggingOutcome === o.key ? "..." : o.label}
                </button>
              ))}
            </div>
            {callLogs.length > 0 && (
              <div className="mt-2 text-[10px] text-[var(--muted)]">
                Last call: <span className="text-[var(--foreground)]">{callLogs[0].outcome.replace("_", " ")}</span> · {new Date(callLogs[0].created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </div>
            )}
          </div>
        )}

        {/* Conversation */}
        {prospect.phone && (
          <div>
            <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2">Conversation</h3>
            <div className="h-[420px] rounded-lg border border-[var(--border)] overflow-hidden">
              <MessageThread
                prospectId={prospect.id}
                prospectName={prospect.name}
                remoteNumber={prospect.phone}
              />
            </div>
          </div>
        )}

        {/* Sequence enrollments */}
        {enrollments.length > 0 && (() => {
          const active = enrollments.filter((e) => e.status === "active");
          const recent = enrollments.filter((e) => e.status !== "active").slice(0, 2);
          const seqName = (e: Enrollment): string => {
            const s = e.sms_sequences;
            if (!s) return "Sequence";
            return Array.isArray(s) ? (s[0]?.name ?? "Sequence") : s.name;
          };
          const statusCls = (st: string) =>
            st === "active" ? "bg-blue-500/15 text-blue-400 border-blue-500/20" :
            st === "completed" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
            st === "halted_reply" ? "bg-purple-500/15 text-purple-400 border-purple-500/20" :
            st === "halted_stop" ? "bg-rose-500/15 text-rose-400 border-rose-500/20" :
            st === "halted_failed" ? "bg-amber-500/15 text-amber-400 border-amber-500/20" :
            "bg-zinc-500/15 text-zinc-400 border-zinc-500/20";
          const statusLabel = (st: string) =>
            st === "active" ? "Active" :
            st === "completed" ? "Completed" :
            st === "halted_reply" ? "Halted (reply)" :
            st === "halted_stop" ? "Opted out" :
            st === "halted_failed" ? "Failed" :
            st === "halted_manual" ? "Halted" : st;
          const formatNext = (iso: string | null) => {
            if (!iso) return "—";
            const ms = new Date(iso).getTime() - Date.now();
            if (ms <= 0) return "due now";
            const hrs = ms / 3_600_000;
            if (hrs < 1) return `in ${Math.max(1, Math.round(ms / 60_000))}m`;
            if (hrs < 24) return `in ${Math.round(hrs)}h`;
            return `in ${Math.round(hrs / 24)}d`;
          };
          return (
            <div>
              <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2">SMS Sequences</h3>
              <div className="space-y-1.5">
                {active.map((e) => (
                  <div key={e.id} className={`rounded-lg border px-3 py-2 ${statusCls(e.status)}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{seqName(e)}</p>
                        <p className="text-[10px] opacity-80">
                          Next msg {formatNext(e.next_send_at)} · step {e.current_step_order + 1}
                        </p>
                      </div>
                      <button
                        onClick={() => handleHaltEnrollment(e.id)}
                        disabled={haltingEnrollmentId === e.id}
                        className="px-2 py-1 rounded-md border border-current text-[10px] font-medium hover:bg-current/10 disabled:opacity-50 transition-colors"
                      >
                        {haltingEnrollmentId === e.id ? "..." : "Halt"}
                      </button>
                    </div>
                  </div>
                ))}
                {recent.map((e) => (
                  <div key={e.id} className={`rounded-lg border px-3 py-1.5 ${statusCls(e.status)} opacity-70`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] truncate">{seqName(e)}</span>
                      <span className="text-[9px] font-medium uppercase tracking-wider">{statusLabel(e.status)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* SMS History */}
        {smsHistory.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2">SMS History</h3>
            <div className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)] max-h-64 overflow-y-auto">
              {smsHistory.map((m) => {
                const statusCls =
                  m.status === "delivered" ? "bg-emerald-500/15 text-emerald-400" :
                  m.status === "sent" || m.status === "queued" ? "bg-blue-500/15 text-blue-400" :
                  m.status === "failed" || m.status === "undelivered" ? "bg-rose-500/15 text-rose-400" :
                  "bg-zinc-500/15 text-zinc-400";
                return (
                  <div key={m.id} className="px-3 py-2 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-[var(--muted)]">
                        {m.direction === "outbound" ? "→ Sent" : "← Received"} · {new Date(m.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${statusCls}`}>{m.status}</span>
                    </div>
                    <div className="text-xs text-[var(--foreground)] whitespace-pre-wrap break-words">{m.body}</div>
                    {m.error_message && (
                      <div className="text-[10px] text-rose-400">{m.error_message}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
      </div>

      {showReceptionistBuilder && (
        <ReceptionistBuilderModal
          initial={{
            businessName: prospect.name || "",
            niche: prospect.service || "",
            services: prospect.service || "",
            notes: prospect.notes || "",
            gender: "auto",
          }}
          onClose={() => setShowReceptionistBuilder(false)}
        />
      )}

      <ConfirmModal
        open={showDeleteConfirm}
        title={`Delete prospect "${prospect.name}"?`}
        message="This prospect and all associated data will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          setShowDeleteConfirm(false);
          deleteProspect(prospect.id);
          onClose();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {showVoicemailModal && (
        <VoicedropModal
          prospects={[prospect]}
          onClose={() => setShowVoicemailModal(false)}
          onSent={() => loadEnrollments()}
        />
      )}

    </div>
  );
}
