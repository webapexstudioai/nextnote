"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// Types from @twilio/voice-sdk we care about. We use `unknown` for the SDK
// objects themselves and cast inside the provider — keeps this file from
// depending on the SDK at module-eval time (it's lazy-loaded below).
type TwilioCall = {
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  accept: () => void;
  disconnect: () => void;
  reject: () => void;
  ignore: () => void;
  mute: (b: boolean) => void;
  isMuted: () => boolean;
  sendDigits: (digits: string) => void;
  parameters: { From?: string; To?: string; CallSid?: string };
};

type TwilioDevice = {
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  register: () => Promise<void>;
  unregister: () => Promise<void>;
  destroy: () => void;
  connect: (opts: { params: Record<string, string> }) => Promise<TwilioCall>;
  state: string;
};

export type CallStatus =
  | "idle"
  | "incoming"
  | "ringing-out"
  | "in-progress"
  | "ended";

export interface ProspectPreview {
  id: string;
  name: string;
  contactName: string | null;
  status: string | null;
  service: string | null;
  dealValue: number | string | null;
  notes: string | null;
  email: string | null;
  folderId: string | null;
  lastCall: {
    startedAt: string;
    direction: string;
    status: string;
    oneLine: string | null;
  } | null;
  lastAppointment: { scheduledAt: string; outcome: string | null } | null;
}

export interface ActiveCall {
  status: CallStatus;
  direction: "inbound" | "outbound";
  remoteNumber: string;
  prospectName?: string | null;
  prospectId?: string | null;
  prospectPreview?: ProspectPreview | null;
  startedAt: number | null;
  muted: boolean;
}

interface SoftphoneContextValue {
  available: boolean;
  setAvailable: (b: boolean) => void;
  ready: boolean;
  call: ActiveCall | null;
  answer: () => void;
  hangup: () => void;
  reject: () => void;
  toggleMute: () => void;
  sendDigit: (digit: string) => void;
  startCall: (opts: { to: string; prospectId?: string; prospectName?: string }) => Promise<void>;
  configError: string | null;
  callError: string | null;
}

const SoftphoneContext = createContext<SoftphoneContextValue | null>(null);

const HEARTBEAT_MS = 30_000;

