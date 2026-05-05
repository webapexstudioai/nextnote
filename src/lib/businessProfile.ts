import { supabaseAdmin } from "@/lib/supabase";

// Returns true if the user has completed the KYB form and signed the TCPA
// attestation. Required before any phone-number provisioning so we have the
// paper trail carriers expect.
export async function hasCompletedBusinessProfile(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_business_profiles")
    .select("tcpa_attested, legal_name")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data && !!data.tcpa_attested && !!data.legal_name;
}
