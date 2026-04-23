import crypto from "crypto";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { getUserAIConfig, aiChat } from "@/lib/ai";
import { getBalance, deductCredits, WEBSITE_GENERATION_CREDITS, WEBSITE_WHITELABEL_CREDITS } from "@/lib/credits";
import { supabaseAdmin } from "@/lib/supabase";
import { generateBusinessLogo } from "@/lib/logo";

type ServiceSpec = { name: string; keyword: string };

type PaletteHint = {
  label: string;
  mood: string;
  primary: string;
  accent: string;
  background: string;
  text: string;
  gradients: string;
  imageryHint: string;
  heroImageQuery: string;
  heroImageAlt: string;
  logoConcept: string;
  services: ServiceSpec[];
};

function paletteForNiche(raw: string | undefined | null): PaletteHint {
  const niche = (raw || "").toLowerCase();
  const match = (keywords: string[]) => keywords.some((k) => niche.includes(k));

  if (match(["roof", "gutter", "siding"])) {
    return {
      label: "Roofing / Exterior",
      mood: "rugged, trustworthy, weather-proof, dependable craftsmanship",
      primary: "#1e3a5f",
      accent: "#e87722",
      background: "#ffffff with #f7f7f5 alternating sections",
      text: "#1a1a1a body, #6b7280 secondary",
      gradients: "slate → midnight hero overlay only",
      imageryHint: "roofer on a rooftop, asphalt shingles close-up, dramatic sky, branded work truck",
      heroImageQuery: "roofing",
      heroImageAlt: "roofing contractor installing shingles on a home",
      logoConcept: "an ACTUAL house with a peaked roof — the roof must be the dominant feature (thick triangular top), with a simple square/rectangle body underneath and optionally a small chimney. The viewer must immediately recognize 'house / roof' — not an abstract chevron.",
      services: [
        { name: "Roof Replacement", keyword: "roof replacement shingles" },
        { name: "Roof Repair", keyword: "roof repair worker" },
        { name: "Storm Damage Repair", keyword: "storm damage roof" },
        { name: "Gutter Installation", keyword: "gutter installation house" },
        { name: "Roof Inspection", keyword: "roof inspector clipboard" },
        { name: "Commercial Roofing", keyword: "commercial flat roof" },
      ],
    };
  }
  if (match(["landscap", "lawn", "garden", "tree", "nursery", "outdoor living", "pest control", "arborist"])) {
    return {
      label: "Landscaping / Outdoor",
      mood: "fresh, organic, grounded, trustworthy outdoor craftsmanship",
      primary: "#1a3d2e",
      accent: "#84a98c",
      background: "#ffffff with #f7f9f5 alternating sections",
      text: "#1a1a1a body, #6b7280 secondary",
      gradients: "forest → sage hero overlay only",
      imageryHint: "lush lawns, stone patios, trimmed hedges, golden sunlight through trees",
      heroImageQuery: "landscaping",
      heroImageAlt: "manicured landscaped yard with lush green grass and trees",
      logoConcept: "an ACTUAL tree — either (a) a pine/fir tree: triangular layered canopy with a small trunk at the bottom, or (b) a deciduous tree: a round leafy crown on a short trunk. The tree must be instantly recognizable as a tree, not an abstract leaf.",
      services: [
        { name: "Lawn Care & Mowing", keyword: "lawn mower grass" },
        { name: "Landscape Design", keyword: "landscape design garden" },
        { name: "Hardscape & Patios", keyword: "patio stone pavers" },
        { name: "Tree & Shrub Care", keyword: "tree trimming pruning" },
        { name: "Seasonal Cleanup", keyword: "fall leaves cleanup" },
        { name: "Irrigation Systems", keyword: "sprinkler irrigation lawn" },
      ],
    };
  }
  if (match(["dental", "dentist", "orthodont"])) {
    return {
      label: "Dental",
      mood: "clean, reassuring, bright clinical modern",
      primary: "#0f4c5c",
      accent: "#5fb3a5",
      background: "#ffffff with #f5fafa alternating sections",
      text: "#1a1a1a body, #6b7280 secondary",
      gradients: "teal → mint hero overlay only",
      imageryHint: "bright treatment rooms, smiles, modern clinical interiors",
      heroImageQuery: "dentist",
      heroImageAlt: "modern dental office with smiling patient",
      logoConcept: "an ACTUAL tooth — the classic molar silhouette: two rounded top bumps (crown) tapering into two short roots at the bottom. Must read as 'tooth' immediately. Optional: a small sparkle next to it.",
      services: [
        { name: "General Dentistry", keyword: "dentist checkup patient" },
        { name: "Teeth Whitening", keyword: "teeth whitening smile" },
        { name: "Dental Implants", keyword: "dental implant model" },
        { name: "Invisalign & Orthodontics", keyword: "invisalign clear aligner" },
        { name: "Cosmetic Dentistry", keyword: "cosmetic dentist smile" },
        { name: "Emergency Dentist", keyword: "emergency dental patient" },
      ],
    };
  }
  if (match(["medspa", "spa", "skin", "beauty", "aesthetic", "lash", "brow", "salon", "barber", "nails", "wax"])) {
    return {
      label: "Beauty / Medspa",
      mood: "luxe, soft, feminine, premium wellness",
      primary: "#3d2936",
      accent: "#d4a5a5",
      background: "#ffffff with #faf5f5 alternating sections",
      text: "#1a1a1a body, #6b7280 secondary",
      gradients: "mauve → blush hero overlay only",
      imageryHint: "soft skin close-ups, marble surfaces, candles, minimalist treatment rooms",
      heroImageQuery: "spa",
      heroImageAlt: "luxury medspa treatment room with soft lighting",
      logoConcept: "an ACTUAL lotus flower or 5-petal blossom — symmetrical petals radiating from a center point, thin-stroke elegant. Must read as 'flower / lotus' clearly. Alternative: a sprig of 3 olive-branch leaves.",
      services: [
        { name: "Facials & Skincare", keyword: "facial treatment skincare" },
        { name: "Laser & Injectables", keyword: "laser skin treatment" },
        { name: "Body Contouring", keyword: "body contouring massage" },
        { name: "Lash & Brow", keyword: "lash extension closeup" },
        { name: "Massage Therapy", keyword: "spa massage treatment" },
        { name: "Wellness Memberships", keyword: "luxury spa lobby" },
      ],
    };
  }
  if (match(["law", "attorney", "legal", "lawyer", "firm"])) {
    return {
      label: "Law / Professional",
      mood: "authoritative, composed, prestigious, serious",
      primary: "#0a1929",
      accent: "#b08968",
      background: "#ffffff with #f7f5f0 alternating sections",
      text: "#1a1a1a body, #6b7280 secondary",
      gradients: "navy → slate hero overlay only",
      imageryHint: "leather-bound books, columns, sharp suits, skyline shots",
      heroImageQuery: "lawyer",
      heroImageAlt: "law firm office with leather books and modern architecture",
      logoConcept: "ACTUAL scales of justice — a vertical center post with a horizontal balance beam on top and two small pans hanging from each end. Must read as 'scales / justice'. Alternative: a classical column with a capital top.",
      services: [
        { name: "Personal Injury", keyword: "lawyer consultation meeting" },
        { name: "Family Law", keyword: "law office consultation" },
        { name: "Criminal Defense", keyword: "courthouse columns" },
        { name: "Estate Planning", keyword: "lawyer document signing" },
        { name: "Business Law", keyword: "business lawyer contract" },
        { name: "Real Estate Law", keyword: "lawyer handshake contract" },
      ],
    };
  }
  if (match(["hvac", "plumb", "electric", "contractor", "handyman", "construction", "garage", "fenc"])) {
    return {
      label: "Home Services / Trades",
      mood: "bold, dependable, hardworking, blue-collar premium",
      primary: "#1c1c1c",
      accent: "#d4471f",
      background: "#ffffff with #f7f7f7 alternating sections",
      text: "#1a1a1a body, #6b7280 secondary",
      gradients: "charcoal → black hero overlay only",
      imageryHint: "branded trucks, uniforms, clean work sites, tool close-ups",
      heroImageQuery: "construction",
      heroImageAlt: "skilled tradesperson working on a job site",
      logoConcept: "an ACTUAL tool — either (a) a wrench: long handle with an open hex head at one end, or (b) a crossed wrench + hammer forming an X, or (c) a hard hat silhouette. Must read as 'tool / trade' clearly, not an abstract shield.",
      services: [
        { name: "Installation & Repair", keyword: "plumber installing pipes" },
        { name: "Emergency Service", keyword: "emergency repair worker" },
        { name: "Maintenance Plans", keyword: "hvac maintenance technician" },
        { name: "Inspections & Diagnostics", keyword: "technician diagnostic tool" },
        { name: "New Construction", keyword: "construction site worker" },
        { name: "Commercial Services", keyword: "commercial building contractor" },
      ],
    };
  }
  if (match(["auto", "detail", "car wash", "mechanic", "tire", "collision"])) {
    return {
      label: "Automotive",
      mood: "sleek, aggressive, high-performance, garage premium",
      primary: "#0a0a0a",
      accent: "#dc2626",
      background: "#ffffff with #f5f5f5 alternating sections",
      text: "#1a1a1a body, #6b7280 secondary",
      gradients: "black → graphite hero overlay only",
      imageryHint: "polished paintwork, tire close-ups, garage bays, motion blur",
      heroImageQuery: "car",
      heroImageAlt: "sleek sports car in a premium garage",
      logoConcept: "an ACTUAL car or wheel — either (a) a side-view car silhouette with visible wheels + windshield, or (b) a tire/wheel viewed head-on: outer circle + 5 spokes + inner hub. Must read as 'car / wheel' clearly.",
      services: [
        { name: "Oil Change & Maintenance", keyword: "oil change mechanic" },
        { name: "Brake Service", keyword: "brake pads mechanic" },
        { name: "Tire Service & Alignment", keyword: "tire installation shop" },
        { name: "Engine Diagnostics", keyword: "engine diagnostic computer" },
        { name: "Transmission Repair", keyword: "transmission repair mechanic" },
        { name: "Detailing & Paint", keyword: "car detailing polish" },
      ],
    };
  }
  if (match(["real estate", "realtor", "mortgage", "property", "home buy"])) {
    return {
      label: "Real Estate",
      mood: "aspirational, sophisticated, lifestyle-driven",
      primary: "#2c2825",
      accent: "#c9a67c",
      background: "#ffffff with #faf7f2 alternating sections",
      text: "#1a1a1a body, #6b7280 secondary",
      gradients: "warm-black → taupe hero overlay only",
      imageryHint: "architectural interiors, sunset exteriors, pools, keys on counters",
      heroImageQuery: "luxury-home",
      heroImageAlt: "luxury modern home exterior at golden hour",
      logoConcept: "an ACTUAL house — minimal modern home silhouette: rectangular body, triangular or flat roof, one window, one door. Thin elegant strokes. Alternative: a skeleton key (circular bow at top, long shaft with 2-3 teeth).",
      services: [
        { name: "Buying", keyword: "realtor showing home buyers" },
        { name: "Selling", keyword: "sold home sign front yard" },
        { name: "Luxury Listings", keyword: "luxury modern home exterior" },
        { name: "Investment Properties", keyword: "modern apartment interior" },
        { name: "Relocation Services", keyword: "moving boxes new home" },
        { name: "Market Analysis", keyword: "real estate market chart" },
      ],
    };
  }
  if (match(["restaurant", "cafe", "coffee", "bakery", "bar", "bistro", "catering", "food truck"])) {
    return {
      label: "Food / Hospitality",
      mood: "warm, appetizing, inviting, crafted",
      primary: "#3a1f1a",
      accent: "#d97757",
      background: "#ffffff with #fdf8f3 alternating sections",
      text: "#1a1a1a body, #6b7280 secondary",
      gradients: "espresso → terracotta hero overlay only",
      imageryHint: "close-up food, hands plating, warm candlelight, texture-rich surfaces",
      heroImageQuery: "restaurant",
      heroImageAlt: "chef plating a gourmet dish in a warm restaurant",
      logoConcept: "ACTUAL crossed fork and knife forming an X inside a thin circle — or for a cafe, a steaming coffee cup viewed from the side (cup + handle + 2-3 wavy steam lines). Must read as 'food / cafe' clearly, not abstract.",
      services: [
        { name: "Dine-In", keyword: "restaurant interior dining" },
        { name: "Private Events", keyword: "private dining event" },
        { name: "Catering", keyword: "catering plated food" },
        { name: "Takeout & Delivery", keyword: "takeout food bag" },
        { name: "Seasonal Menu", keyword: "seasonal dish plating" },
        { name: "Wine & Cocktails", keyword: "craft cocktail bar" },
      ],
    };
  }
  if (match(["fit", "gym", "coach", "train", "crossfit", "yoga", "pilat", "martial"])) {
    return {
      label: "Fitness / Coaching",
      mood: "energetic, disciplined, bold, aspirational",
      primary: "#0f0f0f",
      accent: "#84cc16",
      background: "#ffffff with #f5f5f5 alternating sections",
      text: "#1a1a1a body, #6b7280 secondary",
      gradients: "black → charcoal hero overlay only",
      imageryHint: "sweat, motion, silhouettes, chalk dust, dumbbells",
      heroImageQuery: "fitness",
      heroImageAlt: "athlete training in a premium gym",
      logoConcept: "an ACTUAL dumbbell — horizontal bar with two weighted ends (circles or rounded rectangles) on each side. Bold, heavy proportions. Alternative: a kettlebell (rounded body + short handle on top).",
      services: [
        { name: "1-on-1 Training", keyword: "personal trainer coaching" },
        { name: "Group Classes", keyword: "group fitness class" },
        { name: "Strength Programs", keyword: "barbell weightlifting" },
        { name: "HIIT & Cardio", keyword: "hiit workout sprint" },
        { name: "Nutrition Coaching", keyword: "meal prep healthy" },
        { name: "Online Coaching", keyword: "online workout video" },
      ],
    };
  }
  if (match(["tech", "saas", "software", "app", "dev", "ai", "agency", "marketing", "media", "consult"])) {
    return {
      label: "Tech / Agency",
      mood: "modern, confident, future-forward, editorial",
      primary: "#0f0f23",
      accent: "#6366f1",
      background: "#ffffff with #fafafa alternating sections",
      text: "#1a1a1a body, #6b7280 secondary",
      gradients: "indigo → violet hero overlay only",
      imageryHint: "abstract gradients, product UI, dashboards, grid lines",
      heroImageQuery: "technology",
      heroImageAlt: "modern technology workspace with glowing screens",
      logoConcept: "a distinctive geometric mark — NOT just a square with initials. Try: (a) 3 stacked/offset squares suggesting layers, (b) a rotated rhombus with a split interior line, or (c) interlocking angled shapes suggesting motion/code. Must feel designed, not generic.",
      services: [
        { name: "Web Development", keyword: "developer coding screen" },
        { name: "Brand & Design", keyword: "designer sketch laptop" },
        { name: "Growth & Marketing", keyword: "marketing analytics dashboard" },
        { name: "AI & Automation", keyword: "ai technology abstract" },
        { name: "Strategy & Consulting", keyword: "business strategy meeting" },
        { name: "Product Launch", keyword: "startup team presentation" },
      ],
    };
  }
  if (match(["clean", "maid", "janitor", "pool", "window"])) {
    return {
      label: "Cleaning Services",
      mood: "fresh, sparkling, bright, trustworthy",
      primary: "#1e40af",
      accent: "#38bdf8",
      background: "#ffffff with #f0f9ff alternating sections",
      text: "#1a1a1a body, #6b7280 secondary",
      gradients: "blue → sky hero overlay only",
      imageryHint: "sparkling surfaces, sunlit rooms, fresh linens",
      heroImageQuery: "cleaning",
      heroImageAlt: "pristine sunlit clean home interior",
      logoConcept: "an ACTUAL water droplet — classic teardrop shape (rounded bottom, pointed top) with a small highlight mark inside. Alternative: a 4-point sparkle/shine with 2 smaller sparkles next to it suggesting 'fresh & clean'.",
      services: [
        { name: "Residential Cleaning", keyword: "house cleaning living room" },
        { name: "Deep Cleaning", keyword: "deep cleaning kitchen scrub" },
        { name: "Move-In / Move-Out", keyword: "empty clean apartment" },
        { name: "Office Cleaning", keyword: "office cleaning professional" },
        { name: "Window Cleaning", keyword: "window cleaning squeegee" },
        { name: "Post-Construction", keyword: "construction cleaning dust" },
      ],
    };
  }
  if (match(["pet", "vet", "dog", "cat", "groom", "kennel"])) {
    return {
      label: "Pet / Veterinary",
      mood: "warm, friendly, caring, playful-premium",
      primary: "#6b4423",
      accent: "#f97316",
      background: "#ffffff with #fdf8f3 alternating sections",
      text: "#1a1a1a body, #6b7280 secondary",
      gradients: "walnut → coral hero overlay only",
      imageryHint: "happy pets, hands petting, soft natural light",
      heroImageQuery: "dog",
      heroImageAlt: "happy dog being cared for",
      logoConcept: "an ACTUAL paw print — one larger main pad (rounded triangle or circle) at the bottom with 4 smaller toe pads in an arc above it. Must read as 'paw' clearly. Alternative: a minimal dog-head side silhouette with one visible ear.",
      services: [
        { name: "Veterinary Care", keyword: "vet examining dog" },
        { name: "Grooming", keyword: "dog grooming bath" },
        { name: "Boarding & Daycare", keyword: "dogs daycare playing" },
        { name: "Training", keyword: "dog training sit command" },
        { name: "Dental & Wellness", keyword: "dog teeth cleaning vet" },
        { name: "Emergency Care", keyword: "emergency veterinarian dog" },
      ],
    };
  }
  if (match(["photo", "video", "wedding", "event", "florist", "planner"])) {
    return {
      label: "Creative / Events",
      mood: "romantic, editorial, artful, timeless",
      primary: "#2d2a26",
      accent: "#c9a0dc",
      background: "#ffffff with #faf7f5 alternating sections",
      text: "#1a1a1a body, #6b7280 secondary",
      gradients: "warm-black → lavender hero overlay only",
      imageryHint: "hands holding florals, candlelit tables, editorial portraits",
      heroImageQuery: "wedding",
      heroImageAlt: "elegant floral event setup in warm light",
      logoConcept: "an ACTUAL floral wreath — a thin-stroke circle with small leaf shapes curving along both sides (like an olive wreath), open slightly at the top. Inside the wreath: empty space or a small serif ampersand '&'. Must read as 'wreath / elegant'.",
      services: [
        { name: "Wedding Planning", keyword: "wedding ceremony flowers" },
        { name: "Photography", keyword: "photographer couple portrait" },
        { name: "Videography", keyword: "videographer filming wedding" },
        { name: "Floral Design", keyword: "florist wedding bouquet" },
        { name: "Event Styling", keyword: "elegant event table setting" },
        { name: "Corporate Events", keyword: "corporate event venue" },
      ],
    };
  }
  if (match(["health", "clinic", "med", "therapy", "chiro", "wellness", "mental"])) {
    return {
      label: "Healthcare / Wellness",
      mood: "calm, professional, healing, safe",
      primary: "#134e4a",
      accent: "#5eead4",
      background: "#ffffff with #f0fdfa alternating sections",
      text: "#1a1a1a body, #6b7280 secondary",
      gradients: "teal → mint hero overlay only",
      imageryHint: "open hands, natural light, minimalist clinical spaces",
      heroImageQuery: "wellness",
      heroImageAlt: "calming wellness setting with natural light",
      logoConcept: "an ACTUAL leaf — a single teardrop-shaped leaf with a visible center vein, pointing upward or slightly tilted. Thin-stroke elegant. Alternative: a rounded medical cross (soft corners) intersected with a small leaf.",
      services: [
        { name: "Primary Care", keyword: "doctor patient consultation" },
        { name: "Preventive Screenings", keyword: "doctor checkup stethoscope" },
        { name: "Chiropractic & PT", keyword: "chiropractor back adjustment" },
        { name: "Mental Health & Therapy", keyword: "therapy counseling session" },
        { name: "Nutrition & Wellness", keyword: "healthy food meal" },
        { name: "Telehealth Visits", keyword: "telehealth video call doctor" },
      ],
    };
  }

  return {
    label: "General Business",
    mood: "modern, confident, trustworthy",
    primary: "#0f172a",
    accent: "#6366f1",
    background: "#ffffff with #fafafa alternating sections",
    text: "#1a1a1a body, #6b7280 secondary",
    gradients: "slate → indigo hero overlay only",
    imageryHint: "relevant, on-brand photography",
    heroImageQuery: "business",
    heroImageAlt: "modern professional business setting",
    logoConcept: "a distinctive geometric mark — try (a) a rotated rhombus with a split interior line, (b) a circle with an inset arrow pointing up-right suggesting growth, or (c) 3 ascending bars. Must feel intentional and custom, not a default monogram-in-a-square.",
    services: [
      { name: "Consultation", keyword: "business consultation meeting" },
      { name: "Strategy & Planning", keyword: "team strategy whiteboard" },
      { name: "Implementation", keyword: "team collaboration laptop" },
      { name: "Ongoing Support", keyword: "customer support headset" },
      { name: "Reporting & Insights", keyword: "analytics dashboard laptop" },
      { name: "Custom Solutions", keyword: "professional team handshake" },
    ],
  };
}

