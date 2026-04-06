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
    },
    []
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
