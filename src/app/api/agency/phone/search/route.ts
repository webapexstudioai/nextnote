import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/crm";

type TwilioNumber = {
  phone_number: string;
  friendly_name: string;
  locality?: string;
  region?: string;
};

type ScoredNumber = TwilioNumber & {
  score: number;
  tags: string[];
};

// Score a number on how "memorable" or "premium" it looks. Higher is better.
function scoreNumber(num: string): { score: number; tags: string[] } {
  const clean = num.replace(/\D/g, "");
  const last4 = clean.slice(-4);
  const last7 = clean.slice(-7);
  let score = 0;
  const tags: string[] = [];

  if (/^(\d)\1\1\1$/.test(last4)) {
    score += 100;
    tags.push("Quad");
  } else if (/^(\d)\1\1$/.test(last4.slice(1))) {
    score += 75;
    tags.push("Triple");
  } else if (/^(\d)\1\1$/.test(last4.slice(0, 3))) {
    score += 65;
    tags.push("Triple");
  } else if (isSequential(last4, 1)) {
    score += 85;
    tags.push("Sequential");
  } else if (isSequential(last4, -1)) {
    score += 80;
    tags.push("Sequential");
  } else if (last4[0] === last4[2] && last4[1] === last4[3] && last4[0] !== last4[1]) {
    score += 55;
    tags.push("ABAB");
  } else if (last4[0] === last4[3] && last4[1] === last4[2] && last4[0] !== last4[1]) {
    score += 50;
    tags.push("Mirror");
  } else if (last4.endsWith("000")) {
    score += 60;
    tags.push("Round");
  } else if (last4[0] === last4[1] && last4[2] === last4[3] && last4[0] !== last4[2]) {
    score += 40;
    tags.push("Pairs");
  }

  // Bonus: lots of repeated digits across the whole local part
  const counts: Record<string, number> = {};
  for (const c of last7) counts[c] = (counts[c] ?? 0) + 1;
  const max = Math.max(...Object.values(counts));
  if (max >= 5) score += 25;
  else if (max >= 4) score += 12;

  return { score, tags };
}

function isSequential(s: string, dir: 1 | -1): boolean {
  if (s.length < 4) return false;
  for (let i = 1; i < s.length; i++) {
    if (parseInt(s[i], 10) - parseInt(s[i - 1], 10) !== dir) return false;
  }
  return true;
}

async function fetchPattern(
  sid: string,
  token: string,
  countryCode: string,
  contains: string | null,
  areaCode: string | null,
  limit = 30,
): Promise<TwilioNumber[]> {
  const params = new URLSearchParams({
    Limit: String(limit),
    VoiceEnabled: "true",
    SmsEnabled: "true",
  });
  if (contains) params.set("Contains", contains);
  if (areaCode) params.set("AreaCode", areaCode);

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/AvailablePhoneNumbers/${countryCode}/Local.json?${params}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.available_phone_numbers || []) as TwilioNumber[];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser();
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      return NextResponse.json({ error: "Phone number purchasing is not configured yet." }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const mode: "best" | "areaCode" = body.mode === "best" ? "best" : "areaCode";
    const areaCode: string | null = body.areaCode ? String(body.areaCode) : null;
    const countryCode: string = body.country || "US";

    if (mode === "areaCode") {
      const nums = await fetchPattern(sid, token, countryCode, null, areaCode, 20);
      return NextResponse.json({ numbers: nums });
    }

    // BEST mode: hit Twilio with several "Contains" patterns in parallel.
    // Twilio supports * as a wildcard, so e.g. "*7777" finds numbers ending
    // in 7777. Dedupe, score, sort, return top N.
    const patterns = [
      "*7777", "*8888", "*1000", "*2000", "*5000",
      "*1234", "*2345", "*4321",
      "*1212", "*4545",
      "*0000", "*1111", "*9999",
    ];
    const results = await Promise.all(
      patterns.map((p) => fetchPattern(sid, token, countryCode, p, areaCode, 10)),
    );
    // Also include a generic batch so we have variety even if patterns return little.
    results.push(await fetchPattern(sid, token, countryCode, null, areaCode, 30));

    const seen = new Map<string, TwilioNumber>();
    for (const arr of results) {
      for (const n of arr) {
        if (!seen.has(n.phone_number)) seen.set(n.phone_number, n);
      }
    }

    const scored: ScoredNumber[] = [];
    Array.from(seen.values()).forEach((n) => {
      const { score, tags } = scoreNumber(n.phone_number);
      if (score >= 40) scored.push({ ...n, score, tags });
    });
    scored.sort((a, b) => b.score - a.score);

    return NextResponse.json({ numbers: scored.slice(0, 20) });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