// Pexels = free, commercial-use, no-watermark, actually-keyword-matched photos.
// Requires PEXELS_API_KEY env var (free at https://www.pexels.com/api/).
// Falls back to Unsplash Source-style Loremflickr if no key / call fails.
async function fetchPexelsImages(query: string, count: number): Promise<string[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${Math.min(Math.max(count, 10), 40)}&orientation=landscape&size=large`;
    const res = await fetch(url, {
      headers: { Authorization: key },
      // Pexels search is fast but don't hang forever.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      photos?: Array<{ src?: { large2x?: string; large?: string; landscape?: string; original?: string } }>;
    };
    const urls = (data.photos || [])
      .map((p) => p.src?.large2x || p.src?.large || p.src?.landscape || p.src?.original)
      .filter((u): u is string => !!u);
    return Array.from(new Set(urls)).slice(0, count);
  } catch {
    return [];
  }
}

function fallbackImageUrl(seed: string, width: number, height: number): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`;
}

function loremflickrUrl(keyword: string, width: number, height: number, lock: number): string {
  const k = encodeURIComponent(keyword.replace(/[^a-zA-Z0-9 ,-]/g, "").trim());
  return `https://loremflickr.com/${width}/${height}/${k}/all?lock=${lock}`;
}

async function buildNicheImageUrls(p: PaletteHint): Promise<{
  hero: string;
  services: Array<{ name: string; url: string; keyword: string }>;
  portfolio: string[];
  source: "pexels" | "fallback";
  fallback: string;
}> {
  const k = p.heroImageQuery.split(",")[0]?.trim() || p.heroImageQuery;
  const fallback = fallbackImageUrl(`${k}-fallback`, 1200, 800);

  // Fetch hero pool, portfolio pool, and one pool per service — all in parallel.
  const [heroPool, portfolioPool, ...servicePools] = await Promise.all([
    fetchPexelsImages(`${k} ${p.label}`, 5),
    fetchPexelsImages(`${p.heroImageAlt}`, 6),
    ...p.services.map((s) => fetchPexelsImages(s.keyword, 3)),
  ]);

  const allPexelsOk = heroPool.length > 0 && servicePools.every((pool) => pool.length > 0);

  if (allPexelsOk) {
    // Dedupe — if a service pool returned the same photo as the hero or another
    // service, swap to the next candidate in that pool.
    const used = new Set<string>();
    const claim = (candidates: string[], fallbackUrl: string): string => {
      for (const url of candidates) {
        if (!used.has(url)) { used.add(url); return url; }
      }
      return fallbackUrl;
    };

    const hero = claim(heroPool, loremflickrUrl(k, 1920, 1080, 1));
    const services = p.services.map((s, i) => ({
      name: s.name,
      keyword: s.keyword,
      url: claim(servicePools[i], loremflickrUrl(s.keyword, 800, 600, 10 + i)),
    }));
    const portfolio = [0, 1, 2].map((i) =>
      claim(portfolioPool, loremflickrUrl(k, 1200, 800, 20 + i)),
    );

    return { hero, services, portfolio, source: "pexels", fallback };
  }

  // Loremflickr fallback — keyword-matched per service, but less reliable.
  return {
    hero: loremflickrUrl(k, 1920, 1080, 1),
    services: p.services.map((s, i) => ({
      name: s.name,
      keyword: s.keyword,
      url: loremflickrUrl(s.keyword, 800, 600, 10 + i),
    })),
    portfolio: [20, 21, 22].map((lock) => loremflickrUrl(k, 1200, 800, lock)),
    source: "fallback",
    fallback,
  };
}