export function SoftphoneProvider({ children }: { children: ReactNode }) {
  const [available, setAvailableState] = useState(false);
  const [ready, setReady] = useState(false);
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  const deviceRef = useRef<TwilioDevice | null>(null);
  const activeCallRef = useRef<TwilioCall | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  // Keep the ref in sync so the heartbeat closure always sees the latest.
  const availableRef = useRef(available);
  useEffect(() => {
    availableRef.current = available;
  }, [available]);

  // --- Presence on the server -------------------------------------------
  const postPresence = useCallback(async (avail: boolean) => {
    try {
      await fetch("/api/voice/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: avail }),
      });
    } catch {}
  }, []);

  // --- Browser notification helper --------------------------------------
  const fireRingNotification = useCallback((from: string) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (document.hasFocus()) return;
    if (Notification.permission !== "granted") return;
    try {
      const n = new Notification("Incoming call", { body: from, tag: "nn-incoming-call" });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {}
  }, []);

  // --- Match incoming caller to a prospect ------------------------------
  const lookupProspectByNumber = useCallback(
    async (rawNumber: string): Promise<ProspectPreview | null> => {
      try {
        const res = await fetch(
          `/api/prospects/by-number?number=${encodeURIComponent(rawNumber)}`,
        );
        if (!res.ok) return null;
        const json = await res.json();
        return json.prospect || null;
      } catch {
        return null;
      }
    },
    [],
  );

  // --- Wire up an active call's events ----------------------------------
  const wireCallEvents = useCallback(
    (twCall: TwilioCall, direction: "inbound" | "outbound", initial: Partial<ActiveCall>) => {
      activeCallRef.current = twCall;

      twCall.on("accept", () => {
        if (ringtoneRef.current) ringtoneRef.current.pause();
        setCall((prev) =>
          prev ? { ...prev, status: "in-progress", startedAt: Date.now() } : prev,
        );
      });
      twCall.on("disconnect", () => {
        if (ringtoneRef.current) ringtoneRef.current.pause();
        activeCallRef.current = null;
        setCall((prev) => (prev ? { ...prev, status: "ended" } : prev));
        // Auto-clear the dock 4s later so the user can see the "Call ended" state.
        setTimeout(() => setCall(null), 4000);
      });
      twCall.on("cancel", () => {
        if (ringtoneRef.current) ringtoneRef.current.pause();
        activeCallRef.current = null;
        setCall(null);
      });
      twCall.on("reject", () => {
        if (ringtoneRef.current) ringtoneRef.current.pause();
        activeCallRef.current = null;
        setCall(null);
      });
      twCall.on("error", (err: unknown) => {
        console.error("Twilio call error", err);
        if (ringtoneRef.current) ringtoneRef.current.pause();
        activeCallRef.current = null;
        const e = err as { code?: number | string; message?: string } | null;
        const detail = e?.message ? `${e.message}${e.code ? ` (${e.code})` : ""}` : "Call failed";
        setCallError(detail);
        setCall((prev) => (prev ? { ...prev, status: "ended" } : prev));
        setTimeout(() => setCall(null), 4000);
      });

      setCall({
        status: direction === "inbound" ? "incoming" : "ringing-out",
        direction,
        remoteNumber: initial.remoteNumber || "",
        prospectName: initial.prospectName ?? null,
        prospectId: initial.prospectId ?? null,
        prospectPreview: initial.prospectPreview ?? null,
        startedAt: null,
        muted: false,
      });
    },
    [],
  );

  // --- Initialize Twilio Device when toggled available ------------------
  const initDevice = useCallback(async () => {
    if (deviceRef.current) return;

    let tokenJson: { token?: string; error?: string };
    try {
      const res = await fetch("/api/twilio/voice/token");
      tokenJson = await res.json();
      if (!res.ok || !tokenJson.token) {
        setConfigError(tokenJson.error || "Voice token unavailable");
        return;
      }
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "Failed to fetch token");
      return;
    }

    const sdk = await import("@twilio/voice-sdk");
    const Device = sdk.Device as unknown as new (
      token: string,
      opts: Record<string, unknown>,
    ) => TwilioDevice;
    const device = new Device(tokenJson.token!, {
      logLevel: "warn",
      closeProtection: true,
    });

    device.on("registered", () => setReady(true));
    device.on("error", (err: unknown) => {
      console.error("Twilio Device error", err);
    });
    device.on("incoming", (incoming: unknown) => {
      const twCall = incoming as TwilioCall;
      const fromRaw = twCall.parameters.From || "Unknown";
      // Strip "client:" prefix when set, otherwise use as-is.
      const from = fromRaw.startsWith("client:") ? fromRaw.slice(7) : fromRaw;

      // Wire events SYNCHRONOUSLY before any await — otherwise an early
      // accept() click runs before our 'accept' handler is attached and the
      // dock never updates to "in-progress", which then drops the moment any
      // disconnect arrives.
      wireCallEvents(twCall, "inbound", {
        remoteNumber: from,
        prospectName: null,
        prospectId: null,
        prospectPreview: null,
      });

      // Ring + notify immediately.
      if (ringtoneRef.current) {
        ringtoneRef.current.currentTime = 0;
        ringtoneRef.current.play().catch(() => {});
      }
      fireRingNotification(from);

      // Hydrate the prospect preview in the background.
      lookupProspectByNumber(from)
        .then((prospect) => {
          if (!prospect) return;
          setCall((prev) =>
            prev
              ? {
                  ...prev,
                  prospectName: prospect.name,
                  prospectId: prospect.id,
                  prospectPreview: prospect,
                }
              : prev,
          );
        })
        .catch(() => {});
    });

    deviceRef.current = device;
    await device.register();
  }, [fireRingNotification, lookupProspectByNumber, wireCallEvents]);

  const teardownDevice = useCallback(async () => {
    if (!deviceRef.current) return;
    try {
      await deviceRef.current.unregister();
    } catch {}
    try {
      deviceRef.current.destroy();
    } catch {}
    deviceRef.current = null;
    setReady(false);
  }, []);

  // --- Request microphone permission while the user-gesture is still active.
  // Browsers only prompt for getUserMedia inside the gesture window from the
  // click. If we wait until after a token fetch + SDK import, Chrome/Safari
  // silently reject without ever showing the prompt.
  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setConfigError("This browser does not support microphone access. Use Chrome, Edge, or Safari.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setConfigError(null);
      return true;
    } catch (err) {
      const e = err as { name?: string; message?: string } | null;
      console.error("getUserMedia failed", e?.name, e?.message, err);
      const name = e?.name || "Error";
      const msg = (e?.message || "").toLowerCase();
      // Chrome reports "Permission denied by system" when macOS has blocked
      // the browser at the OS level even though the site-level permission
      // is granted.
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        if (msg.includes("dismiss")) {
          setConfigError("Microphone prompt was dismissed. Toggle 'Available for calls' again and click Allow.");
        } else {
          // Could be site-level OR OS-level. On macOS, even with the site
          // allowed in Chrome, the OS can block Chrome from accessing the
          // mic — and Chrome doesn't always say "system" in the error.
          setConfigError(
            "Mic blocked. Two places to check: (1) Browser: lock icon in address bar → Microphone → Allow → reload. (2) macOS only: System Settings → Privacy & Security → Microphone → enable your browser → quit & reopen the browser.",
          );
        }
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setConfigError("No microphone detected. Plug in a microphone and try again.");
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setConfigError("Microphone is in use by another app. Close other apps using the mic (Zoom, FaceTime, etc.) and try again.");
      } else {
        setConfigError(`Microphone error (${name}): ${e?.message || "unknown"}. Reload the page and try again.`);
      }
      return false;
    }
  }, []);

  // --- Public toggle ---------------------------------------------------
  const setAvailable = useCallback(
    async (b: boolean) => {
      if (b) {
        // Mic FIRST — synchronously off the click before any other async work,
        // and BEFORE Notification.requestPermission. Chrome only shows one
        // permission prompt at a time; if we kick off notifications first, the
        // mic prompt gets silently suppressed.
        const granted = await requestMicPermission();
        if (!granted) {
          setAvailableState(false);
          postPresence(false);
          return;
        }
        setAvailableState(true);
        postPresence(true);
        initDevice();
        // Now safe to request notification permission (non-blocking).
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
          Notification.requestPermission().catch(() => {});
        }
      } else {
        setAvailableState(false);
        postPresence(false);
        teardownDevice();
      }
    },
    [initDevice, postPresence, requestMicPermission, teardownDevice],
  );

  // --- Heartbeat while available --------------------------------------
  useEffect(() => {
    if (!available) {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      return;
    }
    heartbeatRef.current = setInterval(() => {
      if (availableRef.current) postPresence(true);
    }, HEARTBEAT_MS);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [available, postPresence]);

  // --- Restore presence state from server on mount --------------------
  useEffect(() => {
    let cancelled = false;
    fetch("/api/voice/presence")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.available) setAvailable(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Set on/off when tab visibility changes -------------------------
  // We don't auto-disable on hide (Twilio Device works in background tabs);
  // we only release presence on actual unmount/unload.
  useEffect(() => {
    const onUnload = () => {
      if (availableRef.current) {
        navigator.sendBeacon?.(
          "/api/voice/presence",
          new Blob([JSON.stringify({ available: false })], { type: "application/json" }),
        );
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  // --- Mount the ringtone audio element once --------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const a = new Audio("data:audio/wav;base64,UklGRn4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVoAAAB/f39/f39/f39/f39/");
    a.loop = true;
    a.volume = 0;
    ringtoneRef.current = a;
  }, []);

  // --- Public actions --------------------------------------------------
  const answer = useCallback(() => {
    setCallError(null);
    activeCallRef.current?.accept();
  }, []);

  const hangup = useCallback(() => {
    activeCallRef.current?.disconnect();
  }, []);

  const reject = useCallback(() => {
    activeCallRef.current?.reject();
  }, []);

  const toggleMute = useCallback(() => {
    if (!activeCallRef.current) return;
    const newMuted = !activeCallRef.current.isMuted();
    activeCallRef.current.mute(newMuted);
    setCall((prev) => (prev ? { ...prev, muted: newMuted } : prev));
  }, []);

  const sendDigit = useCallback((digit: string) => {
    activeCallRef.current?.sendDigits(digit);
  }, []);

  const startCall = useCallback(
    async (opts: { to: string; prospectId?: string; prospectName?: string }) => {
      if (!deviceRef.current) {
        setConfigError("Turn on 'Available for calls' first");
        return;
      }
      const twCall = await deviceRef.current.connect({
        params: {
          To: opts.to,
          ProspectId: opts.prospectId || "",
        },
      });
      wireCallEvents(twCall, "outbound", {
        remoteNumber: opts.to,
        prospectName: opts.prospectName ?? null,
        prospectId: opts.prospectId ?? null,
      });
    },
    [wireCallEvents],
  );

  const value: SoftphoneContextValue = {
    available,
    setAvailable,
    ready,
    call,
    answer,
    hangup,
    reject,
    toggleMute,
    sendDigit,
    startCall,
    configError,
    callError,
  };

  return <SoftphoneContext.Provider value={value}>{children}</SoftphoneContext.Provider>;
}

export function useSoftphone(): SoftphoneContextValue {
  const ctx = useContext(SoftphoneContext);
  if (!ctx) throw new Error("useSoftphone must be used inside SoftphoneProvider");
  return ctx;
}
