import crypto from "crypto";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { getUserAIConfig, aiChat } from "@/lib/ai";
import { getBalance, deductCredits, WEBSITE_GENERATION_CREDITS, WEBSITE_WHITELABEL_CREDITS } from "@/lib/credits";
import { supabaseAdmin } from "@/lib/supabase";
import { generateBusinessLogo } from "@/lib/logo";
import { ensureFormHandler, stripPoweredByBadge } from "@/lib/websiteForms";
import { reserveUniqueSlug, WHITELABEL_HOST } from "@/lib/websiteDomains";
import { addVercelDomain } from "@/lib/vercelDomains";
import { buildLockedDesignSystemBlock, pickDesignSystem, hashSeed } from "@/lib/websiteDesignSystems";

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

// Color variants — same business name → same variant on every regeneration,
// different business name in the same niche → different look. Variant 0 of
// each entry preserves the previously-shipped palette so existing sites stay
// visually stable if regenerated.
type ColorVariant = {
  primary: string;
  accent: string;
  background: string;
  gradients: string;
};

const COLOR_VARIANTS: Record<string, ColorVariant[]> = {
  "Roofing / Exterior": [
    { primary: "#1e3a5f", accent: "#e87722", background: "#ffffff with #f7f7f5 alternating sections", gradients: "slate → midnight hero overlay only" },
    { primary: "#2d4a32", accent: "#d4a017", background: "#ffffff with #f5f7f3 alternating sections", gradients: "forest → amber hero overlay only" },
    { primary: "#3a2418", accent: "#c2683f", background: "#ffffff with #fdf8f3 alternating sections", gradients: "espresso → copper hero overlay only" },
  ],
  "Landscaping / Outdoor": [
    { primary: "#1a3d2e", accent: "#84a98c", background: "#ffffff with #f7f9f5 alternating sections", gradients: "forest → sage hero overlay only" },
    { primary: "#2d4a32", accent: "#c2683f", background: "#ffffff with #f4ede0 alternating sections", gradients: "moss → terracotta hero overlay only" },
    { primary: "#3d4a2a", accent: "#d4c894", background: "#ffffff with #f8f5ec alternating sections", gradients: "olive → cream hero overlay only" },
  ],
  Dental: [
    { primary: "#0f4c5c", accent: "#5fb3a5", background: "#ffffff with #f5fafa alternating sections", gradients: "teal → mint hero overlay only" },
    { primary: "#1e4e72", accent: "#f4a59f", background: "#ffffff with #f7fafd alternating sections", gradients: "pearl-blue → coral hero overlay only" },
    { primary: "#3a3530", accent: "#a8c8a0", background: "#ffffff with #faf8f4 alternating sections", gradients: "warm-clay → sage hero overlay only" },
  ],
  "Beauty / Medspa": [
    { primary: "#3d2936", accent: "#d4a5a5", background: "#ffffff with #faf5f5 alternating sections", gradients: "mauve → blush hero overlay only" },
    { primary: "#2a2520", accent: "#c9a394", background: "#ffffff with #f8f3ee alternating sections", gradients: "champagne-noir → rose-gold hero overlay only" },
    { primary: "#1f3329", accent: "#e8d9c4", background: "#ffffff with #f6f4ee alternating sections", gradients: "deep-emerald → pearl hero overlay only" },
  ],
  "Law / Professional": [
    { primary: "#0a1929", accent: "#b08968", background: "#ffffff with #f7f5f0 alternating sections", gradients: "navy → bronze hero overlay only" },
    { primary: "#1d3a2f", accent: "#d4c4a0", background: "#ffffff with #f7f5ee alternating sections", gradients: "oxford-green → ivory hero overlay only" },
    { primary: "#3a1f24", accent: "#b89968", background: "#ffffff with #faf5f1 alternating sections", gradients: "burgundy → brass hero overlay only" },
  ],
  "Home Services / Trades": [
    { primary: "#1c1c1c", accent: "#d4471f", background: "#ffffff with #f7f7f7 alternating sections", gradients: "charcoal → black hero overlay only" },
    { primary: "#0b2545", accent: "#ffb703", background: "#ffffff with #f5f7fa alternating sections", gradients: "navy → safety-yellow hero overlay only" },
    { primary: "#1f2e22", accent: "#f6b72e", background: "#ffffff with #f5f7f3 alternating sections", gradients: "forest → safety-yellow hero overlay only" },
  ],
  Automotive: [
    { primary: "#0a0a0a", accent: "#dc2626", background: "#ffffff with #f5f5f5 alternating sections", gradients: "black → graphite hero overlay only" },
    { primary: "#1a1a1a", accent: "#0066ff", background: "#ffffff with #f4f6fa alternating sections", gradients: "graphite → electric-blue hero overlay only" },
    { primary: "#2a2018", accent: "#b8b8b8", background: "#ffffff with #f5f3f0 alternating sections", gradients: "matte-bronze → chrome hero overlay only" },
  ],
  "Real Estate": [
    { primary: "#2c2825", accent: "#c9a67c", background: "#ffffff with #faf7f2 alternating sections", gradients: "warm-black → champagne hero overlay only" },
    { primary: "#1c1d20", accent: "#a07f3a", background: "#ffffff with #f6f3ed alternating sections", gradients: "ink → brass hero overlay only" },
    { primary: "#1a2a3a", accent: "#d8c19a", background: "#ffffff with #f7f3ec alternating sections", gradients: "ocean-navy → sand hero overlay only" },
  ],
  "Food / Hospitality": [
    { primary: "#3a1f1a", accent: "#d97757", background: "#ffffff with #fdf8f3 alternating sections", gradients: "espresso → terracotta hero overlay only" },
    { primary: "#1f1c1a", accent: "#e8c878", background: "#ffffff with #f9f5ed alternating sections", gradients: "charcoal → butter hero overlay only" },
    { primary: "#1f3a2a", accent: "#f0e3c8", background: "#ffffff with #f7f4eb alternating sections", gradients: "forest-green → cream hero overlay only" },
  ],
  "Fitness / Coaching": [
    { primary: "#0f0f0f", accent: "#84cc16", background: "#ffffff with #f5f5f5 alternating sections", gradients: "black → lime hero overlay only" },
    { primary: "#0a0a0a", accent: "#d4ff3a", background: "#ffffff with #f4f4f4 alternating sections", gradients: "black → neon-green hero overlay only" },
    { primary: "#18181b", accent: "#f97316", background: "#ffffff with #f6f5f3 alternating sections", gradients: "graphite → magma hero overlay only" },
  ],
  "Tech / Agency": [
    { primary: "#0f0f23", accent: "#6366f1", background: "#ffffff with #fafafa alternating sections", gradients: "indigo → violet hero overlay only" },
    { primary: "#0a0a0a", accent: "#06b6d4", background: "#ffffff with #f7fafc alternating sections", gradients: "ink → cyan hero overlay only" },
    { primary: "#050505", accent: "#f0db4f", background: "#ffffff with #f6f5ee alternating sections", gradients: "black → acid-yellow hero overlay only" },
  ],
  "Cleaning Services": [
    { primary: "#1e40af", accent: "#38bdf8", background: "#ffffff with #f0f9ff alternating sections", gradients: "blue → sky hero overlay only" },
    { primary: "#047857", accent: "#e0f2fe", background: "#ffffff with #f0f7f3 alternating sections", gradients: "spearmint → cloud hero overlay only" },
    { primary: "#4338ca", accent: "#fde047", background: "#ffffff with #f6f5fb alternating sections", gradients: "lavender-blue → lemon hero overlay only" },
  ],
  "Pet / Veterinary": [
    { primary: "#6b4423", accent: "#f97316", background: "#ffffff with #fdf8f3 alternating sections", gradients: "walnut → coral hero overlay only" },
    { primary: "#0ea5e9", accent: "#facc15", background: "#ffffff with #f0f9ff alternating sections", gradients: "sky → sun hero overlay only" },
    { primary: "#1f3a2a", accent: "#fda4af", background: "#ffffff with #f5faf6 alternating sections", gradients: "forest → peach hero overlay only" },
  ],
  "Creative / Events": [
    { primary: "#2d2a26", accent: "#c9a0dc", background: "#ffffff with #faf7f5 alternating sections", gradients: "warm-black → lavender hero overlay only" },
    { primary: "#1c1c1c", accent: "#c9a67c", background: "#ffffff with #fde0d0 alternating sections", gradients: "ink → gold hero overlay only" },
    { primary: "#2a1d3a", accent: "#d4b58a", background: "#ffffff with #f6f3f7 alternating sections", gradients: "deep-violet → champagne hero overlay only" },
  ],
  "Healthcare / Wellness": [
    { primary: "#134e4a", accent: "#5eead4", background: "#ffffff with #f0fdfa alternating sections", gradients: "teal → mint hero overlay only" },
    { primary: "#5b4b6e", accent: "#a8c8a0", background: "#ffffff with #f6f4f8 alternating sections", gradients: "lavender → sage hero overlay only" },
    { primary: "#4a4239", accent: "#f8b6a8", background: "#ffffff with #f8f5f2 alternating sections", gradients: "warm-stone → soft-coral hero overlay only" },
  ],
  "General Business": [
    { primary: "#0f172a", accent: "#6366f1", background: "#ffffff with #fafafa alternating sections", gradients: "slate → indigo hero overlay only" },
    { primary: "#0c1c2e", accent: "#b8896a", background: "#ffffff with #f6f4f1 alternating sections", gradients: "navy → bronze hero overlay only" },
    { primary: "#1a2e25", accent: "#f59e0b", background: "#ffffff with #f5f7f4 alternating sections", gradients: "forest → amber hero overlay only" },
  ],
};