function formatPaletteInstructions(
  p: PaletteHint,
  images: { hero: string; services: Array<{ name: string; url: string; keyword: string }>; portfolio: string[]; source: "pexels" | "fallback"; fallback: string },
): string {
  const k = p.heroImageQuery.split(",")[0]?.trim() || p.heroImageQuery;
  const sourceNote = images.source === "pexels"
    ? "Source: Pexels (free commercial-use license, no attribution required, no watermarks)."
    : "Source: Loremflickr (CC-licensed Flickr photos, keyword-matched).";

  return [
    `NICHE COLOR SYSTEM — use a LIGHT editorial base with ONE niche accent (do NOT default to gold, dark themes, or gradients everywhere):`,
    `- Niche category: ${p.label}`,
    `- Overall mood: ${p.mood}`,
    `- Base background: clean white #ffffff. Sections may alternate between white and the subtle tint described here: ${p.background}.`,
    `- Single accent color (for CTAs, icons, stat numbers, section eyebrows, link hovers): EXACTLY ${p.accent}. Use this hex everywhere the accent is needed — do not pick a different shade.`,
    `- Supporting deep color (for headings, footer, primary nav CTA): EXACTLY ${p.primary}.`,
    `- Body text: ${p.text}.`,
    `- Use the accent sparingly — 10-15% of the page at most. Let whitespace and imagery carry the design.`,
    `- Gradients are restricted to the hero overlay only (${p.gradients}).`,
    ``,
    `NICHE IMAGERY — the following photo URLs are ALREADY niche-matched per-service (${p.label}, keyword "${k}") and are ALL DIFFERENT. ${sourceNote} Use each URL exactly once in the exact slot specified. Do NOT reuse any URL in a different section, do NOT substitute a different URL, do NOT use any other image service.`,
    `- HERO background (use EXACTLY this URL as the CSS background-image of the hero section):`,
    `    ${images.hero}`,
    `  Alt: "${p.heroImageAlt}"`,
    `  Treatment: full-bleed background-image with a dark vertical gradient overlay (rgba(0,0,0,0.55) → rgba(0,0,0,0.20)) for headline legibility.`,
    ``,
    `- SERVICE CARDS — use these exact 6 services with their matched photos. Each photo was chosen to DEPICT that specific service (e.g. the oil-change card actually shows someone changing oil, not a generic mechanic). Use the service name as the card title and write a 2-line description for each. Do NOT swap photos between services.`,
    ...images.services.map((s, i) =>
      `    ${i + 1}) "${s.name}" (depicts: ${s.keyword}) → ${s.url}`,
    ),
    ``,
    `- PORTFOLIO / showcase images (3 distinct photos):`,
    ...images.portfolio.map((u, i) => `    ${i + 1}) ${u}`),
    `- Imagery direction: ${p.imageryHint}.`,
    `- Every <img> tag MUST include a descriptive alt attribute AND this onerror fallback verbatim (only used if a URL fails to load):`,
    `    onerror="this.onerror=null;this.src='${images.fallback}'"`,
    `- Do NOT substitute unsplash.com, source.unsplash.com, placehold.co, via.placeholder.com, or any other service. Use ONLY the URLs listed above.`,
    `- Do NOT duplicate any image — each URL appears in exactly ONE <img> / background-image slot.`,
    ``,
    `Aesthetic guardrails: a landscaping site feels green/earthy/natural; a law firm navy with restrained typography; a medspa blush/mauve soft minimal; a roofing business rugged slate with strong real photography of actual roofers. Do not introduce gold/amber accents unless the niche specifies them. Do not make the page feel dark-themed — the base is always light.`,
  ].join("\n");
}

