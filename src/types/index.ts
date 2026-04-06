export type ProspectStatus = "New" | "Contacted" | "Qualified" | "Booked" | "Closed";

export type AppointmentDuration = 15 | 30 | 45 | 60 | 90;

export type AppointmentOutcome = "pending" | "completed" | "no-show" | "rescheduled" | "cancelled";

export type CancelReason = "Changed mind" | "Not a fit" | "No response" | "Other";

export interface AppointmentRecord {
  id: string;
  date: string;
  time: string;
  duration: AppointmentDuration;
  meetLink?: string;
  agenda?: string;
  meetingNotes?: string;
  summarizedNotes?: string;
  outcome: AppointmentOutcome;
  cancelReason?: CancelReason;
  createdAt: string;
  calendarEventId?: string;
}

export interface Prospect {
  id: string;
  name: string;
  phone: string;
  email: string;
  service: string;
  notes: string;
  status: ProspectStatus;
  createdAt: string;
  folderId: string;
  fileId?: string;
  appointments: AppointmentRecord[];
}

export interface ProspectFile {
  id: string;
  name: string;
  folderId: string;
  createdAt: string;
  source: "xlsx" | "google-sheets" | "manual";
  prospectCount: number;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  files: ProspectFile[];
}

export interface StatsData {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  booked: number;
  closed: number;
}

export const FOLDER_COLORS = [
  { name: "Indigo", value: "#6366f1" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Emerald", value: "#10b981" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Orange", value: "#f97316" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
  { name: "Teal", value: "#14b8a6" },
];