function applyColorVariant(palette: PaletteHint, seed: number): PaletteHint {
  const variants = COLOR_VARIANTS[palette.label];
  if (!variants?.length) return palette;
  const variant = variants[seed % variants.length];
  return { ...palette, ...variant };
}

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

// Picsum gives us a guaranteed-loading image keyed by a stable seed. Not
// niche-relevant, but at least the page never has empty image slots.
function seededPicsum(seed: string, width: number, height: number): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`;
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

    const hero = claim(heroPool, seededPicsum(`${k}-hero`, 1920, 1080));
    const services = p.services.map((s, i) => ({
      name: s.name,
      keyword: s.keyword,
      url: claim(servicePools[i], seededPicsum(`${s.keyword}-${i}`, 800, 600)),
    }));
    const portfolio = [0, 1, 2].map((i) =>
      claim(portfolioPool, seededPicsum(`${k}-portfolio-${i}`, 1200, 800)),
    );

    return { hero, services, portfolio, source: "pexels", fallback };
  }

  // Pexels failed — fall back to picsum (always loads, niche-stable seeds).
  return {
    hero: seededPicsum(`${k}-hero`, 1920, 1080),
    services: p.services.map((s, i) => ({
      name: s.name,
      keyword: s.keyword,
      url: seededPicsum(`${s.keyword}-${i}`, 800, 600),
    })),
    portfolio: [0, 1, 2].map((i) => seededPicsum(`${k}-portfolio-${i}`, 1200, 800)),
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

  const { prospectId, name, service, phone, email, address, contactName, tier = "standard", extraInstructions } =
    await req.json();
  const extra = typeof extraInstructions === "string" ? extraInstructions.trim().slice(0, 2000) : "";
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

  // Hash the business name into a stable seed so the same name always picks the
  // same variant on regeneration, but a different name in the same niche gets a
  // different palette. Variant 0 of each niche preserves the original palette.
  const seed = hashSeed(name);
  const palette = applyColorVariant(paletteForNiche(service), seed);
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

  const designSystemId = pickDesignSystem(palette.label, seed);
  const lockedDesignBlock = buildLockedDesignSystemBlock(
    designSystemId,
    { label: palette.label, mood: palette.mood, accent: palette.accent, primary: palette.primary },
    { hero: images.hero, services: images.services, portfolio: images.portfolio, fallback: images.fallback },
  );

  const systemPrompt = `You are a senior editorial web designer producing conversion-optimized single-file landing pages for small businesses. Your output is a complete, self-contained HTML document with hand-written CSS — the design system is LOCKED below. Your work is indistinguishable from a $3,000 custom-built site.