const PREMIUM_STRUCTURE_BLOCK = `MANDATORY PAGE STRUCTURE (follow this 9-section template in EXACT order — no skipping, no reordering):

1. STICKY NAV (header)
   - Solid white background, subtle bottom border or shadow on scroll
   - Left: the logo lockup (icon + business-name wordmark) exactly as described in the LOGO section above. Icon ~32-36px tall, wordmark next to it.
   - Center: 4 nav links — Services, About, Work, Contact — medium weight, subtle hover with accent underline
   - Right: accent-filled CTA button "Call Now" or "Get Free Quote" with phone icon (use the tel: link)

2. FULL-BLEED HERO
   - Min-height 85vh, background-image = the niche hero URL, with dark gradient overlay
   - Content centered vertically, left-aligned or centered horizontally
   - Small eyebrow label in accent color (uppercase small-caps) above headline — e.g. "TRUSTED [NICHE] EXPERTS"
   - Aspirational transformation headline at 56-72px, tight leading, max 2 lines. NOT feature-based. Examples of tone: "We Don't Just Cut Grass. We Create Experiences." / "Roofs Built to Last a Lifetime." / "Your Smile. Our Masterpiece."
   - Subheadline 18-20px, max 3 lines, white/near-white, describing transformation/outcome
   - TWO CTAs side-by-side: primary (filled accent, "Get Your Free Quote"), secondary (outlined white, niche-appropriate like "View Our Work" / "Book Consultation")
   - Below CTAs: one line of trust — "★★★★★  200+ 5-Star Reviews  •  Licensed & Insured  •  Free Estimates"

3. TRUST BADGES ROW (directly under hero)
   - 4-column grid on white or #fafafa
   - Each badge: small accent-colored icon (check-circle, shield, star, award) + bold short line + one-line supporting text
   - Examples: "5-Star Rated" / "200+ Happy Customers" · "Licensed & Insured" / "Fully bonded, fully covered" · "Free Estimates" / "No hidden fees, no pressure" · "100% Guarantee" / "We stand behind every job"

4. SERVICES GRID
   - Eyebrow small-caps accent label + H2 section title + optional one-line kicker
   - 6 service cards in a 3-column grid (2 on tablet, 1 on mobile)
   - Each card: rounded image at top (16:10), H3 title, 2-3 line description, small "Learn more →" link in accent
   - White bg, subtle shadow (shadow-sm), hover: -translate-y-1 + shadow-md
   - Services must be specific to the business — not generic "Service 1 / Service 2"

5. STATS / WHY CHOOSE US
   - Full-width band on a subtly tinted background (e.g. very pale accent tint or #f7f9f8)
   - 4-column grid, each stat: huge number (60-72px bold, in accent color) + label
   - Use specific credible numbers: "15+ Years Experience", "500+ Projects Completed", "200+ 5-Star Reviews", "100% Satisfaction Guarantee"

6. PORTFOLIO / TRANSFORMATION SHOWCASE
   - H2 + kicker
   - 3 featured projects. Cards can be vertical (image on top, content below) OR alternate horizontal (image left/right) — pick one approach and stay consistent
   - Each: large image + project title + 2-line transformation story ("From dated concrete patio to a stunning outdoor living space with custom pergola and ambient lighting") + subtle accent metadata like location/year

7. TESTIMONIALS
   - 2-3 testimonial cards in a row, white bg with subtle shadow, rounded-xl
   - Each: accent-colored quote mark icon, 5-star row, italicized quote, customer name in bold, role/location in muted

8. LOCATION / GOOGLE MAPS (include ONLY if an address is provided in the business info)
   - Full-width section, subtle tinted background
   - Eyebrow + H2 ("Come Visit Us" / "Find Us" / "Our Studio") + one-line kicker
   - Two-column grid on desktop (single column on mobile):
     • Left column: address (with Map Pin icon), business hours (list), clickable phone (tel:), clickable email (mailto:), "Get Directions" accent button that links to https://www.google.com/maps/search/?api=1&query=[URL-ENCODED-ADDRESS]
     • Right column: embedded Google Map iframe — src="https://www.google.com/maps?q=[URL-ENCODED-ADDRESS]&output=embed", width="100%", height="420", loading="lazy", class="rounded-2xl border border-gray-100 shadow-sm", style="border:0", referrerpolicy="no-referrer-when-downgrade"
   - If no address was provided, OMIT this section entirely — do not render an empty map.

9. FINAL CTA BAND
   - Full-width section, accent-colored background OR dark with accent button
   - Center-aligned: short bold heading ("Ready to transform your [outcome]?"), one-line supporting text, single filled CTA button, phone tel: link below

10. FOOTER
   - Dark (#0f172a) or white-gray with top border; 4 columns on desktop
   - Col 1: business name + 2-line mission + big clickable phone (tel:) and email (mailto:)
   - Col 2: Services (6 niche-specific links, # anchors are fine)
   - Col 3: Company (About, Work, Contact, Reviews, Privacy, Terms)
   - Col 4: Contact (address with Google Maps link, hours, social icons — Instagram/Facebook/Google)
   - Copyright line: "© ${new Date().getFullYear()} [Business Name]. All rights reserved."`;

