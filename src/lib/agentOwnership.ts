import { supabaseAdmin } from "@/lib/supabase";

/**
 * Throws if the user does not own the given ElevenLabs agent.
 * Use on any route that touches a specific agentId.
 */
export async function assertOwnsAgent(userId: string, agentId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("user_agents")
    .select("id")
    .eq("user_id", userId)
    .eq("elevenlabs_agent_id", agentId)
    .maybeSingle();
  if (error) throw new Error("Ownership check failed");
  if (!data) throw new Error("Agent not found or access denied");
}

export async function assertOwnsPhoneNumber(userId: string, phoneNumberId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("user_phone_numbers")
    .select("id")
    .eq("user_id", userId)
    .eq("elevenlabs_phone_number_id", phoneNumberId)
    .maybeSingle();
  if (error) throw new Error("Ownership check failed");
  if (!data) throw new Error("Phone number not found or access denied");
}

export async function listOwnedAgentIds(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("user_agents")
    .select("elevenlabs_agent_id")
    .eq("user_id", userId);
  return (data || []).map((r: { elevenlabs_agent_id: string }) => r.elevenlabs_agent_id);
}

export async function listOwnedPhoneNumberIds(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("user_phone_numbers")
    .select("elevenlabs_phone_number_id")
    .eq("user_id", userId);
  return (data || []).map((r: { elevenlabs_phone_number_id: string }) => r.elevenlabs_phone_number_id);
}

export async function recordAgentOwnership(
  userId: string,
  agentId: string,
  name: string,
  branding?: { businessName?: string | null; contactName?: string | null; businessLogoUrl?: string | null },
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("user_agents")
    .insert({
      user_id: userId,
      elevenlabs_agent_id: agentId,
      name,
      business_name: branding?.businessName?.trim() || null,
      contact_name: branding?.contactName?.trim() || null,
      business_logo_url: branding?.businessLogoUrl?.trim() || null,
    });
  if (error) {
    console.error("recordAgentOwnership failed:", error);
    throw new Error(`Failed to record agent ownership: ${error.message}`);
  }
}

export interface AgentBranding {
  businessName: string;
  contactName: string;
  logoUrl: string | null;
  ownerEmail: string;
  agencyFallbackName: string;
}

// Resolves the white-label identity for outbound communications from this agent.
// Per-agent values (set when the agent was built from a prospect) win over the
// agency owner's profile — the caller is talking to "Acme Plumbing", not the
// NextNote operator that runs Acme's account.
export async function getAgentBranding(userId: string, agentId: string): Promise<AgentBranding | null> {
  const { data: agent } = await supabaseAdmin
    .from("user_agents")
    .select("name, business_name, contact_name, business_logo_url")
    .eq("user_id", userId)
    .eq("elevenlabs_agent_id", agentId)
    .maybeSingle();
  if (!agent) return null;

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("email, name, agency_name, profile_image_url")
    .eq("id", userId)
    .maybeSingle();

  const ownerName = (user?.name as string | null)?.trim() || "";
  const agencyName = (user?.agency_name as string | null)?.trim() || "";
  const fallbackName = agencyName || ownerName || "Your business";

  const businessName = (agent.business_name as string | null)?.trim()
    || (agent.name as string | null)?.trim()
    || fallbackName;
  const contactName = (agent.contact_name as string | null)?.trim() || ownerName;
  const logoUrl = (agent.business_logo_url as string | null)?.trim()
    || (user?.profile_image_url as string | null)
    || null;

  return {
    businessName,
    contactName,
    logoUrl,
    ownerEmail: (user?.email as string | null) || "",
    agencyFallbackName: fallbackName,
  };
}

export async function recordPhoneNumberOwnership(
  userId: string,
  phoneNumberId: string,
  phoneNumber: string,
  label: string,
  twilioSid: string | null,
  stripeSubscriptionId: string | null = null,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("user_phone_numbers")
    .insert({
      user_id: userId,
      elevenlabs_phone_number_id: phoneNumberId,
      phone_number: phoneNumber,
      label,
      twilio_sid: twilioSid,
      stripe_subscription_id: stripeSubscriptionId,
    });
  if (error) {
    console.error("recordPhoneNumberOwnership failed:", error);
    throw new Error(`Failed to record phone number ownership: ${error.message}`);
  }
}

export async function removeAgentOwnership(userId: string, agentId: string): Promise<void> {
  await supabaseAdmin
    .from("user_agents")
    .delete()
    .eq("user_id", userId)
    .eq("elevenlabs_agent_id", agentId);
}

export async function removePhoneNumberOwnership(userId: string, phoneNumberId: string): Promise<void> {
  await supabaseAdmin
    .from("user_phone_numbers")
    .delete()
    .eq("user_id", userId)
    .eq("elevenlabs_phone_number_id", phoneNumberId);
}
