// Post-call analysis pipeline: download recording → Whisper transcribe →
// Claude summarize with agency-owner-focused output (pain points,
// objections, next steps). Writes results back to voice_calls.

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { phoneVariants } from "@/lib/twilio";

export interface CallSummary {
  pain_points: string[];
  weaknesses: string[];
  buying_signals: string[];
  objections: string[];
  recommended_next_steps: string[];
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  one_line_takeaway: string;
  // Caller identity extracted from the transcript when stated. We use these
  // to auto-create a prospect for inbound calls from unknown numbers — far
  // more useful than "Unknown caller" sitting in the call log forever.
  caller_name: string | null;
  caller_business: string | null;
}

const SUMMARY_SYSTEM_PROMPT = `You are an expert sales coach for digital agency owners. You analyze call transcripts between an agency owner (or their AI receptionist) and a prospective client (typically a small business owner — plumber, roofer, real estate agent, etc.).

Your job is to extract concrete, actionable insights the agency owner can use to close this prospect or improve their pitch. Focus on what the PROSPECT revealed — their business problems, frustrations with current marketing/lead gen, what they've tried, what they value, what they pushed back on.

Output strict JSON matching this shape — no prose, no markdown:
{
  "pain_points": [],            // specific business problems the prospect mentioned (lead quality, costs, time, etc.)
  "weaknesses": [],             // gaps in their current setup the agency could solve
  "buying_signals": [],         // statements showing interest, urgency, or budget
  "objections": [],             // pushback, concerns, or reasons they hesitated
  "recommended_next_steps": [], // 2-4 concrete actions the agency owner should take next
  "sentiment": "positive",      // overall: positive | neutral | negative | mixed
  "one_line_takeaway": "",      // single-sentence summary of the most important thing the agency owner should remember
  "caller_name": null,          // the prospect's first/full name if they stated it ("This is John Reyes from..."), else null
  "caller_business": null       // the prospect's business or trade if mentioned ("Reyes Plumbing", "I run a roofing company"), else null
}

Rules:
- Be specific. "They want more leads" is useless. "They get 3-4 leads/week from FB ads at $80 CPL and feel they're overpaying" is useful.
- Empty arrays are fine if a category genuinely has nothing — don't fabricate.
- Each array item is a complete short sentence (≤25 words).
- Recommended next steps must be ACTIONS the agency owner does, not the prospect.
- caller_name and caller_business: only fill if the PROSPECT (not the agent) clearly identified themselves in the transcript. Otherwise null. Do not guess.`;

async function downloadRecording(url: string): Promise<Buffer> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio creds missing");

  // Twilio recording URLs need .mp3 suffix and basic auth.
  const mp3Url = url.endsWith(".mp3") ? url : `${url}.mp3`;
  const res = await fetch(mp3Url, {
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
  });
  if (!res.ok) throw new Error(`Twilio recording fetch failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function transcribeWithWhisper(audio: Buffer): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  const openai = new OpenAI({ apiKey });

  // OpenAI's File-like input: pass a Blob with a name + type.
  const blob = new Blob([new Uint8Array(audio)], { type: "audio/mpeg" });
  const file = new File([blob], "call.mp3", { type: "audio/mpeg" });
  const result = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    response_format: "text",
  });
  // When response_format is "text", the SDK returns the raw string.
  return typeof result === "string" ? result : (result as { text?: string }).text || "";
}

async function summarizeWithClaude(transcript: string): Promise<CallSummary> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");
  const anthropic = new Anthropic({ apiKey });

  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    system: SUMMARY_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Analyze this call transcript and return the JSON.\n\nTRANSCRIPT:\n${transcript}`,
      },
    ],
  });

  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("Empty model response");

  const jsonStart = block.text.indexOf("{");
  const jsonEnd = block.text.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd < 0) throw new Error("No JSON in model response");
  const parsed = JSON.parse(block.text.slice(jsonStart, jsonEnd + 1)) as CallSummary;

  // Defensive defaults — any field can be missing if the model gets creative.
  return {
    pain_points: Array.isArray(parsed.pain_points) ? parsed.pain_points : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
    buying_signals: Array.isArray(parsed.buying_signals) ? parsed.buying_signals : [],
    objections: Array.isArray(parsed.objections) ? parsed.objections : [],
    recommended_next_steps: Array.isArray(parsed.recommended_next_steps)
      ? parsed.recommended_next_steps
      : [],
    sentiment: ["positive", "neutral", "negative", "mixed"].includes(parsed.sentiment)
      ? parsed.sentiment
      : "neutral",
    one_line_takeaway: typeof parsed.one_line_takeaway === "string" ? parsed.one_line_takeaway : "",
    caller_name: typeof parsed.caller_name === "string" && parsed.caller_name.trim()
      ? parsed.caller_name.trim().slice(0, 80)
      : null,
    caller_business: typeof parsed.caller_business === "string" && parsed.caller_business.trim()
      ? parsed.caller_business.trim().slice(0, 120)
      : null,
  };
}

// ─── Inbound prospect linking ─────────────────────────────────────────────
//
// When an inbound call comes in from a phone number we don't already have on
// file, the analysis pipeline still produces a takeaway — but without a
// linked prospect the call lives in the calls log alone. Most agency owners
// will never go scroll the calls log for unmatched calls, so the call's
// pipeline value gets lost.
//
// After analysis, look up the caller's number against the user's prospects.
// If we find a match, link it. If not, create a fresh prospect using whatever
// the model could glean from the transcript (name, business, takeaway) so
// the user has a follow-up they can act on the next morning.

const LEADS_FOLDER_NAME = "Inbound calls";
const LEADS_FOLDER_COLOR = "#10b981";

