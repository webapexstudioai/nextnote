"use client";

import { Prospect, ProspectStatus, AppointmentRecord, AppointmentDuration, CancelReason } from "@/types";
import { X, Phone, Mail, Briefcase, FileText, Calendar, ArrowRight, Video, Sparkles, Loader2, Save, Check, ChevronDown, ChevronUp, Clock, XCircle, RefreshCw, UserX, Voicemail, Upload, Music, Trash2, Play } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { useProspects } from "@/context/ProspectsContext";

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

export default function DetailPanel({ prospect, onClose }: DetailPanelProps) {
  const { updateStatus, bookAppointment, updateProspect, updateMeetingNotes, updateAppointmentOutcome, rescheduleAppointment, googleConnected } = useProspects();

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

  // Appointment history
  const [showHistory, setShowHistory] = useState(false);

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

  const currentIndex = pipeline.indexOf(prospect.status);

  // Get latest pending appointment
  const latestPending = [...prospect.appointments]
    .filter((a) => a.outcome === "pending")
    .sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime())[0];

  const pastAppointments = prospect.appointments.filter((a) => a.outcome !== "pending");

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
      }
    } catch {
      // silently fail
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
            sendMeetInvite && googleConnected ? "bg-[var(--accent)]" : "bg-zinc-700"
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

  const renderAppointmentCard = (appt: AppointmentRecord) => {
    const style = outcomeStyles[appt.outcome];
    return (
      <div key={appt.id} className="space-y-2">
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-emerald-400">
                  {new Date(appt.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </p>
                <p className="text-xs text-emerald-400/70">{appt.time} &middot; {durationLabels[appt.duration]}</p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${style.cls}`}>{style.label}</span>
          </div>
          {appt.agenda && (
            <div className="mt-2 pt-2 border-t border-emerald-500/20">
              <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-0.5">Agenda</p>
              <p className="text-xs text-emerald-400/70">{appt.agenda}</p>
            </div>
          )}
          {appt.meetLink && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-emerald-500/20">
              <Video className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-emerald-400">Google Meet invitation sent</span>
            </div>
          )}
        </div>

        {/* Action buttons for pending appointments */}
        {appt.outcome === "pending" && (
          <div className="flex gap-1.5">
            <button
              onClick={() => updateAppointmentOutcome(prospect.id, appt.id, "completed")}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-medium hover:bg-emerald-500/20"
            >
              <Check className="w-3 h-3" /> Completed
            </button>
            <button
              onClick={() => updateAppointmentOutcome(prospect.id, appt.id, "no-show")}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-[10px] font-medium hover:bg-rose-500/20"
            >
              <UserX className="w-3 h-3" /> No-show
            </button>
            <button
              onClick={() => {
                setRescheduleApptId(appt.id);
                setShowBooking(true);
                setBookDuration(appt.duration);
              }}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-[10px] font-medium hover:bg-blue-500/20"
            >
              <RefreshCw className="w-3 h-3" /> Reschedule
            </button>
            <button
              onClick={() => setCancelApptId(appt.id)}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-zinc-500/10 text-zinc-400 text-[10px] font-medium hover:bg-zinc-500/20"
            >
              <XCircle className="w-3 h-3" /> Cancel
            </button>
          </div>
        )}

        {/* Cancel reason dropdown */}
        {cancelApptId === appt.id && (
          <div className="p-3 rounded-lg bg-[var(--background)] space-y-2">
            <label className="text-xs text-[var(--muted)]">Cancel Reason</label>
            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value as CancelReason)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]"
            >
              {cancelReasons.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={handleCancel} className="flex-1 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-400 text-xs font-medium hover:bg-rose-500/30">
                Confirm Cancel
              </button>
              <button onClick={() => setCancelApptId(null)} className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs hover:bg-[var(--card-hover)]">
                Back
              </button>
            </div>
          </div>
        )}

        {/* Meeting Notes toggle */}
        <button
          onClick={() => {
            if (activeNotesApptId === appt.id) {
              setActiveNotesApptId(null);
            } else {
              setActiveNotesApptId(appt.id);
              setMeetingNotesValue(appt.meetingNotes || "");
            }
          }}
          className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors flex items-center justify-center gap-2"
        >
          <FileText className="w-3 h-3" />
          {activeNotesApptId === appt.id ? "Hide" : "Meeting Notes & AI Summary"}
        </button>

        {activeNotesApptId === appt.id && (
          <div className="space-y-3 p-3 rounded-lg bg-[var(--background)]">
            <div>
              <label className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-1 block">Call / Meeting Notes</label>
              <textarea
                value={meetingNotesValue}
                onChange={(e) => setMeetingNotesValue(e.target.value)}
                rows={4}
                placeholder="Type your notes from the call or meeting here..."
                className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs focus:outline-none focus:border-[var(--accent)] resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSaveMeetingNotes(appt.id)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs hover:bg-[var(--card-hover)]"
              >
                <Save className="w-3 h-3" /> Save Notes
              </button>
              <button
                onClick={() => handleSummarizeNotes(appt.id)}
                disabled={summarizing || !meetingNotesValue.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-500/10 text-indigo-400 text-xs font-medium hover:bg-indigo-500/20 disabled:opacity-50"
              >
                {summarizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {summarizing ? "Summarizing..." : "Summarize with AI"}
              </button>
            </div>

            {appt.summarizedNotes && (
              <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  <span className="text-[10px] font-medium text-indigo-400 uppercase tracking-wider">AI Summary</span>
                </div>
                <div className="text-xs text-[var(--muted)] leading-relaxed whitespace-pre-wrap">
                  {appt.summarizedNotes}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-[var(--card)] border-l border-[var(--border)] shadow-2xl z-50 slide-in overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--border)] p-5 flex items-center justify-between z-10">
        <div>
          <h2 className="text-lg font-bold">{prospect.name}</h2>
          <p className="text-sm text-[var(--muted)]">
            Added {new Date(prospect.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--background)] transition-colors">
          <X className="w-5 h-5" />
        </button>
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
                    i <= currentIndex ? pipelineColors[stage] : "bg-zinc-800"
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

        {/* Contact Info */}
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Contact Info</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--background)]">
              <Phone className="w-4 h-4 text-indigo-400" />
              <span className="text-sm">{prospect.phone || "\u2014"}</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--background)]">
              <Mail className="w-4 h-4 text-indigo-400" />
              <span className="text-sm">{prospect.email || "\u2014"}</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--background)]">
              <Briefcase className="w-4 h-4 text-indigo-400" />
              <span className="text-sm">{prospect.service || "\u2014"}</span>
            </div>
          </div>
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

        {/* Appointment */}
        <div>
          <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2">Appointment</h3>

          {/* Current / Latest pending appointment */}
          {latestPending && !showBooking ? (
            renderAppointmentCard(latestPending)
          ) : showBooking ? (
            renderBookingForm(!!rescheduleApptId)
          ) : (
            <button
              onClick={() => setShowBooking(true)}
              className="w-full px-4 py-3 rounded-lg border border-dashed border-[var(--border)] text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors flex items-center justify-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              Book Appointment
            </button>
          )}

          {/* Book new even if one exists */}
          {!showBooking && !latestPending && prospect.appointments.length > 0 && (
            <button
              onClick={() => setShowBooking(true)}
              className="w-full mt-2 px-4 py-2 rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors flex items-center justify-center gap-2"
            >
              <Calendar className="w-3 h-3" />
              Book New Appointment
            </button>
          )}
        </div>

        {/* Appointment History */}
        {pastAppointments.length > 0 && (
          <div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 text-xs font-medium text-[var(--muted)] uppercase tracking-wider hover:text-[var(--foreground)] transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              Past Appointments ({pastAppointments.length})
              {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showHistory && (
              <div className="mt-2 space-y-2">
                {pastAppointments
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((appt) => {
                    const style = outcomeStyles[appt.outcome];
                    return (
                      <div key={appt.id} className="p-3 rounded-lg bg-[var(--background)] border border-[var(--border)] opacity-70">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-[var(--muted)]" />
                            <span className="text-xs">
                              {new Date(appt.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at {appt.time}
                            </span>
                            <span className="text-[10px] text-[var(--muted)]">{durationLabels[appt.duration]}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${style.cls}`}>{style.label}</span>
                        </div>
                        {appt.cancelReason && (
                          <p className="text-[10px] text-[var(--muted)] mt-1">Reason: {appt.cancelReason}</p>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h3 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2">Quick Actions</h3>
          <div className="space-y-2">
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
                  <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-indigo-400" />
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
  );
}
