// Builds the ElevenLabs ConvAI tool config for an agent based on NextNote's UI toggles.
// System tools (end_call, transfer_to_number) live on prompt.built_in_tools — a dict
// keyed by tool name, with each tool's params carrying a system_tool_type discriminator.
// Webhook tools still inline on prompt.tools as an array.

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

interface BuiltInTool {
  type: "system";
  name: string;
  description?: string;
  params: { system_tool_type: string; [key: string]: unknown };
}

interface WebhookTool {
  type: "webhook";
  name: string;
  description?: string;
  response_timeout_secs?: number;
  api_schema: {
    url: string;
    method: string;
    request_headers?: Record<string, string>;
    request_body_schema?: Record<string, unknown>;
  };
}

export interface BuiltTools {
  built_in_tools: Record<string, BuiltInTool>;
  webhook_tools: WebhookTool[];
}

function webhookTool(opts: {
  name: string;
  description: string;
  url: string;
  secret: string;
  bodySchema: { type: "object"; properties: Record<string, { type: string; description: string }>; required: string[] };
}): WebhookTool {
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

export function buildTools(userId: string, cfg: ToolConfig, provider: CalendarProvider): BuiltTools {
  const base = getAppUrl();
  const secret = process.env.TOOLS_WEBHOOK_SECRET || "";
  const built_in_tools: Record<string, BuiltInTool> = {};
  const webhook_tools: WebhookTool[] = [];

  // Every agent gets end_call so the LLM can actually hang up. Without it the
  // call idles until the platform's hard timeout fires.
  built_in_tools.end_call = {
    type: "system",
    name: "end_call",
    description: "End the call when the caller says goodbye, confirms they have no other questions, or the conversation is clearly complete. Do not end the call while the caller is still asking questions.",
    params: { system_tool_type: "end_call" },
  };

  if (cfg.transferEnabled && cfg.transferNumber) {
    built_in_tools.transfer_to_number = {
      type: "system",
      name: "transfer_to_number",
      description: "Transfer the call to a human when the caller asks or the agent cannot help.",
      params: {
        system_tool_type: "transfer_to_number",
        transfers: [
          {
            phone_number: cfg.transferNumber,
            condition: cfg.transferCondition || "The caller wants to speak to a human or the AI cannot resolve the request.",
          },
        ],
      },
    };
  }

  if (!provider) return { built_in_tools, webhook_tools };
  const prefix = provider === "google" ? "google" : "cal";
  const bookingRef = provider === "google"
    ? "Google Calendar event ID from the original booking."
    : "Cal.com booking UID from the original confirmation.";

  if (cfg.availabilityEnabled) {
    webhook_tools.push(webhookTool({
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
    webhook_tools.push(webhookTool({
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
    webhook_tools.push(webhookTool({
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

  return { built_in_tools, webhook_tools };
}

interface PromptToolsShape {
  tools?: Array<{ type?: string; name?: string; params?: Record<string, unknown> }>;
  built_in_tools?: Record<string, { type?: string; name?: string; params?: Record<string, unknown> } | null>;
}

export function parseTools(prompt: PromptToolsShape | undefined): ToolConfig {
  const cfg: ToolConfig = {
    transferEnabled: false,
    bookEnabled: false,
    rescheduleEnabled: false,
    availabilityEnabled: false,
  };
  if (!prompt) return cfg;

  // Read system tools from built_in_tools (canonical) first, then fall back to
  // the legacy prompt.tools array if an older agent hasn't been migrated yet.
  const builtIn = prompt.built_in_tools || {};
  const transfer = builtIn.transfer_to_number;
  if (transfer) {
    cfg.transferEnabled = true;
    const transfers = (transfer.params as { transfers?: { phone_number?: string; condition?: string }[] } | undefined)?.transfers;
    if (transfers?.[0]) {
      cfg.transferNumber = transfers[0].phone_number;
      cfg.transferCondition = transfers[0].condition;
    }
  }

  const tools = Array.isArray(prompt.tools) ? prompt.tools : [];
  for (const t of tools) {
    if (!cfg.transferEnabled && t.type === "system" && t.name === "transfer_to_number") {
      cfg.transferEnabled = true;
      const transfers = (t.params as { transfers?: { phone_number?: string; condition?: string }[] } | undefined)?.transfers;
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
