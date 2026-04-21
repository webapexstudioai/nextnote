import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { assertOwnsAgent, removeAgentOwnership } from "@/lib/agentOwnership";
import { buildTools, ToolConfig, CalendarProvider } from "@/lib/tools";
import { supabaseAdmin } from "@/lib/supabase";

const BASE = "https://api.elevenlabs.io/v1/convai/agents";
const getKey = () => process.env.ELEVENLABS_API_KEY || "";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { agentId } = await params;
  try {
    await assertOwnsAgent(session.userId, agentId);
  } catch {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  const res = await fetch(`${BASE}/${agentId}`, { headers: { "xi-api-key": getKey() }, cache: "no-store" });
  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data?.detail?.message || "Failed" }, { status: res.status });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { agentId } = await params;
  try {
    await assertOwnsAgent(session.userId, agentId);
  } catch {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  const body = await req.json();
  if (body?._tool_config) {
    const cfg = body._tool_config as ToolConfig;
    const { data: settings } = await supabaseAdmin
      .from("user_settings")
      .select("calendar_provider, cal_api_key_encrypted, google_refresh_token_encrypted")
      .eq("user_id", session.userId)
      .single();
    let provider: CalendarProvider = null;
    const stored = settings?.calendar_provider as CalendarProvider | undefined;
    if (stored === "google" && settings?.google_refresh_token_encrypted) provider = "google";
    else if (stored === "cal" && settings?.cal_api_key_encrypted) provider = "cal";
    else if (settings?.google_refresh_token_encrypted) provider = "google";
    else if (settings?.cal_api_key_encrypted) provider = "cal";
    const tools = buildTools(session.userId, cfg, provider);
    body.conversation_config = body.conversation_config || {};
    body.conversation_config.agent = body.conversation_config.agent || {};
    body.conversation_config.agent.prompt = body.conversation_config.agent.prompt || {};
    body.conversation_config.agent.prompt.tools = tools;
    delete body._tool_config;
  }
  const res = await fetch(`${BASE}/${agentId}`, {
    method: "PATCH",
    headers: { "xi-api-key": getKey(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data?.detail?.message || "Failed" }, { status: res.status });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { agentId } = await params;
  try {
    await assertOwnsAgent(session.userId, agentId);
  } catch {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  const res = await fetch(`${BASE}/${agentId}`, { method: "DELETE", headers: { "xi-api-key": getKey() } });
  if (!res.ok) return NextResponse.json({ error: "Failed to delete agent" }, { status: res.status });
  await removeAgentOwnership(session.userId, agentId);
  return NextResponse.json({ success: true });
}
