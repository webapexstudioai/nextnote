"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { Prospect, ProspectStatus, Folder, ProspectFile, AppointmentRecord, AppointmentDuration, AppointmentOutcome, CancelReason } from "@/types";

interface ProspectsContextType {
  prospects: Prospect[];
  folders: Folder[];
  loaded: boolean;
  googleConnected: boolean;
  setGoogleConnected: (v: boolean) => void;
  addProspect: (prospect: Prospect) => Promise<void>;
  addProspects: (prospects: Prospect[]) => Promise<void>;
  updateProspect: (id: string, updates: Partial<Prospect>) => Promise<void>;
  deleteProspect: (id: string) => Promise<void>;
  updateStatus: (id: string, status: ProspectStatus) => Promise<void>;
  bookAppointment: (
    prospectId: string,
    date: string,
    time: string,
    duration: AppointmentDuration,
    email?: string,
    meetLink?: string,
    agenda?: string,
  ) => Promise<void>;
  updateAppointmentOutcome: (prospectId: string, appointmentId: string, outcome: AppointmentOutcome, cancelReason?: CancelReason) => Promise<void>;
  updateMeetingNotes: (prospectId: string, appointmentId: string, notes: string, summarized?: string) => Promise<void>;
  rescheduleAppointment: (
    prospectId: string,
    oldAppointmentId: string,
    date: string,
    time: string,
    duration: AppointmentDuration,
    meetLink?: string,
    agenda?: string,
  ) => Promise<void>;
  refresh: () => Promise<void>;
  createFolder: (name: string, color: string) => Promise<Folder>;
  updateFolder: (id: string, updates: Partial<Folder>) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  addFileToFolder: (folderId: string, file: ProspectFile) => void;
  createFile: (folderId: string, name: string) => Promise<ProspectFile>;
  renameFile: (folderId: string, fileId: string, name: string) => Promise<void>;
  deleteFile: (folderId: string, fileId: string) => Promise<void>;
  moveProspectToFile: (prospectId: string, fileId: string | null) => Promise<void>;
}

