"use client";

import { Prospect, ProspectStatus, AppointmentDuration, CancelReason } from "@/types";
import { X, Phone, Mail, Briefcase, FileText, Calendar, ArrowRight, Video, Sparkles, Loader2, Save, Check, XCircle, RefreshCw, UserX, Voicemail, Upload, Music, Trash2, Play, Bot, DollarSign, ExternalLink, User as UserIcon, Building2, MapPin, Globe, Pencil, Plus } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useProspects } from "@/context/ProspectsContext";
import ConfirmModal from "@/components/ui/ConfirmModal";
import InsufficientCreditsModal from "@/components/dashboard/InsufficientCreditsModal";

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

  // Voicemail drop
  const [showVoicemailModal, setShowVoicemailModal] = useState(false);
  const [vmMessage, setVmMessage] = useState("");
  const [vmCallerId, setVmCallerId] = useState("");
  const [vmSending, setVmSending] = useState(false);
  const [vmResult, setVmResult] = useState<{ success: boolean; text: string } | null>(null);

  // Voicemail tabs
  type VmTab = "upload" | "ai" | "library";
  const [vmTab, setVmTab] = useState<VmTab>("upload");

  // Upload audio state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Library state
  const [libraryFileName, setLibraryFileName] = useState("");

  // Build Receptionist
  const [showReceptionistBuilder, setShowReceptionistBuilder] = useState(false);
  const [buildingReceptionist, setBuildingReceptionist] = useState(false);
  const [receptionistError, setReceptionistError] = useState("");
  const [receptionistPaywall, setReceptionistPaywall] = useState<{ required: number; balance: number } | null>(null);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [createdAgent, setCreatedAgent] = useState<{ agentId: string; agentName: string } | null>(null);
  const [createAgentError, setCreateAgentError] = useState("");
  const [receptionistDraft, setReceptionistDraft] = useState<null | {
    agentName: string;
    firstMessage: string;
    tone: string;
    systemPrompt: string;
    knowledge: string;
    bookingFlow: string[];
    faqExamples: string[];
  }>(null);
  const [receptionistForm, setReceptionistForm] = useState<{
    businessName: string;
    niche: string;
    services: string;
    notes: string;
    mapsDescription: string;
    reviews: string;
    gender: "female" | "male" | "auto";
  }>({
    businessName: prospect.name || "",
    niche: prospect.service || "",
    services: prospect.service || "",
    notes: prospect.notes || "",
    mapsDescription: "",
    reviews: "",
    gender: "auto",
  });

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

  const ACCEPTED_AUDIO = ".mp3,.wav,.m4a";
  const ACCEPTED_MIME = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a", "audio/m4a"];

  const isValidAudioFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    return ["mp3", "wav", "m4a"].includes(ext || "") || ACCEPTED_MIME.includes(file.type);
  };

  const handleFileSelect = useCallback((file: File) => {
    if (!isValidAudioFile(file)) { // eslint-disable-line react-hooks/exhaustive-deps
      setVmResult({ success: false, text: "Only MP3, WAV, and M4A files are allowed" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setVmResult({ success: false, text: "File exceeds 10MB limit" });
      return;
    }
    setUploadFile(file);
    setUploadedUrl(null);
    setVmResult(null);
  }, []);

  const handleUploadFile = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadProgress(0);
    setVmResult(null);

    const formData = new FormData();
    formData.append("file", uploadFile);

    // Simulate progress since fetch doesn't support progress natively
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 15, 90));
    }, 200);

    try {
      const res = await fetch("/api/upload/audio", { method: "POST", body: formData });
      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await res.json();
      if (res.ok) {
        setUploadedUrl(data.url);
      } else {
        setVmResult({ success: false, text: data.error || "Upload failed" });
      }
    } catch {
      clearInterval(progressInterval);
      setVmResult({ success: false, text: "Upload failed — network error" });
    } finally {
      setUploading(false);
    }
  };

  const handleSendUploadedVoicemail = async () => {
    if (!prospect.phone || !uploadedUrl) return;
    setVmSending(true);
    setVmResult(null);
    try {
      const fullUrl = `${window.location.origin}${uploadedUrl}`;
      const res = await fetch("/api/slybroadcast/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: prospect.phone,
          audioUrl: fullUrl,
          callerId: vmCallerId.trim(),
          campaignName: `NextNote — ${prospect.name}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setVmResult({ success: true, text: "Voicemail sent successfully!" });
      } else {
        setVmResult({ success: false, text: data.error || "Failed to send voicemail" });
      }
    } catch {
      setVmResult({ success: false, text: "Network error — could not reach Slybroadcast" });
    } finally {
      setVmSending(false);
    }
  };

  const handleSendLibraryVoicemail = async () => {
    if (!prospect.phone || !libraryFileName.trim()) return;
    setVmSending(true);
    setVmResult(null);
    try {
      const res = await fetch("/api/slybroadcast/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: prospect.phone,
          message: libraryFileName.trim(),
          callerId: vmCallerId.trim(),
          campaignName: `NextNote — ${prospect.name}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setVmResult({ success: true, text: "Voicemail sent successfully!" });
      } else {
        setVmResult({ success: false, text: data.error || "Failed to send voicemail" });
      }
    } catch {
      setVmResult({ success: false, text: "Network error — could not reach Slybroadcast" });
    } finally {
      setVmSending(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSendVoicemail = async () => {
    if (!prospect.phone || !vmMessage.trim()) return;
    setVmSending(true);
    setVmResult(null);
    try {
      const isUrl = vmMessage.startsWith("http://") || vmMessage.startsWith("https://");
      const res = await fetch("/api/slybroadcast/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: prospect.phone,
          ...(isUrl ? { audioUrl: vmMessage } : { message: vmMessage }),
          campaignName: `NextNote — ${prospect.name}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setVmResult({ success: true, text: "Voicemail sent successfully!" });
      } else {
        setVmResult({ success: false, text: data.error || "Failed to send voicemail" });
      }
    } catch {
      setVmResult({ success: false, text: "Network error — could not reach Slybroadcast" });
    } finally {
      setVmSending(false);
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

  async function handleBuildReceptionist() {
    setBuildingReceptionist(true);
    setReceptionistError("");
    try {
      const res = await fetch("/api/agents/build-receptionist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(receptionistForm),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402 && typeof data.required === "number" && typeof data.balance === "number") {
          setReceptionistPaywall({ required: data.required, balance: data.balance });
          return;
        }
        throw new Error(data.error || "Failed to build receptionist");
      }
      setReceptionistDraft(data.draft || null);
    } catch (err) {
      setReceptionistError(err instanceof Error ? err.message : "Failed to build receptionist");
    } finally {
      setBuildingReceptionist(false);
    }
  }


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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Contact Details</h3>
            <span className="text-[10px] text-[var(--muted)]">Click any field to edit</span>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)]/60 divide-y divide-[var(--border)] overflow-hidden">
            {([
              { key: "name", label: "Company Name", icon: Building2, type: "text", placeholder: "Business name", multiline: false, linkHref: null as ((v: string) => string) | null, displayValue: null as ((v: string) => string) | null },
              { key: "contactName", label: "Contact Name", icon: UserIcon, type: "text", placeholder: "Who you speak with", multiline: false, linkHref: null as ((v: string) => string) | null, displayValue: null as ((v: string) => string) | null },
              { key: "phone", label: "Phone", icon: Phone, type: "tel", placeholder: "+1 555 555 5555", multiline: false, linkHref: (v: string) => `tel:${v}`, displayValue: null as ((v: string) => string) | null },
              { key: "email", label: "Email", icon: Mail, type: "email", placeholder: "name@company.com", multiline: false, linkHref: (v: string) => `mailto:${v}`, displayValue: null as ((v: string) => string) | null },
              { key: "service", label: "Service", icon: Briefcase, type: "text", placeholder: "What they need", multiline: false, linkHref: null as ((v: string) => string) | null, displayValue: null as ((v: string) => string) | null },
              { key: "address", label: "Address", icon: MapPin, type: "text", placeholder: "Street, city, state", multiline: true, linkHref: (v: string) => `https://maps.google.com/?q=${encodeURIComponent(v)}`, displayValue: null as ((v: string) => string) | null },
              { key: "website", label: "Website", icon: Globe, type: "url", placeholder: "https://example.com", multiline: false, linkHref: (v: string) => (v.startsWith("http") ? v : `https://${v}`), displayValue: null as ((v: string) => string) | null },
              { key: "mapsUrl", label: "Google Maps Link", icon: MapPin, type: "url", placeholder: "Paste Google Maps URL", multiline: false, linkHref: (v: string) => v, displayValue: (v: string) => extractMapsName(v) },
            ] as const).map(({ key, label, icon: Icon, type, placeholder, multiline, linkHref, displayValue }) => {
              const value = (prospect[key] as string | undefined) ?? "";
              const isEditing = editingField === key;
              const isEmpty = !value.trim();
              return (
                <div key={key} className="group relative flex items-start gap-3 p-3 hover:bg-[var(--card)]/40 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-medium">{label}</div>
                    {isEditing ? (
                      <div className="mt-1 flex items-center gap-2">
                        {multiline ? (
                          <textarea
                            autoFocus
                            value={fieldDraft}
                            onChange={(e) => setFieldDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setEditingField(null);
                              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveField(key);
                            }}
                            rows={2}
                            placeholder={placeholder}
                            className="flex-1 bg-[var(--card)] border border-[var(--accent)]/40 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)] resize-none"
                          />
                        ) : (
                          <input
                            autoFocus
                            type={type}
                            value={fieldDraft}
                            onChange={(e) => setFieldDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setEditingField(null);
                              if (e.key === "Enter") saveField(key);
                            }}
                            placeholder={placeholder}
                            className="flex-1 bg-[var(--card)] border border-[var(--accent)]/40 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)]"
                          />
                        )}
                        <button
                          onClick={() => saveField(key)}
                          className="p-1.5 rounded-md bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
                          aria-label="Save"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingField(null)}
                          className="p-1.5 rounded-md bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                          aria-label="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-0.5 flex items-center gap-2">
                        {isEmpty ? (
                          <button
                            onClick={() => startEditField(key)}
                            className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                          >
                            <Plus className="w-3 h-3" /> Add {label.toLowerCase()}
                          </button>
                        ) : (
                          <>
                            {linkHref ? (
                              <a
                                href={linkHref(value)}
                                target={key === "address" || key === "website" || key === "mapsUrl" ? "_blank" : undefined}
                                rel="noopener noreferrer"
                                className="text-sm text-[var(--foreground)] hover:text-[var(--accent)] transition-colors truncate"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {displayValue ? displayValue(value) : value}
                              </a>
                            ) : (
                              <span className="text-sm text-[var(--foreground)] truncate">{value}</span>
                            )}
                            <button
                              onClick={() => startEditField(key)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--muted)] hover:text-[var(--accent)] transition-all"
                              aria-label={`Edit ${label}`}
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            {prospect.phone && (
              <a href={`tel:${prospect.phone}`} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/40 transition-colors">
                <Phone className="w-3 h-3" /> Call
              </a>
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
          </div>
        </div>

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
                      {summarizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} AI Summary
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
                                <Sparkles className="w-3 h-3" /> AI Summary
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
                onClick={() => { setShowVoicemailModal(true); setVmResult(null); setVmMessage(""); setVmTab("upload"); setUploadFile(null); setUploadedUrl(null); setUploadProgress(0); setLibraryFileName(""); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--card-hover)] transition-colors"
              >
                <Voicemail className="w-4 h-4 text-amber-400" />
                Send Voicemail Drop
              </button>
            )}
          </div>
        </div>

        {/* Voicemail Drop Modal */}
        {showVoicemailModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 w-full max-w-md mx-4 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Voicemail className="w-4 h-4 text-amber-400" /> Voicemail Drop
                </h3>
                <button onClick={() => setShowVoicemailModal(false)} className="p-1 rounded-lg hover:bg-[var(--background)]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-[var(--muted)]">
                Send a ringless voicemail to <span className="text-[var(--foreground)] font-medium">{prospect.name}</span> at {prospect.phone}
              </p>

              {/* Caller ID */}
              <div>
                <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1 block">Your Callback Number (Caller ID)</label>
                <input
                  type="tel"
                  placeholder="e.g. 3125550100"
                  value={vmCallerId}
                  onChange={(e) => setVmCallerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder:text-zinc-600"
                />
                <p className="text-[10px] text-[var(--muted)] mt-1">Prospects will see this number when they get the voicemail</p>
              </div>

              {/* Tabs */}
              <div className="flex rounded-lg bg-[var(--background)] p-1 gap-1">
                {([
                  { key: "ai" as VmTab, label: "AI Generate" },
                  { key: "upload" as VmTab, label: "Upload Audio" },
                  { key: "library" as VmTab, label: "My Library" },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => { setVmTab(tab.key); setVmResult(null); }}
                    className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      vmTab === tab.key
                        ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* AI Generate Tab */}
              {vmTab === "ai" && (
                <div className="flex flex-col items-center justify-center py-8 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[rgba(232,85,61,0.1)] flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-[var(--accent)]" />
                  </div>
                  <p className="text-sm font-medium text-[var(--foreground)]">AI Voice Generation</p>
                  <p className="text-xs text-[var(--muted)] text-center">
                    Coming Soon — Generate personalized voicemail messages with AI voice cloning.
                  </p>
                </div>
              )}

              {/* Upload Audio Tab */}
              {vmTab === "upload" && (
                <div className="space-y-3">
                  {!uploadFile ? (
                    <div
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer ${
                        dragOver
                          ? "border-amber-400 bg-amber-500/5"
                          : "border-[var(--border)] hover:border-[var(--accent)]"
                      }`}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <Upload className="w-5 h-5 text-amber-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-medium text-[var(--foreground)]">
                          Drag & drop your audio file here
                        </p>
                        <p className="text-[10px] text-[var(--muted)] mt-1">
                          MP3, WAV, or M4A up to 10MB
                        </p>
                      </div>
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
                      >
                        Browse Files
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_AUDIO}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect(file);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* File info */}
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--background)]">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                          <Music className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{uploadFile.name}</p>
                          <p className="text-[10px] text-[var(--muted)]">{formatFileSize(uploadFile.size)}</p>
                        </div>
                        <button
                          onClick={() => { setUploadFile(null); setUploadedUrl(null); setUploadProgress(0); }}
                          className="p-1.5 rounded-lg hover:bg-[var(--card-hover)] text-[var(--muted)] hover:text-rose-400 transition-colors"
                          title="Remove file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Upload progress */}
                      {uploading && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[var(--muted)]">Uploading...</span>
                            <span className="text-[10px] text-[var(--muted)]">{uploadProgress}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-[var(--background)]">
                            <div
                              className="h-full rounded-full bg-amber-400 transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Audio preview */}
                      {uploadedUrl && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <Play className="w-3 h-3 text-amber-400" />
                            <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider">Preview</span>
                          </div>
                          <audio
                            controls
                            src={uploadedUrl}
                            className="w-full h-8 [&::-webkit-media-controls-panel]:bg-zinc-800 rounded"
                          />
                        </div>
                      )}

                      {/* Action buttons */}
                      {!uploadedUrl ? (
                        <button
                          onClick={handleUploadFile}
                          disabled={uploading}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          {uploading ? "Uploading..." : "Upload File"}
                        </button>
                      ) : (
                        <button
                          onClick={handleSendUploadedVoicemail}
                          disabled={vmSending}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {vmSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Voicemail className="w-4 h-4" />}
                          {vmSending ? "Sending..." : "Send Drop"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* My Library Tab */}
              {vmTab === "library" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-[var(--muted)] mb-1 block">Slybroadcast Audio File Name</label>
                    <input
                      type="text"
                      value={libraryFileName}
                      onChange={(e) => setLibraryFileName(e.target.value)}
                      placeholder="Enter the audio file name from your Slybroadcast library..."
                      className="w-full px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] placeholder:text-zinc-600"
                    />
                    <p className="text-[10px] text-[var(--muted)] mt-1.5">
                      Use the exact file name from your Slybroadcast account audio library.
                    </p>
                  </div>
                  <button
                    onClick={handleSendLibraryVoicemail}
                    disabled={vmSending || !libraryFileName.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {vmSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Voicemail className="w-4 h-4" />}
                    {vmSending ? "Sending..." : "Send Drop"}
                  </button>
                </div>
              )}

              {/* Result message (shared across tabs) */}
              {vmResult && (
                <div className={`p-3 rounded-lg text-xs font-medium ${
                  vmResult.success ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                }`}>
                  {vmResult.text}
                </div>
              )}

              {/* Close button */}
              <div className="flex justify-end">
                <button
                  onClick={() => setShowVoicemailModal(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--card-hover)] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      {showReceptionistBuilder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setShowReceptionistBuilder(false)} />
          <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)] animate-[fadeInUp_0.35s_ease-out] space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2"><Bot className="w-5 h-5 text-[var(--accent)]" /> Build Receptionist</h3>
                <p className="text-sm text-[var(--muted)] mt-1">Generate a draft AI receptionist from this prospect&apos;s business details.</p>
              </div>
              <button onClick={() => setShowReceptionistBuilder(false)} className="p-2 rounded-lg hover:bg-[var(--card-hover)] transition-colors"><X className="w-4 h-4" /></button>
            </div>

            {receptionistError && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{receptionistError}</div>}

            <div className="grid md:grid-cols-2 gap-4">
              <input value={receptionistForm.businessName} onChange={(e) => setReceptionistForm((p) => ({ ...p, businessName: e.target.value }))} placeholder="Business Name" className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm" />
              <input value={receptionistForm.niche} onChange={(e) => setReceptionistForm((p) => ({ ...p, niche: e.target.value }))} placeholder="Niche" className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm" />
              <div className="md:col-span-2">
                <p className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-2">Receptionist Gender</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["female", "male", "auto"] as const).map((g) => {
                    const active = receptionistForm.gender === g;
                    const label = g === "auto" ? "Auto (pick by niche)" : g === "female" ? "Female" : "Male";
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setReceptionistForm((p) => ({ ...p, gender: g }))}
                        className={`px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                          active
                            ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]"
                            : "border-[var(--border)] hover:bg-[var(--card-hover)] text-[var(--muted)]"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <input value={receptionistForm.services} onChange={(e) => setReceptionistForm((p) => ({ ...p, services: e.target.value }))} placeholder="Services" className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm md:col-span-2" />
              <textarea value={receptionistForm.notes} onChange={(e) => setReceptionistForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Business notes" rows={4} className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm resize-none md:col-span-2" />
              <textarea value={receptionistForm.mapsDescription} onChange={(e) => setReceptionistForm((p) => ({ ...p, mapsDescription: e.target.value }))} placeholder="Google Maps description (optional)" rows={4} className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm resize-none" />
              <textarea value={receptionistForm.reviews} onChange={(e) => setReceptionistForm((p) => ({ ...p, reviews: e.target.value }))} placeholder="Google review snippets (optional)" rows={4} className="w-full px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm resize-none" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowReceptionistBuilder(false)} className="px-4 py-3 rounded-xl border border-[var(--border)] text-sm hover:bg-[var(--card-hover)] transition-colors">Close</button>
              <button onClick={handleBuildReceptionist} disabled={buildingReceptionist} className="px-4 py-3 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors inline-flex items-center gap-2 disabled:opacity-50">
                {buildingReceptionist ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generate Draft
              </button>
            </div>

            {receptionistDraft && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-[var(--muted)]">Generated Receptionist</p>
                    <p className="text-lg font-semibold mt-1">{receptionistDraft.agentName}</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!receptionistDraft) return;
                      setCreatingAgent(true);
                      setCreateAgentError("");
                      setCreatedAgent(null);
                      try {
                        const res = await fetch("/api/agents/elevenlabs/create", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            agentName: receptionistDraft.agentName,
                            firstMessage: receptionistDraft.firstMessage,
                            systemPrompt: (receptionistDraft as { fullPrompt?: string }).fullPrompt || receptionistDraft.systemPrompt,
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "Failed to create agent");
                        setCreatedAgent({ agentId: data.agentId, agentName: data.agentName });
                        setTimeout(() => {
                          router.push("/dashboard/agents");
                        }, 1800);
                      } catch (err) {
                        setCreateAgentError(err instanceof Error ? err.message : "Failed to create agent");
                      } finally {
                        setCreatingAgent(false);
                      }
                    }}
                    disabled={creatingAgent}
                    className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {creatingAgent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                    {creatingAgent ? "Creating..." : "Make AI Receptionist"}
                  </button>
                </div>

                {createAgentError && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{createAgentError}</div>
                )}
                {createdAgent && (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 space-y-1">
                    <p className="text-sm font-semibold text-emerald-400 flex items-center gap-2"><Bot className="w-4 h-4" /> AI Receptionist Created!</p>
                    <p className="text-xs text-emerald-300">{createdAgent.agentName}</p>
                    <p className="text-[10px] font-mono text-emerald-400/60">ID: {createdAgent.agentId}</p>
                  </div>
                )}
                <div className="rounded-2xl border border-[rgba(232,85,61,0.18)] bg-[linear-gradient(180deg,rgba(232,85,61,0.08),rgba(255,255,255,0.02))] p-5">
                  <pre className="whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)] font-sans">{(receptionistDraft as { fullPrompt?: string }).fullPrompt || receptionistDraft.systemPrompt}</pre>
                </div>

                {('extractedBusinessProfile' in receptionistDraft) && (receptionistDraft as { extractedBusinessProfile?: { summary?: string; reviewInsights?: string[] } }).extractedBusinessProfile && (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-4 space-y-2">
                    <p className="text-[11px] uppercase tracking-wider text-[var(--muted)]">Extracted Business Profile</p>
                    <p className="text-sm">{(receptionistDraft as { extractedBusinessProfile?: { summary?: string } }).extractedBusinessProfile?.summary}</p>
                    <ul className="space-y-1 text-sm text-[var(--muted)] list-disc pl-5">
                      {((receptionistDraft as { extractedBusinessProfile?: { reviewInsights?: string[] } }).extractedBusinessProfile?.reviewInsights || []).map((insight, idx) => (
                        <li key={idx}>{insight}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
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

      {receptionistPaywall && (
        <InsufficientCreditsModal
          open
          onClose={() => setReceptionistPaywall(null)}
          required={receptionistPaywall.required}
          balance={receptionistPaywall.balance}
          action="Drafting an AI receptionist"
        />
      )}
    </div>
  );
}
