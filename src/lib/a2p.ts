// Twilio Trust Hub / A2P 10DLC helpers. Multi-stage carrier compliance:
//   1. Customer Profile (business identity bundle)        — this file, stage 1
//   2. A2P Trust Product (links profile → A2P)            — stage 2 (TODO)
//   3. Brand Registration (TCR brand)                     — stage 3 (TODO)
//   4. Messaging Service + Campaign                        — stage 4 (TODO)
//
// We start by submitting the Customer Profile because nothing else can move
// forward until that's approved by Twilio (~ minutes to a few days).

const TRUST_HUB = "https://trusthub.twilio.com/v1";

type BusinessProfile = {
  legal_name: string;
  ein: string | null;
  business_type: string | null;
  website: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  rep_name: string;
  rep_email: string;
  rep_title: string | null;
  rep_phone: string | null;
};

function authHeader(): string {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  return `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;
}

async function trustHubFetch<T = unknown>(
  path: string,
  method: "GET" | "POST",
  body?: Record<string, string>,
): Promise<T> {
  const url = `${TRUST_HUB}${path}`;
  const init: RequestInit = {
    method,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  if (body) init.body = new URLSearchParams(body).toString();
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.message || data?.detail || `Twilio Trust Hub ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

interface CustomerProfileResponse {
  sid: string;
  status: string;
  friendly_name: string;
}
interface EndUserResponse {
  sid: string;
}
interface SupportingDocumentResponse {
  sid: string;
}

export interface SubmitCustomerProfileResult {
  customer_profile_sid: string;
  end_user_sid: string;
  status: string;
}

// One-shot: builds a primary Customer Profile, attaches an End User (authorized
// rep) and address support doc, then submits it to Twilio for review.
export async function submitCustomerProfile(
  userEmail: string,
  profile: BusinessProfile,
): Promise<SubmitCustomerProfileResult> {
  // 1. Create the customer profile shell (business_info policy = primary).
  const cp = await trustHubFetch<CustomerProfileResponse>(
    "/CustomerProfiles",
    "POST",
    {
      FriendlyName: profile.legal_name,
      Email: profile.rep_email || userEmail,
      PolicySid: "RNdfbf3fae0e1107f8aded0e7cead80bf5", // "primary_customer_profile_policy"
    },
  );

  // 2. Create authorized representative as an EndUser.
  const repNames = profile.rep_name.split(/\s+/);
  const firstName = repNames[0] || profile.rep_name;
  const lastName = repNames.slice(1).join(" ") || ".";
  const endUser = await trustHubFetch<EndUserResponse>(
    "/EndUsers",
    "POST",
    {
      FriendlyName: `${profile.rep_name} (rep)`,
      Type: "authorized_representative_1",
      Attributes: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email: profile.rep_email,
        phone_number: profile.rep_phone || "",
        business_title: profile.rep_title || "Owner",
        job_position: profile.rep_title || "Owner",
      }),
    },
  );

  // 3. Address as a supporting document.
  const supportingDoc = await trustHubFetch<SupportingDocumentResponse>(
    "/SupportingDocuments",
    "POST",
    {
      FriendlyName: `${profile.legal_name} address`,
      Type: "customer_profile_address",
      Attributes: JSON.stringify({
        address_sids: [],
        business_name: profile.legal_name,
        business_registration_number: profile.ein || "",
        business_registration_identifier: profile.ein ? "EIN" : "none",
        business_identity: mapBusinessType(profile.business_type),
        business_industry: "OTHER",
        business_type: mapBusinessType(profile.business_type),
        business_regions_of_operation: "USA_AND_CANADA",
        website_url: profile.website || "",
        social_media_profile_urls: "",
        street: profile.address_line1,
        street_secondary: profile.address_line2 || "",
        city: profile.city,
        region: profile.region,
        postal_code: profile.postal_code,
        iso_country: profile.country || "US",
      }),
    },
  );

  // 4. Attach the EndUser and SupportingDocument to the Customer Profile.
  await trustHubFetch(
    `/CustomerProfiles/${cp.sid}/EntityAssignments`,
    "POST",
    { ObjectSid: endUser.sid },
  );
  await trustHubFetch(
    `/CustomerProfiles/${cp.sid}/EntityAssignments`,
    "POST",
    { ObjectSid: supportingDoc.sid },
  );

  // 5. Submit for evaluation.
  await trustHubFetch(`/CustomerProfiles/${cp.sid}`, "POST", {
    Status: "pending-review",
  });

  return {
    customer_profile_sid: cp.sid,
    end_user_sid: endUser.sid,
    status: "profile_pending",
  };
}

export async function getCustomerProfileStatus(
  customerProfileSid: string,
): Promise<{ status: string; failure_reason?: string }> {
  const data = await trustHubFetch<{ status: string; failure_reason?: string }>(
    `/CustomerProfiles/${customerProfileSid}`,
    "GET",
  );
  return { status: data.status, failure_reason: data.failure_reason };
}

function mapBusinessType(t: string | null): string {
  switch ((t || "").toLowerCase()) {
    case "llc":
      return "Limited Liability Corporation";
    case "corp":
      return "Corporation";
    case "sole_prop":
      return "Sole Proprietorship";
    case "nonprofit":
      return "Non-profit Corporation";
    default:
      return "Limited Liability Corporation";
  }
}
