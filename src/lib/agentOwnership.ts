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

export async function recordAgentOwnership(userId: string, agentId: string, name: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("user_agents")
    .insert({ user_id: userId, elevenlabs_agent_id: agentId, name });
  if (error) {
    console.error("recordAgentOwnership failed:", error);
    throw new Error(`Failed to record agent ownership: ${error.message}`);
  }
}

export async function recordPhoneNumberOwnership(
  userId: string,
  phoneNumberId: string,
  phoneNumber: string,
  label: string,
  twilioSid: string | null
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("user_phone_numbers")
    .insert({
      user_id: userId,
      elevenlabs_phone_number_id: phoneNumberId,
      phone_number: phoneNumber,
      label,
      twilio_sid: twilioSid,
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
