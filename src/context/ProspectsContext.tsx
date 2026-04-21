"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { Prospect, ProspectStatus, Folder, ProspectFile, AppointmentRecord, AppointmentDuration, AppointmentOutcome, CancelReason } from "@/types";

const PROSPECTS_KEY = "nextnote_prospects";
const FOLDERS_KEY = "nextnote_folders";

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore parse errors */ }
  return fallback;
}

interface ProspectsContextType {
  prospects: Prospect[];
  folders: Folder[];
  googleConnected: boolean;
  setGoogleConnected: (v: boolean) => void;
  addProspect: (prospect: Prospect) => void;
  addProspects: (prospects: Prospect[]) => void;
  updateProspect: (id: string, updates: Partial<Prospect>) => void;
  deleteProspect: (id: string) => void;
  updateStatus: (id: string, status: ProspectStatus) => void;
  bookAppointment: (
    prospectId: string,
    date: string,
    time: string,
    duration: AppointmentDuration,
    email?: string,
    meetLink?: string,
    agenda?: string,
  ) => Promise<void> | void;
  updateAppointmentOutcome: (prospectId: string, appointmentId: string, outcome: AppointmentOutcome, cancelReason?: CancelReason) => void;
  updateMeetingNotes: (prospectId: string, appointmentId: string, notes: string, summarized?: string) => void;
  rescheduleAppointment: (
    prospectId: string,
    oldAppointmentId: string,
    date: string,
    time: string,
    duration: AppointmentDuration,
    meetLink?: string,
    agenda?: string,
  ) => void;
  createFolder: (name: string, color: string) => Folder;
  updateFolder: (id: string, updates: Partial<Folder>) => void;
  deleteFolder: (id: string) => void;
  addFileToFolder: (folderId: string, file: ProspectFile) => void;
  createFile: (folderId: string, name: string) => ProspectFile;
  renameFile: (folderId: string, fileId: string, name: string) => void;
  deleteFile: (folderId: string, fileId: string) => void;
  moveProspectToFile: (prospectId: string, fileId: string | null) => void;
}

const ProspectsContext = createContext<ProspectsContextType | null>(null);

