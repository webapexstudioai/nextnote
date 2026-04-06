"use client";

import { useEffect, useState, useMemo } from "react";
import { Clock, X, Video } from "lucide-react";
import { useProspects } from "@/context/ProspectsContext";
import { AppointmentRecord } from "@/types";

interface UpcomingAppt {
  prospectName: string;
  appointment: AppointmentRecord;
}

export default function AppointmentReminder() {
  const { prospects } = useProspects();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const upcoming = useMemo(() => {
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const results: UpcomingAppt[] = [];

    for (const p of prospects) {
      for (const a of p.appointments) {
        if (a.outcome !== "pending") continue;
        const apptTime = new Date(`${a.date}T${a.time}`);
        if (apptTime >= now && apptTime <= twoHoursLater) {
          results.push({ prospectName: p.name, appointment: a });
        }
      }
    }

    return results.sort(
      (a, b) =>
        new Date(`${a.appointment.date}T${a.appointment.time}`).getTime() -
        new Date(`${b.appointment.date}T${b.appointment.time}`).getTime()
    );
  }, [prospects]);

  // Request notification permission and fire desktop notifications
  useEffect(() => {
    if (upcoming.length === 0) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    if (Notification.permission === "granted") {
      for (const u of upcoming) {
        if (dismissed.has(u.appointment.id)) continue;
        const apptTime = new Date(`${u.appointment.date}T${u.appointment.time}`);
        const mins = Math.round((apptTime.getTime() - Date.now()) / 60000);
        if (mins <= 30 && mins >= 0) {
          new Notification(`Appointment with ${u.prospectName}`, {
            body: `Starting in ${mins} minutes at ${u.appointment.time}`,
            icon: "/favicon.ico",
          });
        }
      }
    }
  }, [upcoming, dismissed]);

  const visible = upcoming.filter((u) => !dismissed.has(u.appointment.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visible.map((u) => {
        const apptTime = new Date(`${u.appointment.date}T${u.appointment.time}`);
        const mins = Math.round((apptTime.getTime() - Date.now()) / 60000);
        const timeLabel = mins <= 0 ? "Now" : mins < 60 ? `in ${mins}m` : `in ${Math.floor(mins / 60)}h ${mins % 60}m`;

        return (
          <div
            key={u.appointment.id}
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {u.prospectName} &middot; <span className="text-amber-400">{timeLabel}</span>
                </p>
                <p className="text-xs text-[var(--muted)]">{u.appointment.time}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {u.appointment.meetLink && (
                <a
                  href={u.appointment.meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                >
                  <Video className="w-3 h-3" /> Join Meet
                </a>
              )}
              <button
                onClick={() => setDismissed((prev) => new Set(prev).add(u.appointment.id))}
                className="p-1.5 rounded-lg hover:bg-[var(--background)] transition-colors"
              >
                <X className="w-3.5 h-3.5 text-[var(--muted)]" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
