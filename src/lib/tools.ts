// Builds the ElevenLabs ConvAI `tools` array for an agent based on NextNote's UI toggles.
// Tools go on conversation_config.agent.prompt.tools and get invoked mid-conversation.

import { getAppUrl } from "@/lib/appUrl";

export type CalendarProvider = "cal" | "google" | null;

export interface ToolConfig {
  transferEnabled: boolean;
  transferNumber?: string;
  transferCondition?: string;
  bookEnabled: boolean;
  rescheduleEnabled: boolean;
  availabilityEnabled: boolean;
}

interface ElevenTool {
  type: string;
  name: string;
  description?: string;
  response_timeout_secs?: number;
  params?: Record<string, unknown>;
  api_schema?: {
    url: string;
    method: string;
    request_headers?: Record<string, string>;
    request_body_schema?: Record<string, unknown>;
  };
}

function webhookTool(opts: {
  name: string;
  description: string;
  url: string;
  secret: string;
  bodySchema: { type: "object"; properties: Record<string, { type: string; description: string }>; required: string[] };
}): ElevenTool {
  return {
    type: "webhook",
    name: opts.name,
    description: opts.description,
    response_timeout_secs: 20,
    api_schema: {
      url: opts.url,
      method: "POST",
      request_headers: { "X-NextNote-Secret": opts.secret },
      request_body_schema: opts.bodySchema,
    },
  };
}

export function buildTools(userId: string, cfg: ToolConfig, provider: CalendarProvider): ElevenTool[] {
  const base = getAppUrl();
  const secret = process.env.TOOLS_WEBHOOK_SECRET || "";
  const tools: ElevenTool[] = [];

  // Every agent gets end_call so the LLM can actually hang up. Without it the
  // call idles until the platform's hard timeout fires.
  tools.push({
    type: "system",
    name: "end_call",
    description: "End the call when the caller says goodbye, confirms they have no other questions, or the conversation is clearly complete. Do not end the call while the caller is still asking questions.",
  });

  if (cfg.transferEnabled && cfg.transferNumber) {
    tools.push({
      type: "system",
      name: "transfer_to_number",
      description: "Transfer the call to a human when the caller asks or the agent cannot help.",
      params: {
        transfers: [
          {
            phone_number: cfg.transferNumber,
            condition: cfg.transferCondition || "The caller wants to speak to a human or the AI cannot resolve the request.",
          },
        ],
      },
    });
  }

  if (!provider) return tools;
  const prefix = provider === "google" ? "google" : "cal";
  const bookingRef = provider === "google"
    ? "Google Calendar event ID from the original booking."
    : "Cal.com booking UID from the original confirmation.";

  if (cfg.availabilityEnabled) {
    tools.push(webhookTool({
      name: "check_availability",
      description: "Check open slots on the user's calendar. Call this before attempting to book so you can offer real times.",
      url: `${base}/api/tools/${prefix}/availability/${userId}`,
      secret,
      bodySchema: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Start date in YYYY-MM-DD format." },
          end_date: { type: "string", description: "End date in YYYY-MM-DD format." },
        },
        required: ["start_date", "end_date"],
      },
    }));
  }

  if (cfg.bookEnabled) {
    tools.push(webhookTool({
      name: "book_appointment",
      description: "Book a new appointment on the user's calendar. Collect attendee name, email, and confirmed start time before calling.",
      url: `${base}/api/tools/${prefix}/book/${userId}`,
      secret,
      bodySchema: {
        type: "object",
        properties: {
          attendee_name: { type: "string", description: "Full name of the person booking." },
          attendee_email: { type: "string", description: "Email address for the confirmation." },
          start_time: { type: "string", description: "Appointment start time in ISO 8601 (e.g. 2026-04-20T15:00:00Z)." },
          notes: { type: "string", description: "Optional notes or agenda for the meeting." },
        },
        required: ["attendee_name", "attendee_email", "start_time"],
      },
    }));
  }

  if (cfg.rescheduleEnabled) {
    tools.push(webhookTool({
      name: "reschedule_appointment",
      description: "Move an existing appointment to a new time. Requires the original booking reference.",
      url: `${base}/api/tools/${prefix}/reschedule/${userId}`,
      secret,
      bodySchema: {
        type: "object",
        properties: {
          booking_uid: { type: "string", description: bookingRef },
          new_start_time: { type: "string", description: "New start time in ISO 8601." },
          reason: { type: "string", description: "Why the booking is being moved." },
        },
        required: ["booking_uid", "new_start_time"],
      },
    }));
  }

  return tools;
}

export function parseTools(tools: ElevenTool[] | undefined): ToolConfig {
  const cfg: ToolConfig = {
    transferEnabled: false,
    bookEnabled: false,
    rescheduleEnabled: false,
    availabilityEnabled: false,
  };
  if (!Array.isArray(tools)) return cfg;
  for (const t of tools) {
    if (t.type === "system" && t.name === "transfer_to_number") {
      cfg.transferEnabled = true;
      const transfers = (t.params as { transfers?: { phone_number?: string; condition?: string }[] })?.transfers;
      if (transfers?.[0]) {
        cfg.transferNumber = transfers[0].phone_number;
        cfg.transferCondition = transfers[0].condition;
      }
    }
    if (t.name === "book_appointment") cfg.bookEnabled = true;
    if (t.name === "reschedule_appointment") cfg.rescheduleEnabled = true;
    if (t.name === "check_availability") cfg.availabilityEnabled = true;
  }
  return cfg;
}