const DESIGN_SYSTEM_BLOCK = `DESIGN SYSTEM (hit these specs exactly — this is what separates a $500 site from a generic template):

- Typography: use Google Fonts via <link> in <head>. Body/UI = Inter (weight 400/500/600/700). Optional display serif for H1 only = "DM Serif Display" or "Fraunces" — use ONLY if the niche feels editorial (law, medspa, real estate, restaurant, events). Otherwise Inter for everything.
- Font sizes: H1 56-72px bold, tight leading-[1.05]; H2 32-44px semibold; H3 22-28px semibold; eyebrow 12-13px uppercase tracking-widest; body 16-18px with leading-[1.65]; tiny/legal 13px.
- Container: max-w-7xl (1280px) mx-auto with px-6 lg:px-8.
- Section padding: py-20 md:py-28 (80-112px). No cramped sections.
- Cards: rounded-2xl (16px) or rounded-xl (12px), border border-gray-100, shadow-sm, hover:shadow-lg transition-all duration-300.
- Buttons: rounded-lg (8px) primary filled accent with px-6 py-3 text-sm font-semibold tracking-tight. Secondary = border-2 border-current bg-transparent. Hover = subtle brightness shift + translate-y.
- Use Lucide icons via the CDN (exact setup in the ICONS section below — the script URL, init script, and markup rules are STRICT).
- Motion: CSS-ONLY animations — no JS-driven reveals, no IntersectionObserver, no parallax, no carousels. See the MOTION section for the required premium animation system.
- CRITICAL VISIBILITY RULE: never set an element's initial state to opacity: 0, visibility: hidden, or display: none and depend on JS to show it. All reveal animations MUST be pure CSS @keyframes with animation-fill-mode: both — they run once on page load and always end in the visible state, so content is visible even if JS never runs.
- Do not use <marquee>, <blink>, emoji-as-icons, or Google Fonts script tags (use <link> only).`;

