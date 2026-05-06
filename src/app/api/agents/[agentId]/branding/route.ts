import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { assertOwnsAgent } from "@/lib/agentOwnership";
import { supabaseAdmin } from "@/lib/supabase";

const MAX_NAME = 120;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { agentId } = await params;
  try {
    await assertOwnsAgent(session.userId, agentId);
  } catch {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { data } = await supabaseAdmin
    .from("user_agents")
    .select("business_name, contact_name, business_logo_url")
    .eq("user_id", session.userId)
    .eq("elevenlabs_agent_id", agentId)
    .maybeSingle();

  return NextResponse.json({
    businessName: (data?.business_name as string | null) || "",
    contactName: (data?.contact_name as string | null) || "",
    businessLogoUrl: (data?.business_logo_url as string | null) || "",
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { agentId } = await params;
  try {
    await assertOwnsAgent(session.userId, agentId);
  } catch {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const businessName = typeof body?.businessName === "string" ? body.businessName.trim().slice(0, MAX_NAME) : "";
  const contactName = typeof body?.contactName === "string" ? body.contactName.trim().slice(0, MAX_NAME) : "";

  const { error } = await supabaseAdmin
    .from("user_agents")
    .update({
      business_name: businessName || null,
      contact_name: contactName || null,
    })
    .eq("user_id", session.userId)
    .eq("elevenlabs_agent_id", agentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