CRITICAL: Use ONLY the CSS provided in the locked design system below. Do NOT add Tailwind CDN. Do NOT add Lucide CDN. Do NOT use Tailwind utility classes. Do NOT invent your own layout, palette, or typography. The design system tells you exactly which CSS to embed and which class names to use — your job is to fill in real, niche-specific content.

${paletteBlock}

${logoBlock}

${lockedDesignBlock}

CONVERSION COPY RULES:
- Aspirational transformation headlines, NOT feature lists.
- Specific, credible numbers in the stats section ("15+ Years", "500+ Projects"). Never "many" or "lots".
- Every contact surface uses tel: and mailto: links. If an address is provided, wrap it in a Google Maps link.
- Services must be SPECIFIC to the niche, derived from the business info — not generic filler.
- Generate realistic testimonials with plausible names, cities, and specific details.

${footerBrandingLine}

TECHNICAL:
- Single self-contained HTML file. All CSS lives in the <style> block from the locked design system above.
- Google Fonts via <link> tag in <head> exactly as specified in the locked design system.
- Semantic HTML5 (header, nav, section, article, footer).
- Alt text on every image. Every <img> tag must include the onerror fallback specified in the locked block.
- DO NOT include the Tailwind CDN script. DO NOT include the Lucide CDN script. The locked CSS already covers all visual styling.

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
${extra ? `\nADDITIONAL DESIGN DIRECTION FROM THE USER (apply these on top of the rules above; if anything below conflicts with the structural/format/preserve rules, the structural/format/preserve rules win):\n"""\n${extra}\n"""\n` : ""}
Produce the full page per the structure above, at the quality of a professionally designed agency site. Return the complete HTML document only.`;

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

    // The locked design systems use inline SVG icons, not Lucide. But if the
    // model slipped in any data-lucide attributes anyway, inject the CDN +
    // init so they render instead of showing as empty <i> tags.
    if (/data-lucide=/.test(html)) {
      html = html.replace(
        /<script([^>]*?)\btype=["']module["']([^>]*?)src=["'][^"']*lucide[^"']*["']([^>]*)><\/script>/gi,
        (_m, a, b, c) => `<script${a}${b}src="https://unpkg.com/lucide@latest/dist/umd/lucide.js" defer${c}></script>`,
      );
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
    }

    // Swap logo placeholder for the real uploaded PNG URL (or leave empty if
    // logo gen failed — the prompt will have told the model to fall back to SVG).
    if (logoUrl) {
      html = html.split("__NN_LOGO_URL__").join(logoUrl);
    }

    // Inject the form-submit handler. Any <form data-nn-form> in the generated
    // markup gets wired to POST /api/websites/{siteId}/submit — that's how
    // leads make it from the public site back into the owner's prospects CRM.
    html = ensureFormHandler(html, siteId);

    // Hard guarantee: a white-label site never ships with a "Powered by NextNote"
    // badge, even if the model ignored the prompt instruction.
    if (tier === "whitelabel") {
      html = stripPoweredByBadge(html);
    }

    // White-label sites get a {slug}.pitchsite.dev public URL — reserve the
    // slug now so it's persisted alongside the HTML.
    const slug = tier === "whitelabel" ? await reserveUniqueSlug(session.userId, name) : null;

    const { error: dbErr } = await supabaseAdmin.from("generated_websites").insert({
      id: siteId,
      user_id: session.userId,
      prospect_id: prospectId || null,
      prospect_name: name,
      html_content: html,
      tier,
      slug,
    });

    if (dbErr) {
      return NextResponse.json({ error: `Failed to save website: ${dbErr.message}` }, { status: 500 });
    }

    await deductCredits(session.userId, creditCost, {
      reason: "website_generation",
      refId: siteId,
      metadata: { prospectId, prospectName: name, tier },
    });

    // Register the white-label subdomain with Vercel so it provisions an
    // HTTPS cert. Failure is non-fatal: the row is saved, the user can
    // re-trigger registration later, and the rest of the response is unaffected.
    let domainError: string | null = null;
    if (slug) {
      const result = await addVercelDomain(`${slug}.${WHITELABEL_HOST}`);
      if (!result.ok) {
        domainError = result.error;
        console.error(`[white-label] Vercel domain attach failed for ${slug}.${WHITELABEL_HOST}: ${result.error}`);
      }
    }

    return NextResponse.json({
      siteId,
      tier,
      slug,
      publicUrl: slug ? `https://${slug}.${WHITELABEL_HOST}` : null,
      domainError,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