const PREMIUM_MOTION_BLOCK = `MOTION SYSTEM — include this CSS-only animation system verbatim in a <style> block inside <head>. It makes the site feel premium like a SaaS homepage, is 100% CSS, respects prefers-reduced-motion, and always ends in the visible state.

<style>
  @media (prefers-reduced-motion: no-preference) {
    @keyframes nn-fade-up { from { opacity: 0; transform: translate3d(0, 24px, 0); } to { opacity: 1; transform: translate3d(0, 0, 0); } }
    @keyframes nn-fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes nn-scale-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
    @keyframes nn-slide-right { from { opacity: 0; transform: translate3d(-24px, 0, 0); } to { opacity: 1; transform: translate3d(0, 0, 0); } }
    .nn-fade-up { animation: nn-fade-up .7s cubic-bezier(.22,1,.36,1) both; }
    .nn-fade-in { animation: nn-fade-in .8s cubic-bezier(.22,1,.36,1) both; }
    .nn-scale-in { animation: nn-scale-in .7s cubic-bezier(.22,1,.36,1) both; }
    .nn-slide-right { animation: nn-slide-right .7s cubic-bezier(.22,1,.36,1) both; }
    .nn-delay-1 { animation-delay: .08s; }
    .nn-delay-2 { animation-delay: .16s; }
    .nn-delay-3 { animation-delay: .24s; }
    .nn-delay-4 { animation-delay: .32s; }
    .nn-delay-5 { animation-delay: .40s; }
    .nn-delay-6 { animation-delay: .48s; }
  }
  .nn-nav-scrolled { backdrop-filter: saturate(180%) blur(10px); background-color: rgba(255,255,255,0.88); box-shadow: 0 1px 0 rgba(0,0,0,0.06), 0 4px 20px -8px rgba(0,0,0,0.08); }
  .nn-card { transition: transform .35s cubic-bezier(.22,1,.36,1), box-shadow .35s cubic-bezier(.22,1,.36,1); }
  .nn-card:hover { transform: translateY(-4px); box-shadow: 0 18px 40px -12px rgba(0,0,0,0.18); }
  .nn-image-zoom { overflow: hidden; }
  .nn-image-zoom img { transition: transform .7s cubic-bezier(.22,1,.36,1); }
  .nn-image-zoom:hover img { transform: scale(1.06); }
</style>

HOW TO APPLY (MANDATORY):
- Hero eyebrow → class="nn-fade-up"
- Hero headline → class="nn-fade-up nn-delay-1"
- Hero subheadline → class="nn-fade-up nn-delay-2"
- Hero CTA row → class="nn-fade-up nn-delay-3"
- Hero trust row → class="nn-fade-up nn-delay-4"
- Each trust-badges item → class="nn-fade-up nn-delay-1/2/3/4" (staggered)
- Each service card → class="nn-card nn-fade-up nn-delay-1/2/3/4/5/6" (stagger across 6 cards)
- Service card image wrapper → class="nn-image-zoom rounded-2xl"
- Stats row items → class="nn-scale-in nn-delay-1/2/3/4"
- Portfolio cards → class="nn-card nn-fade-up nn-delay-1/2/3"
- Testimonial cards → class="nn-card nn-fade-up nn-delay-1/2/3"
- Final CTA heading → class="nn-fade-up"

NAV SCROLL STATE (small, safe JS):
- Give the <nav> an id="nn-nav" and at the end of <body> include:
  <script>(function(){var n=document.getElementById('nn-nav');if(!n)return;var t=function(){if(window.scrollY>24)n.classList.add('nn-nav-scrolled');else n.classList.remove('nn-nav-scrolled');};t();window.addEventListener('scroll',t,{passive:true});})();</script>
- If the script fails, the nav just keeps its default look. Safe.

BUTTON + CARD HOVER STATES (Tailwind, no custom CSS needed):
- Primary button: transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl
- Secondary button: transition-colors duration-200 hover:bg-black/5
- Service cards: use .nn-card class above for the lift, and wrap the image in .nn-image-zoom for the gentle zoom.

FORBIDDEN:
- IntersectionObserver, scroll-triggered animations, AOS library, GSAP, ScrollTrigger.
- ANY animation that leaves an element in a hidden state if JS fails.
- Persistent opacity:0 or display:none on primary content.`;

const ICONS_BLOCK = `ICONS SYSTEM — icons appear EVERYWHERE, not optional. Every CTA, every contact line, every trust badge, every service card, every stat, every nav link, every footer list — has an icon. A premium SaaS site never has a bare "Call Now" button without a phone icon next to it.

SETUP (include EXACTLY this in the page — the script is UMD, NOT a module):
<!-- In <head>, near the end: -->
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js" defer></script>

<!-- Just before </body>, include this init script verbatim: -->
<script>
  function nnInitIcons(){ if (window.lucide && typeof window.lucide.createIcons === 'function') { window.lucide.createIcons(); } }
  if (document.readyState !== 'loading') nnInitIcons();
  else document.addEventListener('DOMContentLoaded', nnInitIcons);
  window.addEventListener('load', nnInitIcons);
</script>

ICON MARKUP (this exact pattern — do NOT use <svg> inline for UI icons, do NOT use emoji, do NOT use unicode):
<i data-lucide="phone" class="w-4 h-4"></i>

  - The tag is <i> (italic). Lucide replaces it with an <svg> on load, inheriting the Tailwind sizing classes.
  - Use w-3.5 h-3.5 for tiny inline icons, w-4 h-4 for button icons, w-5 h-5 for list icons, w-6 h-6 for card/header icons, w-7 h-7 or w-8 h-8 for stat/trust icons.
  - For colored icons, add Tailwind text color classes on a wrapper span or directly on the <i>: class="w-5 h-5 text-[ACCENT_HEX]".
  - Always put the icon BEFORE the label text in buttons, with gap-2 on the flex parent.

REQUIRED ICON PLACEMENTS (every one of these MUST have its icon — do not skip any):

Navigation:
  - Primary "Call Now" / "Get Quote" CTA button → data-lucide="phone" (if call) or "arrow-right" (if form CTA)
  - Mobile menu toggle → data-lucide="menu"

Hero:
  - Primary CTA button → phone or arrow-right (match the CTA verb)
  - Secondary CTA button → play-circle (for video), calendar (for booking), or eye (for portfolio view)
  - Trust row stars → star (5 of them)
  - Trust row separators → visual dot or vertical line (no icon needed)

Trust Badges row:
  - "5-Star Rated" → star
  - "Licensed & Insured" → shield-check
  - "Free Estimates" → badge-check or circle-check
  - "Satisfaction Guarantee" → award
  (Wrap each in a circle or rounded-xl tinted-bg container with the icon in the accent color, w-6 h-6.)

Services Grid:
  - Each of the 6 service cards gets a small icon (w-5 h-5, accent color) at the top-left of the card above/next to the title — choose contextually: oil change → "droplet", brake service → "disc", tire → "circle", engine → "cog" or "wrench", diagnostic → "activity", detailing → "sparkles"; or for other niches: lawn mowing → "scissors", design → "palette", patio → "layers", tree care → "tree-pine", cleanup → "wind", irrigation → "droplets", etc. Be specific and intentional.
  - Every card's "Learn more →" link → ends with <i data-lucide="arrow-right" class="w-3.5 h-3.5 ml-1">

Stats / Why Choose Us:
  - Each stat gets an icon above the number (w-7 h-7 in accent color): years → "calendar", projects → "check-circle-2", reviews → "star", guarantee → "shield-check", customers → "users", locations → "map-pin", response time → "zap".

Portfolio:
  - Each card metadata row: <i data-lucide="map-pin" class="w-3.5 h-3.5"> for location, <i data-lucide="calendar" class="w-3.5 h-3.5"> for year.

Testimonials:
  - Big quote mark at top of each card → data-lucide="quote" (in accent color, w-8 h-8)
  - Star row → 5× data-lucide="star" in accent color, w-4 h-4 with fill-current

Location / Map section:
  - Address line → data-lucide="map-pin"
  - Hours list heading → data-lucide="clock"
  - Phone line → data-lucide="phone"
  - Email line → data-lucide="mail"
  - "Get Directions" button → data-lucide="navigation" or "map-pin"

Final CTA:
  - Button icon matching the action: "phone" or "arrow-right"
  - Below-button phone line → data-lucide="phone" (w-4 h-4)

Footer:
  - Column headings (optional): none
  - Contact list: phone line → "phone", email line → "mail", address line → "map-pin", hours line → "clock"
  - Social icons row: data-lucide="instagram", "facebook", "twitter" (or "x"), "youtube" — circular tinted-bg buttons, 40×40, icon w-4 h-4

CTA BUTTON PATTERN (copy exactly for every CTA):
<a href="tel:..." class="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[ACCENT] text-white font-semibold text-sm tracking-tight transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
  <i data-lucide="phone" class="w-4 h-4"></i>
  Call Now
</a>

RULES:
- EVERY button that says "Call", "Phone", "Talk", "Contact" has a phone icon.
- EVERY button that says "Get Quote", "Get Started", "Learn More", "View Work" has an arrow-right icon.
- EVERY button that says "Book", "Schedule", "Reserve" has a calendar icon.
- EVERY contact line (phone, email, address, hours) has a leading icon.
- NO plain-text CTAs. NO emoji icons. NO unicode arrows (→ character). Use Lucide <i data-lucide="arrow-right"> instead of an emoji or typographic arrow.`;