async function ensureInboundFolder(userId: string): Promise<string | null> {
  const { data: existing } = await supabaseAdmin
    .from("folders")
    .select("id")
    .eq("user_id", userId)
    .eq("name", LEADS_FOLDER_NAME)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created, error } = await supabaseAdmin
    .from("folders")
    .insert({ user_id: userId, name: LEADS_FOLDER_NAME, color: LEADS_FOLDER_COLOR })
    .select("id")
    .single();
  if (error || !created) return null;
  return created.id;
}

function buildProspectName(summary: CallSummary, fromNumber: string): string {
  if (summary.caller_name && summary.caller_business) {
    return `${summary.caller_name} — ${summary.caller_business}`;
  }
  if (summary.caller_business) return summary.caller_business;
  if (summary.caller_name) return summary.caller_name;
  // Fallback: human-readable phone last 4.
  const digits = fromNumber.replace(/\D/g, "");
  const last4 = digits.slice(-4) || "????";
  return `Inbound caller (${last4})`;
}

function buildProspectNotes(summary: CallSummary, fromNumber: string): string {
  const parts: string[] = [];
  parts.push(`Auto-created from inbound call ${fromNumber}.`);
  if (summary.one_line_takeaway) parts.push(summary.one_line_takeaway);
  if (summary.pain_points.length) {
    parts.push(`Pain points:\n• ${summary.pain_points.slice(0, 3).join("\n• ")}`);
  }
  if (summary.recommended_next_steps.length) {
    parts.push(`Next steps:\n• ${summary.recommended_next_steps.slice(0, 3).join("\n• ")}`);
  }
  return parts.join("\n\n");
}

async function linkOrCreateInboundProspect(opts: {
  voiceCallId: string;
  userId: string;
  fromNumber: string;
  durationSec: number;
  summary: CallSummary;
}): Promise<void> {
  const { voiceCallId, userId, fromNumber, durationSec, summary } = opts;
  if (!fromNumber) return;

  // Skip junk: no takeaway AND short call → nothing worth pinning to a prospect.
  if (!summary.one_line_takeaway && durationSec < 20) return;

  const variants = phoneVariants(fromNumber);

  // 1. Exact phone match against the user's prospects.
  const { data: matches } = await supabaseAdmin
    .from("prospects")
    .select("id")
    .eq("user_id", userId)
    .in("phone", variants)
    .limit(1);
  let prospectId = matches?.[0]?.id ?? null;

  // 2. Fuzzy fallback — last 10 digits anywhere in the stored phone string.
  if (!prospectId) {
    const digits = fromNumber.replace(/\D/g, "");
    if (digits.length >= 10) {
      const last10 = digits.slice(-10);
      const { data: fuzzy } = await supabaseAdmin
        .from("prospects")
        .select("id")
        .eq("user_id", userId)
        .ilike("phone", `%${last10}%`)
        .limit(1);
      if (fuzzy && fuzzy.length > 0) prospectId = fuzzy[0].id;
    }
  }

  // 3. Create a fresh prospect if we still have nothing.
  if (!prospectId) {
    const folderId = await ensureInboundFolder(userId);
    const { data: created, error } = await supabaseAdmin
      .from("prospects")
      .insert({
        user_id: userId,
        folder_id: folderId,
        name: buildProspectName(summary, fromNumber),
        phone: fromNumber,
        notes: buildProspectNotes(summary, fromNumber),
        service: summary.caller_business || null,
        status: "New",
        source: "inbound_call",
      })
      .select("id")
      .single();
    if (error || !created) return;
    prospectId = created.id;
  }

  await supabaseAdmin
    .from("voice_calls")
    .update({ prospect_id: prospectId })
    .eq("id", voiceCallId);
}

export async function analyzeCall(voiceCallId: string): Promise<void> {
  const { data: call, error } = await supabaseAdmin
    .from("voice_calls")
    .select("id, user_id, recording_url, transcript, recording_duration_sec, direction, prospect_id, from_number")
    .eq("id", voiceCallId)
    .maybeSingle();

  if (error || !call?.recording_url) return;

  // Skip very short recordings — nothing useful to summarize.
  if ((call.recording_duration_sec ?? 0) < 8) {
    await supabaseAdmin
      .from("voice_calls")
      .update({
        ai_summary: { one_line_takeaway: "Call too short to analyze.", sentiment: "neutral" },
        ai_summary_generated_at: new Date().toISOString(),
      })
      .eq("id", voiceCallId);
    return;
  }

  let transcript = call.transcript;
  if (!transcript) {
    const audio = await downloadRecording(call.recording_url);
    transcript = await transcribeWithWhisper(audio);
    await supabaseAdmin.from("voice_calls").update({ transcript }).eq("id", voiceCallId);
  }

  if (!transcript.trim()) return;

  const summary = await summarizeWithClaude(transcript);
  await supabaseAdmin
    .from("voice_calls")
    .update({
      ai_summary: summary,
      ai_summary_generated_at: new Date().toISOString(),
    })
    .eq("id", voiceCallId);

  // Inbound from an unknown number → match or create a prospect so the
  // takeaway lands in the user's CRM, not the bottom of the calls log.
  if (call.direction === "inbound" && !call.prospect_id && call.user_id && call.from_number) {
    try {
      await linkOrCreateInboundProspect({
        voiceCallId: call.id,
        userId: call.user_id,
        fromNumber: call.from_number,
        durationSec: call.recording_duration_sec ?? 0,
        summary,
      });
    } catch (err) {
      console.error("inbound prospect linking failed", { id: call.id, err });
    }
  }
}