export function ProspectsProvider({ children }: { children: ReactNode }) {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setProspects(loadFromStorage<Prospect[]>(PROSPECTS_KEY, []));
    setFolders(loadFromStorage<Folder[]>(FOLDERS_KEY, []));
    setHydrated(true);
  }, []);

  // Persist prospects to localStorage
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(PROSPECTS_KEY, JSON.stringify(prospects));
  }, [prospects, hydrated]);

  // Persist folders to localStorage
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  }, [folders, hydrated]);

  const addProspect = useCallback((prospect: Prospect) => {
    setProspects((prev) => [prospect, ...prev]);
  }, []);

  const addProspects = useCallback((newProspects: Prospect[]) => {
    setProspects((prev) => [...newProspects, ...prev]);
  }, []);

  const updateProspect = useCallback((id: string, updates: Partial<Prospect>) => {
    setProspects((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  }, []);

  const deleteProspect = useCallback((id: string) => {
    setProspects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updateStatus = useCallback((id: string, status: ProspectStatus) => {
    setProspects((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  }, []);

  const bookAppointment = useCallback(
    async (
      prospectId: string,
      date: string,
      time: string,
      duration: AppointmentDuration,
      email?: string,
      meetLink?: string,
      agenda?: string,
    ) => {
      let finalMeetLink = meetLink;
      let calendarEventId: string | undefined;

      // If Google is connected, create a real calendar event
      if (googleConnected) {
        try {
          const prospect = prospects.find((p) => p.id === prospectId);
          const prospectEmail = email || prospect?.email;
          const prospectName = prospect?.name || "Prospect";

          const res = await fetch("/api/appointments/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prospectName,
              prospectEmail,
              date,
              time,
              duration,
              agenda,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            finalMeetLink = data.meetLink || finalMeetLink;
            calendarEventId = data.calendarEventId;

            // Auto-send confirmation email
            if (prospectEmail) {
              fetch("/api/appointments/confirm-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  prospectName,
                  prospectEmail,
                  date,
                  time,
                  duration,
                  agenda,
                  meetLink: finalMeetLink,
                }),
              }).catch(() => {});
            }
          }
        } catch {
          // Fall back to local-only booking
        }
      }

      const newAppt: AppointmentRecord = {
        id: `appt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date,
        time,
        duration,
        meetLink: finalMeetLink,
        calendarEventId,
        agenda,
        outcome: "pending",
        createdAt: new Date().toISOString(),
      };
      setProspects((prev) =>
        prev.map((p) =>
          p.id === prospectId
            ? {
                ...p,
                email: email || p.email,
                appointments: [...p.appointments, newAppt],
                status: "Booked" as ProspectStatus,
              }
            : p
        )
      );
    },
    [googleConnected, prospects]
  );

  const updateAppointmentOutcome = useCallback(
    (prospectId: string, appointmentId: string, outcome: AppointmentOutcome, cancelReason?: CancelReason) => {
      // Find the appointment to pull the calendarEventId before state update
      const prospect = prospects.find((p) => p.id === prospectId);
      const appt = prospect?.appointments.find((a) => a.id === appointmentId);

      setProspects((prev) =>
        prev.map((p) =>
          p.id === prospectId
            ? {
                ...p,
                appointments: p.appointments.map((a) =>
                  a.id === appointmentId ? { ...a, outcome, ...(cancelReason ? { cancelReason } : {}) } : a
                ),
              }
            : p
        )
      );

      // Delete the Google Calendar event when cancelling
      if (outcome === "cancelled" && appt?.calendarEventId && googleConnected) {
        fetch("/api/appointments/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calendarEventId: appt.calendarEventId }),
        }).catch((err) => console.error("Failed to cancel calendar event:", err));
      }
    },
    [prospects, googleConnected]
  );

  const updateMeetingNotes = useCallback(
    (prospectId: string, appointmentId: string, notes: string, summarized?: string) => {
      setProspects((prev) =>
        prev.map((p) =>
          p.id === prospectId
            ? {
                ...p,
                appointments: p.appointments.map((a) =>
                  a.id === appointmentId
                    ? { ...a, meetingNotes: notes, ...(summarized !== undefined ? { summarizedNotes: summarized } : {}) }
                    : a
                ),
              }
            : p
        )
      );
    },
    []
  );

  const rescheduleAppointment = useCallback(
    (
      prospectId: string,
      oldAppointmentId: string,
      date: string,
      time: string,
      duration: AppointmentDuration,
      meetLink?: string,
      agenda?: string,
    ) => {
      const newAppt: AppointmentRecord = {
        id: `appt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date,
        time,
        duration,
        meetLink,
        agenda,
        outcome: "pending",
        createdAt: new Date().toISOString(),
      };
      setProspects((prev) =>
        prev.map((p) =>
          p.id === prospectId
            ? {
                ...p,
                appointments: p.appointments.map((a) =>
                  a.id === oldAppointmentId ? { ...a, outcome: "rescheduled" as AppointmentOutcome } : a
                ).concat(newAppt),
              }
            : p
        )
      );
    },
    []
  );

  const createFolder = useCallback((name: string, color: string): Folder => {
    const folder: Folder = {
      id: `folder-${Date.now()}`,
      name,
      color,
      createdAt: new Date().toISOString().split("T")[0],
      files: [],
    };
    setFolders((prev) => [...prev, folder]);
    return folder;
  }, []);

  const updateFolder = useCallback((id: string, updates: Partial<Folder>) => {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const deleteFolder = useCallback((id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setProspects((prev) => prev.filter((p) => p.folderId !== id));
  }, []);

  const addFileToFolder = useCallback((folderId: string, file: ProspectFile) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, files: [...f.files, file] } : f))
    );
  }, []);

  const createFile = useCallback((folderId: string, name: string): ProspectFile => {
    const file: ProspectFile = {
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      folderId,
      createdAt: new Date().toISOString().split("T")[0],
      source: "manual",
      prospectCount: 0,
    };
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, files: [...f.files, file] } : f))
    );
    return file;
  }, []);

  const renameFile = useCallback((folderId: string, fileId: string, name: string) => {
    setFolders((prev) =>
      prev.map((f) =>
        f.id === folderId
          ? { ...f, files: f.files.map((file) => (file.id === fileId ? { ...file, name } : file)) }
          : f
      )
    );
  }, []);

  const deleteFile = useCallback((folderId: string, fileId: string) => {
    setFolders((prev) =>
      prev.map((f) =>
        f.id === folderId ? { ...f, files: f.files.filter((file) => file.id !== fileId) } : f
      )
    );
    // Unassign prospects from the deleted file (keep them in the folder)
    setProspects((prev) =>
      prev.map((p) => (p.fileId === fileId ? { ...p, fileId: undefined } : p))
    );
  }, []);

  const moveProspectToFile = useCallback((prospectId: string, fileId: string | null) => {
    setProspects((prev) =>
      prev.map((p) => (p.id === prospectId ? { ...p, fileId: fileId ?? undefined } : p))
    );
  }, []);

  return (
    <ProspectsContext.Provider
      value={{
        prospects,
        folders,
        googleConnected,
        setGoogleConnected,
        addProspect,
        addProspects,
        updateProspect,
        deleteProspect,
        updateStatus,
        bookAppointment,
        updateMeetingNotes,
        updateAppointmentOutcome,
        rescheduleAppointment,
        createFolder,
        updateFolder,
        deleteFolder,
        addFileToFolder,
        createFile,
        renameFile,
        deleteFile,
        moveProspectToFile,
      }}
    >
      {children}
    </ProspectsContext.Provider>
  );
}

export function useProspects() {
  const context = useContext(ProspectsContext);
  if (!context) throw new Error("useProspects must be used within ProspectsProvider");
  return context;
}