function formatLogoSpec(p: PaletteHint, logoUrl: string | null): string {
  if (logoUrl) {
    return `LOGO (a custom AI-generated PNG logo has already been produced for this business):

- Use this EXACT placeholder string as the src attribute wherever the logo image appears: __NN_LOGO_URL__
  Example: <img src="__NN_LOGO_URL__" alt="[Business Name] logo" class="h-9 w-auto" />
- The image is a transparent-background PNG of the icon-mark only (no text).
- Pair the <img> with a styled text wordmark of the business name immediately to its right.

PLACEMENT:
- Sticky nav (left side): <div class="flex items-center gap-2.5">
    <img src="__NN_LOGO_URL__" alt="${p.label} logo" class="h-8 w-8 md:h-9 md:w-9 object-contain" />
    <span class="text-lg md:text-xl font-bold tracking-tight" style="color: ${p.primary}">[Business Name]</span>
  </div>
- Footer column 1: the SAME <img src="__NN_LOGO_URL__"> (use h-10 w-10 here) + wordmark + optional short mission line.
- Do NOT use the logo over the hero — the nav already shows it.

WORDMARK:
- Business name to the right of the logo, color ${p.primary}, tracking-tight, font-bold.
- For 2+ word names, split-weight treatment is nice (first word bold, second lighter) — optional.
- All-caps only if niche is law / luxury real estate / editorial events. Otherwise Title Case.
- Optional tiny tagline under the wordmark: text-[10px] uppercase tracking-[0.25em] text-gray-500.

HARD BANS:
- Do NOT generate any inline <svg> for the brand mark — use the placeholder img URL above instead.
- Do NOT replace the placeholder "__NN_LOGO_URL__" string with anything else. It will be substituted server-side with the real CDN URL.
- Do NOT use a Lucide / Heroicons icon as the logo. Do NOT use emoji. Do NOT use the hero photo.`;
  }

  return `LOGO — hand-craft a CUSTOM INLINE SVG that actually DEPICTS the niche subject. This is the most important visual identity element on the page.

ICON-MARK — what to draw (MANDATORY — this is a pictorial icon, NOT an abstract monogram):
- The icon MUST visually depict the subject described here, so a viewer identifies the niche in under 1 second: ${p.logoConcept}
- If the subject is an object (tree, tooth, house, wrench, dumbbell, paw, droplet, etc.) — draw that object as a simplified but recognizable pictogram. Think "clean flat-design icon", like a premium app icon or a professional logo from a design studio.
- DO NOT default to: the business's first letter inside a square/circle, a generic shield, a star, a sparkle, a checkmark, a plain arrow, or abstract geometric filler unrelated to the niche. If the niche calls for a tree, draw a tree. If it calls for a tooth, draw a tooth. No exceptions.

ICON-MARK — how to build it:
- <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="36" height="36"> ... </svg>
- Use 3-8 primitive elements (path, rect, circle, ellipse, polygon, line) — enough detail to actually look like the subject, not so many it's noisy.
- Two-color system allowed: PRIMARY shapes in ${p.accent}, optional secondary detail (trunk, leaves, highlights, inner shapes) in ${p.primary} or at 50% opacity of the accent. NO gradients, NO filters, NO drop shadows, NO CSS animations.
- For organic shapes (tree canopy, flower petals, droplet, leaf): use smooth <path> with Bezier curves (C/Q commands). Avoid visibly jagged polygons.
- For built shapes (house, wrench, dumbbell, scales, car): align to the viewBox grid, use rounded corners (rx/ry) where appropriate for a friendly modern feel.
- Include stroke-linecap="round" stroke-linejoin="round" on any stroked paths. If using strokes, stroke-width 2.5-3.5.
- Must read clearly at 24px. Test mentally: squint — is the subject still recognizable?
- NO <text> inside the SVG. The wordmark lives outside the SVG.

WORDMARK — the business name as typography next to the icon:
- The full business name as styled HTML text directly to the right of the icon: class="text-lg md:text-xl font-bold tracking-tight" with color ${p.primary}.
- For 2+ word names, a split-weight treatment is encouraged: first word bold, second word lighter (font-light or font-normal) in the same size. Or an ampersand in italic.
- All-caps only if the niche is law, architecture, editorial events, or luxury real estate. Otherwise use Title Case.
- Optional tiny tagline under the wordmark: class="text-[10px] uppercase tracking-[0.25em] text-gray-500" — one short phrase (e.g. "Roofing Experts", "Family Dentistry"). Skip if it feels cluttered.

LOCKUP (where it goes):
- Sticky nav (left): flex items-center gap-2.5 — [icon-svg] [wordmark block]. Total lockup < 200px wide.
- Hero section: DO NOT repeat the logo lockup over the hero — the nav already shows it.
- Footer (column 1): the SAME icon-mark (maybe sized 40-48px) + wordmark, with the tagline below.
- The SVG markup must be IDENTICAL in both places (copy-paste the same SVG). Do not invent a second mark.

HARD BANS:
- No <img src="..."> for the logo — inline SVG only.
- No Lucide / Heroicons / Font Awesome icon as the logo. Those are for UI affordances, not the brand mark.
- No hero photo, no emoji, no unicode symbol as the logo.
- No gradient fills inside the logo SVG.`;
}

