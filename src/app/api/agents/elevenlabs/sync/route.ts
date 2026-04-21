import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Dev-only backfill: claims every ElevenLabs agent/phone number on the shared
 * account for the currently logged-in user.
 *
 * Requires ALLOW_AGENT_SYNC=true in env. Do NOT enable in production with
 * multiple users — it would let any logged-in user claim all agents.
 */
export async function POST() {
  if (process.env.ALLOW_AGENT_SYNC !== "true") {
    return NextResponse.json({ error: "Sync endpoint disabled. Set ALLOW_AGENT_SYNC=true to enable in dev." }, { status: 403 });
  }

  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ElevenLabs key missing" }, { status: 500 });

  const results = { agentsAdded: 0, phonesAdded: 0 };

  // Agents
  const agentsRes = await fetch("https://api.elevenlabs.io/v1/convai/agents", {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  });
  const agentsData = await agentsRes.json();
  const agents: Array<{ agent_id?: string; name?: string }> = agentsData?.agents || [];

  for (const a of agents) {
    if (!a.agent_id) continue;
    const { error } = await supabaseAdmin
      .from("user_agents")
      .insert({ user_id: session.userId, elevenlabs_agent_id: a.agent_id, name: a.name || "" });
    if (!error) results.agentsAdded += 1;
  }

  // Phone numbers
  const phonesRes = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  });
  const phonesData = await phonesRes.json();
  const phones: Array<{ phone_number_id?: string; phone_number?: string; label?: string }> =
    Array.isArray(phonesData) ? phonesData : [];

  for (const p of phones) {
    if (!p.phone_number_id) continue;
    const { error } = await supabaseAdmin
      .from("user_phone_numbers")
      .insert({
        user_id: session.userId,
        elevenlabs_phone_number_id: p.phone_number_id,
        phone_number: p.phone_number || "",
        label: p.label || "",
        twilio_sid: null,
      });
    if (!error) results.phonesAdded += 1;
  }

  return NextResponse.json({ success: true, ...results });
}
