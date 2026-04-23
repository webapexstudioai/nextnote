import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser, mapProspect } from "@/lib/crm";
import { deductCredits, getBalance, IMPORT_PROSPECT_CREDITS } from "@/lib/credits";

export const maxDuration = 60;

const MAX_COUNT = 100;
const MIN_COUNT = 5;

interface OutscraperPlace {
  name?: string;
  phone?: string | null;
  full_address?: string | null;
  site?: string | null;
  url?: string | null;
  subtypes?: string | null;
  type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface OutscraperResponse {
  status?: string;
  data?: OutscraperPlace[][] | OutscraperPlace[];
}

function titleCase(s: string) {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export async function POST(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const apiKey = process.env.OUTSCRAPER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Sourcing is not configured on this server." }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const niche = typeof body.niche === "string" ? body.niche.trim() : "";
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const rawCount = Number(body.count);
  const count = Math.min(MAX_COUNT, Math.max(MIN_COUNT, Number.isFinite(rawCount) ? Math.floor(rawCount) : 25));

  if (!niche) return NextResponse.json({ error: "Niche is required (e.g. 'Plumbers')." }, { status: 400 });
  if (!location) return NextResponse.json({ error: "Location is required (e.g. 'Texas' or 'Austin, TX')." }, { status: 400 });

  const totalCost = count * IMPORT_PROSPECT_CREDITS;
  const balance = await getBalance(userId);
  if (balance < totalCost) {
    return NextResponse.json(
      { error: "Insufficient credits", required: totalCost, balance },
      { status: 402 },
    );
  }

  const query = `${niche} in ${location}`;
  const params = new URLSearchParams({
    query,
    limit: String(count),
    async: "false",
    language: "en",
    region: "US",
  });

  let places: OutscraperPlace[] = [];
  try {
    const res = await fetch(`https://api.outscraper.com/maps/search-v3?${params.toString()}`, {
      headers: { "X-API-KEY": apiKey },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Outscraper error:", res.status, text);
      return NextResponse.json(
        { error: "Sourcing provider error. Try again in a moment." },
        { status: 502 },
      );
    }
    const json = (await res.json()) as OutscraperResponse;
    const data = json.data ?? [];
    // First-level array may be per-query results, flatten if nested
    if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
      places = (data as OutscraperPlace[][]).flat();
    } else {
      places = data as OutscraperPlace[];
    }
  } catch (err) {
    console.error("Outscraper fetch failed:", err);
    return NextResponse.json(
      { error: "Couldn't reach the sourcing provider. Try again shortly." },
      { status: 502 },
    );
  }

  // Keep only places that have a phone number — that's what agency owners need.
  const withPhone = places.filter((p) => p.phone && p.name).slice(0, count);

  if (withPhone.length === 0) {
    return NextResponse.json(
      { error: "No prospects with phone numbers found for this search. Try a broader niche or location." },
      { status: 404 },
    );
  }

  const actualCost = withPhone.length * IMPORT_PROSPECT_CREDITS;

  // Auto-create a folder named after the search
  const folderName = `${titleCase(niche)} — ${titleCase(location)}`;
  const { data: folder, error: folderErr } = await supabaseAdmin
    .from("folders")
    .insert({ user_id: userId, name: folderName, color: "#6366f1" })
    .select("*")
    .single();

  if (folderErr || !folder) {
    console.error("Folder create failed:", folderErr);
    return NextResponse.json({ error: "Couldn't create folder for imported prospects." }, { status: 500 });
  }

  const rows = withPhone.map((p) => ({
    user_id: userId,
    folder_id: folder.id,
    file_id: null,
    name: p.name ?? "",
    phone: p.phone ?? "",
    email: "",
    service: titleCase(niche),
    notes: "",
    address: p.full_address ?? null,
    website: p.site ?? null,
    contact_name: null,
    maps_url: p.url ?? null,
    status: "New",
    deal_value: null,
    closed_at: null,
    generated_website_id: null,
  }));

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("prospects")
    .insert(rows)
    .select("*");

  if (insertErr || !inserted) {
    console.error("Prospect insert failed:", insertErr);
    // Roll back the folder so we don't leave orphaned empty folders around
    await supabaseAdmin.from("folders").delete().eq("id", folder.id).eq("user_id", userId);
    return NextResponse.json({ error: "Couldn't save imported prospects." }, { status: 500 });
  }

  try {
    await deductCredits(userId, actualCost, {
      reason: "sources_import",
      refId: folder.id,
      metadata: { niche, location, count: withPhone.length, query },
    });
  } catch (err) {
    console.error("Credit deduction failed post-import:", err);
    // Import succeeded, billing failed — log and move on so users don't lose data.
  }

  return NextResponse.json({
    folder: { id: folder.id, name: folder.name, color: folder.color, createdAt: folder.created_at },
    prospects: inserted.map((p) => mapProspect(p, [])),
    imported: inserted.length,
    creditsSpent: actualCost,
  });
}
