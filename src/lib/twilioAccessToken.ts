// Mints Twilio Voice access tokens for the browser SDK.
// We sign the JWT manually to avoid pulling in the full `twilio` Node SDK —
// the format is documented and stable: https://www.twilio.com/docs/iam/access-tokens

import { createHmac, randomUUID } from "crypto";

interface MintOpts {
  identity: string;
  ttlSeconds?: number;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function voiceAccessTokenConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_API_KEY_SID &&
    process.env.TWILIO_API_KEY_SECRET &&
    process.env.TWILIO_TWIML_APP_SID
  );
}

export function mintVoiceAccessToken({ identity, ttlSeconds = 3600 }: MintOpts): string {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const appSid = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !apiKeySid || !apiKeySecret || !appSid) {
    throw new Error("Twilio voice access token env vars missing");
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;

  const header = {
    alg: "HS256",
    typ: "JWT",
    cty: "twilio-fpa;v=1",
  };

  const payload = {
    jti: `${apiKeySid}-${randomUUID()}`,
    iss: apiKeySid,
    sub: accountSid,
    iat: now,
    exp,
    grants: {
      identity,
      voice: {
        incoming: { allow: true },
        outgoing: { application_sid: appSid },
      },
    },
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = createHmac("sha256", apiKeySecret).update(signingInput).digest();
  const sigB64 = base64url(sig);

  return `${signingInput}.${sigB64}`;
}

// Identities are used by Twilio to route incoming Client calls. Keep in sync
// with how the voice forward route addresses the user (`user-{userId}`).
export function softphoneIdentityFor(userId: string): string {
  return `user-${userId}`;
}