const OUTPUT_FORMAT_BLOCK = `OUTPUT FORMAT (strict):
- Your FIRST characters MUST be "<!DOCTYPE html>".
- Your LAST characters MUST be "</html>".
- NO markdown code fences. NO preamble. NO "Here is...". NO trailing commentary.
- Return the complete document from <!DOCTYPE html> through </html>. Never truncate, never use "...", never leave placeholders.`;

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { prospectId, name, service, phone, email, address, contactName, tier = "standard" } = await req.json();
  if (!name) {
    return NextResponse.json({ error: "Business name is required" }, { status: 400 });
  }

  const creditCost = tier === "whitelabel" ? WEBSITE_WHITELABEL_CREDITS : WEBSITE_GENERATION_CREDITS;

  const balance = await getBalance(session.userId);
  if (balance < creditCost) {
    return NextResponse.json(
      { error: "Insufficient credits", required: creditCost, balance },
      { status: 402 },
    );
  }

  const aiResult = await getUserAIConfig(session.userId);
  if (!aiResult.ok) {
    return NextResponse.json({ error: aiResult.error }, { status: 400 });
  }

  const palette = paletteForNiche(service);
  // 128-bit cryptographic ID (32 hex chars). The GET endpoint for these pages is
  // public-by-design (users share the URL with prospects), so the ID itself is the
  // authorization token — it must be unguessable.
  const siteId = `site-${crypto.randomBytes(16).toString("hex")}`;

  // Kick off image fetch + logo generation in parallel — logo takes ~10-20s so
  // overlapping it with the photo lookup saves real wall-clock time.
  const [images, logoUrl] = await Promise.all([
    buildNicheImageUrls(palette),
    generateBusinessLogo(palette, name, siteId),
  ]);

  const paletteBlock = formatPaletteInstructions(palette, images);
  const logoBlock = formatLogoSpec(palette, logoUrl);

  const footerBrandingLine =
    tier === "whitelabel"
      ? `BRANDING: this is a white-label site. Do NOT include any "Powered by NextNote" badge or third-party branding anywhere.`
      : `BRANDING: include a small, tasteful "Powered by NextNote" link in the footer — single line, muted gray, href="https://nextnote.to" target="_blank". Do not make it loud.`;

  const systemPrompt = `You are a senior editorial web designer producing conversion-optimized single-file landing pages for small businesses. Your output is a complete, self-contained HTML document using Tailwind CSS via CDN. Your work is indistinguishable from a $3,000 custom-built site — clean, light, editorial, and specific to the niche.

DESIGN PHILOSOPHY:
- Clean, LIGHT, editorial aesthetic. Not dark-themed, not cinematic-gold, not cluttered.
- White/near-white base, generous whitespace, disciplined typography, ONE niche-appropriate accent color used sparingly.
- Real photography per niche — hero and sections show actual images of the work, not abstract gradients or flat color blocks.
- Restrained motion, consistent 6-12px border radius, subtle shadows only.
- Every section ends with a clear conversion path (CTA or contact link).

${paletteBlock}

${logoBlock}

${PREMIUM_STRUCTURE_BLOCK}

${DESIGN_SYSTEM_BLOCK}

${PREMIUM_MOTION_BLOCK}

${ICONS_BLOCK}

CONVERSION COPY RULES:
- Aspirational transformation headlines, NOT feature lists. ("We Create Experiences" beats "We Offer Lawn Services").
- Specific, credible numbers in the stats section ("15+ Years", "500+ Projects"). Never "many" or "lots".
- Every contact surface uses tel: and mailto: links. If an address is provided, wrap it in a Google Maps link.
- Services must be SPECIFIC to the niche, derived from the business info — not generic filler.
- Generate realistic testimonials with plausible names, cities, and specific details.

${footerBrandingLine}

TECHNICAL:
- Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Google Fonts via <link> tag in <head>
- Semantic HTML5 (header, nav, section, article, footer)
- Mobile-first responsive (sm/md/lg breakpoints)
- Alt text on every image
- Lucide icons via the UMD CDN script + lucide.createIcons() call in a <script> before </body>

${OUTPUT_FORMAT_BLOCK}`;

  const userPrompt = `Build the landing page for this business. Use the business info below to fill every section with SPECIFIC, on-brand content. Do not use placeholders or lorem ipsum.

BUSINESS INFO:
- Business Name: ${name}
- Service / Industry: ${service || "General business services"}
- Phone: ${phone || "N/A"} ${phone ? "(use as a clickable tel: link and in the final CTA)" : ""}
- Email: ${email || "N/A"} ${email ? "(use as a clickable mailto: link)" : ""}
- Address: ${address || "N/A"} ${address ? `(use for the Google Maps embed: src="https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed", and for the Directions button href: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)})` : "(OMIT the Location / Google Maps section entirely since no address was provided)"}
- Primary Contact: ${contactName || "N/A"}

Niche category detected: ${palette.label}. Commit to this niche's visual identity (${palette.mood}) — imagery, accent color, and tone should feel native to this industry, not generic.

Produce the full 9-section page per the structure above, at the quality of a professionally designed agency site. Return the complete HTML document only.`;

  try {
    // Premium template requires a bigger output budget — Anthropic supports it, OpenAI caps at 16k.
    const maxTokens = aiResult.config.provider === "anthropic" ? 32000 : 16000;
    const rawHtml = await aiChat(aiResult.config, systemPrompt, userPrompt, maxTokens);

    // Strip markdown fences if the model wrapped the output.
    const fenceMatch = rawHtml.match(/```(?:html)?\s*([\s\S]*?)\s*```/i);
    let html = fenceMatch ? fenceMatch[1].trim() : rawHtml.trim();

    // Strip any leading preamble before <!DOCTYPE.
    const doctypeIdx = html.search(/<!DOCTYPE\s+html/i);
    if (doctypeIdx > 0) html = html.slice(doctypeIdx);
    else {
      const htmlIdx = html.indexOf("<html");
      if (htmlIdx > 0) html = html.slice(htmlIdx);
    }

    if (!/<!DOCTYPE\s+html/i.test(html) && !html.includes("<html")) {
      return NextResponse.json({ error: "AI did not return valid HTML" }, { status: 500 });
    }
    if (!/<\/html>\s*$/i.test(html)) {
      return NextResponse.json(
        { error: "Website generation was truncated. Please try again." },
        { status: 500 },
      );
    }

    // Safety net: if the model added hide-until-scroll CSS anyway, neutralize it
    // so content is always visible even when the reveal JS fails to fire.
    // Narrow safety net: only undo the blatant JS-reveal anti-patterns so a
    // stuck observer never hides content. Does NOT touch our CSS .nn-* classes
    // (those always end visible via animation-fill-mode: both).
    html = html.replace(
      /<\/head>/i,
      `<style id="nn-visibility-guard">
  [data-reveal],[data-animate],.scroll-reveal,.animate-on-scroll,.aos-init,.aos-animate,.reveal-on-scroll,.js-reveal{opacity:1!important;transform:none!important;visibility:visible!important;}
</style></head>`,
    );

    // If the model loaded Lucide as type="module" (wrong — UMD doesn't expose
    // window.lucide under module scope), fix it so createIcons() actually runs.
    html = html.replace(
      /<script([^>]*?)\btype=["']module["']([^>]*?)src=["'][^"']*lucide[^"']*["']([^>]*)><\/script>/gi,
      (_m, a, b, c) => `<script${a}${b}src="https://unpkg.com/lucide@latest/dist/umd/lucide.js" defer${c}></script>`,
    );

    // Safety net: guarantee the Lucide UMD script + init script are present.
    if (!/unpkg\.com\/lucide/i.test(html)) {
      html = html.replace(
        /<\/head>/i,
        `<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js" defer></script></head>`,
      );
    }
    if (!/lucide\.createIcons/.test(html)) {
      html = html.replace(
        /<\/body>/i,
        `<script>(function(){function init(){if(window.lucide&&typeof window.lucide.createIcons==='function')window.lucide.createIcons();}if(document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init);window.addEventListener('load',init);})();</script></body>`,
      );
    }

    // Swap logo placeholder for the real uploaded PNG URL (or leave empty if
    // logo gen failed — the prompt will have told the model to fall back to SVG).
    if (logoUrl) {
      html = html.split("__NN_LOGO_URL__").join(logoUrl);
    }

    const { error: dbErr } = await supabaseAdmin.from("generated_websites").insert({
      id: siteId,
      user_id: session.userId,
      prospect_id: prospectId || null,
      prospect_name: name,
      html_content: html,
      tier,
    });

    if (dbErr) {
      return NextResponse.json({ error: `Failed to save website: ${dbErr.message}` }, { status: 500 });
    }

    await deductCredits(session.userId, creditCost, {
      reason: "website_generation",
      refId: siteId,
      metadata: { prospectId, prospectName: name, tier },
    });

    return NextResponse.json({ siteId, tier });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