const ProspectsContext = createContext<ProspectsContextType | null>(null);

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export function ProspectsProvider({ children }: { children: ReactNode }) {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await api("/api/crm");
      setProspects(data.prospects || []);
      setFolders(data.folders || []);
    } catch (err) {
      console.error("Failed to refresh CRM:", err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api("/api/crm");
        if (cancelled) return;
        setProspects(data.prospects || []);
        setFolders(data.folders || []);
      } catch (err) {
        console.error("Failed to load CRM:", err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addProspect = useCallback(async (prospect: Prospect) => {
    try {
      const { prospect: created } = await api("/api/crm/prospects", {
        method: "POST",
        body: JSON.stringify(prospect),
      });
      setProspects((prev) => [created, ...prev]);
    } catch (err) {
      console.error("addProspect failed:", err);
    }
  }, []);

  const addProspects = useCallback(async (newProspects: Prospect[]) => {
    if (newProspects.length === 0) return;
    try {
      const { prospects: created } = await api("/api/crm/prospects", {
        method: "POST",
        body: JSON.stringify({ prospects: newProspects }),
      });
      setProspects((prev) => [...(created as Prospect[]), ...prev]);
    } catch (err) {
      console.error("addProspects failed:", err);
    }
  }, []);

  const updateProspect = useCallback(async (id: string, updates: Partial<Prospect>) => {
    setProspects((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    try {
      await api(`/api/crm/prospects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
    } catch (err) {
      console.error("updateProspect failed:", err);
    }
  }, []);

  const deleteProspect = useCallback(async (id: string) => {
    setProspects((prev) => prev.filter((p) => p.id !== id));
    try {
      await api(`/api/crm/prospects/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("deleteProspect failed:", err);
    }
  }, []);

  const updateStatus = useCallback(async (id: string, status: ProspectStatus) => {
    setProspects((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    try {
      await api(`/api/crm/prospects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    } catch (err) {
      console.error("updateStatus failed:", err);
    }
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

      if (googleConnected) {
        try {
          const prospect = prospects.find((p) => p.id === prospectId);
          const prospectEmail = email || prospect?.email;
          const prospectName = prospect?.name || "Prospect";

          const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
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
              timeZone,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            finalMeetLink = data.meetLink || finalMeetLink;
            calendarEventId = data.calendarEventId;

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
          // fall back to DB-only booking
        }
      }

      try {
        const { appointment } = await api("/api/crm/appointments", {
          method: "POST",
          body: JSON.stringify({
            prospectId,
            date,
            time,
            duration,
            meetLink: finalMeetLink,
            agenda,
            calendarEventId,
          }),
        });

        setProspects((prev) =>
          prev.map((p) =>
            p.id === prospectId
              ? {
                  ...p,
                  email: email || p.email,
                  appointments: [...p.appointments, appointment as AppointmentRecord],
                  status: "Booked" as ProspectStatus,
                }
              : p
          )
        );
      } catch (err) {
        console.error("bookAppointment failed:", err);
      }
    },
    [googleConnected, prospects]
  );

  const updateAppointmentOutcome = useCallback(
    async (prospectId: string, appointmentId: string, outcome: AppointmentOutcome, cancelReason?: CancelReason) => {
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

      try {
        await api(`/api/crm/appointments/${appointmentId}`, {
          method: "PATCH",
          body: JSON.stringify({ outcome, ...(cancelReason ? { cancelReason } : {}) }),
        });
      } catch (err) {
        console.error("updateAppointmentOutcome failed:", err);
      }

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
    async (prospectId: string, appointmentId: string, notes: string, summarized?: string) => {
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
      try {
        await api(`/api/crm/appointments/${appointmentId}`, {
          method: "PATCH",
          body: JSON.stringify({
            meetingNotes: notes,
            ...(summarized !== undefined ? { summarizedNotes: summarized } : {}),
          }),
        });
      } catch (err) {
        console.error("updateMeetingNotes failed:", err);
      }
    },
    []
  );

  const rescheduleAppointment = useCallback(
    async (
      prospectId: string,
      oldAppointmentId: string,
      date: string,
      time: string,
      duration: AppointmentDuration,
      meetLink?: string,
      agenda?: string,
    ) => {
      try {
        const { appointment } = await api(
          `/api/crm/appointments/${oldAppointmentId}/reschedule`,
          {
            method: "POST",
            body: JSON.stringify({ date, time, duration, meetLink, agenda }),
          }
        );
        setProspects((prev) =>
          prev.map((p) =>
            p.id === prospectId
              ? {
                  ...p,
                  appointments: p.appointments
                    .map((a) =>
                      a.id === oldAppointmentId
                        ? { ...a, outcome: "rescheduled" as AppointmentOutcome }
                        : a
                    )
                    .concat(appointment as AppointmentRecord),
                }
              : p
          )
        );
      } catch (err) {
        console.error("rescheduleAppointment failed:", err);
      }
    },
    []
  );

  const createFolder = useCallback(async (name: string, color: string): Promise<Folder> => {
    const { folder } = await api("/api/crm/folders", {
      method: "POST",
      body: JSON.stringify({ name, color }),
    });
    const created = folder as Folder;
    setFolders((prev) => [...prev, created]);
    return created;
  }, []);

  const updateFolder = useCallback(async (id: string, updates: Partial<Folder>) => {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
    try {
      await api(`/api/crm/folders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
    } catch (err) {
      console.error("updateFolder failed:", err);
    }
  }, []);

  const deleteFolder = useCallback(async (id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setProspects((prev) => prev.filter((p) => p.folderId !== id));
    try {
      await api(`/api/crm/folders/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("deleteFolder failed:", err);
    }
  }, []);

  const addFileToFolder = useCallback((folderId: string, file: ProspectFile) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, files: [...f.files, file] } : f))
    );
  }, []);

  const createFile = useCallback(async (folderId: string, name: string): Promise<ProspectFile> => {
    const { file } = await api("/api/crm/files", {
      method: "POST",
      body: JSON.stringify({ folderId, name, source: "manual" }),
    });
    const created = file as ProspectFile;
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, files: [...f.files, created] } : f))
    );
    return created;
  }, []);

  const renameFile = useCallback(async (folderId: string, fileId: string, name: string) => {
    setFolders((prev) =>
      prev.map((f) =>
        f.id === folderId
          ? { ...f, files: f.files.map((file) => (file.id === fileId ? { ...file, name } : file)) }
          : f
      )
    );
    try {
      await api(`/api/crm/files/${fileId}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
    } catch (err) {
      console.error("renameFile failed:", err);
    }
  }, []);

  const deleteFile = useCallback(async (folderId: string, fileId: string) => {
    setFolders((prev) =>
      prev.map((f) =>
        f.id === folderId ? { ...f, files: f.files.filter((file) => file.id !== fileId) } : f
      )
    );
    setProspects((prev) =>
      prev.map((p) => (p.fileId === fileId ? { ...p, fileId: undefined } : p))
    );
    try {
      await api(`/api/crm/files/${fileId}`, { method: "DELETE" });
    } catch (err) {
      console.error("deleteFile failed:", err);
    }
  }, []);

  const moveProspectToFile = useCallback(async (prospectId: string, fileId: string | null) => {
    setProspects((prev) =>
      prev.map((p) => (p.id === prospectId ? { ...p, fileId: fileId ?? undefined } : p))
    );
    try {
      await api(`/api/crm/prospects/${prospectId}`, {
        method: "PATCH",
        body: JSON.stringify({ fileId }),
      });
    } catch (err) {
      console.error("moveProspectToFile failed:", err);
    }
  }, []);

  return (
    <ProspectsContext.Provider
      value={{
        prospects,
        folders,
        loaded,
        googleConnected,
        setGoogleConnected,
        refresh,
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
