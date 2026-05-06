import crypto from "crypto";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { getUserAIConfig, aiChatDetailed } from "@/lib/ai";
import {
  getBalance,
  deductCredits,
  WEBSITE_GENERATION_CREDITS,
  WEBSITE_WHITELABEL_CREDITS,
} from "@/lib/credits";
import { supabaseAdmin } from "@/lib/supabase";
import { generateBusinessLogo } from "@/lib/logo";
import {
  ensureFormHandler,
  ensureContactForm,
  ensureImageFallbacks,
  stripPoweredByBadge,
} from "@/lib/websiteForms";
import { reserveUniqueSlug, WHITELABEL_HOST } from "@/lib/websiteDomains";
import { addVercelDomain } from "@/lib/vercelDomains";
import { gatherProspectContext } from "@/lib/website/gatherContext";

export const maxDuration = 300;

// Fetch a small pool of Pexels photos so Claude has real, on-brand imagery
// instead of placehold.co boxes — but we no longer dictate which photo lands
// where. Claude picks. PEXELS_API_KEY is optional; we fall back to picsum.
async function fetchPexelsPool(query: string, count: number): Promise<string[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key || !query.trim()) return [];
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${Math.min(Math.max(count, 8), 24)}&orientation=landscape&size=large`;
    const res = await fetch(url, {
      headers: { Authorization: key },
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

function picsum(seed: string, w: number, h: number): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

function buildImageryBlock(pool: string[], fallbackSeed: string): string {
  if (pool.length > 0) {
    return [
      "REAL PHOTO POOL (free Pexels stock, commercial-use, no attribution required):",
      ...pool.map((u, i) => `  [${i + 1}] ${u}`),
      `Fallback if any URL fails to load: ${picsum(`${fallbackSeed}-fallback`, 1200, 800)}`,
      "",
      "RULES:",
      "- Pick whichever photos actually fit the section you're building. You are NOT required to use all of them.",
      "- Don't invent other image URLs (no unsplash.com/source.unsplash.com, no placehold.co, no via.placeholder.com, no \"image1.jpg\" relative paths).",
      "- Content imagery (hero photo, about-collage photos, alternating feature rows, testimonial avatars if photographed) MUST be real <img> tags with src=\"https://...\" pointing at one of the URLs above. NEVER use CSS \`background-image: url(...)\` for content photos — only <img>. Decorative gradient/noise overlays via CSS are fine.",
      "- Every <img> must include descriptive alt text and this onerror fallback verbatim:",
      `    onerror="this.onerror=null;this.src='${picsum(`${fallbackSeed}-fallback`, 1200, 800)}'"`,
      "- The about-section image collage (two overlapping photos) is the most-skipped element — make sure both <img> tags are present, each with src + alt + onerror.",
    ].join("\n");
  }
  // No Pexels available — give Claude stable picsum seeds as a fallback pool.
  const seeds = [
    picsum(`${fallbackSeed}-1`, 1920, 1080),
    picsum(`${fallbackSeed}-2`, 1600, 1000),
    picsum(`${fallbackSeed}-3`, 1200, 800),
    picsum(`${fallbackSeed}-4`, 1200, 800),
    picsum(`${fallbackSeed}-5`, 1000, 1000),
  ];
  return [
    "PHOTO POOL (placeholders — Pexels API key not configured, these are picsum stand-ins):",
    ...seeds.map((u, i) => `  [${i + 1}] ${u}`),
    "Use these as needed. Don't invent other URLs.",
  ].join("\n");
}

function buildLogoBlock(logoUrl: string | null): string {
  if (logoUrl) {
    return [
      "LOGO ASSET — a transparent-PNG icon-mark has already been generated for this business. Use it in the nav and footer:",
      "- Use this exact placeholder string for the src attribute: __NN_LOGO_URL__",
      '  Example: <img src="__NN_LOGO_URL__" alt="[Business] logo" class="h-9 w-auto" />',
      "- Pair the icon with a styled text wordmark of the business name to its right.",
      "- Do not replace the placeholder string — it gets swapped server-side with the real CDN URL.",
    ].join("\n");
  }
  return [
    "LOGO — no pre-generated asset. Either:",
    "  (a) Hand-craft a small inline <svg> mark that depicts the business's industry (a tooth for dental, a wrench for trades, a leaf for wellness, etc.), or",
    "  (b) Use clean wordmark-only typography for the brand lockup.",
    "Whichever fits the design better. Do not use Lucide / Heroicons / emoji as the brand mark.",
  ].join("\n");
}

const OUTPUT_FORMAT = `OUTPUT FORMAT (strict):
- Your FIRST characters MUST be "<!DOCTYPE html>".
- Your LAST characters MUST be "</html>".
- NO markdown code fences. NO preamble like "Here is...". NO trailing commentary.
- Return the full document only.
- Never truncate, never use "...", never leave placeholder copy.

OUTPUT BUDGET: aim for roughly 22,000–26,000 tokens of HTML in total. Be polished and comprehensive but disciplined — don't pad CSS with redundant rules, don't repeat Tailwind utilities verbatim in <style>, and prefer Tailwind classes over hand-written CSS where they're equivalent. Avoid repeating verbose inline-SVG icons inside list items — define a reusable check-icon class once and use a shared <span class="check"></span> mark, OR use a single small font-mono "✓" character.

COMPLETION PRIORITY (critical): always finish with a clean </html> tag. If you sense you're running long, SIMPLIFY later sections rather than truncating — collapse a 6-card grid to 4, shorten testimonial paragraphs, drop the optional journal/resources section. A complete 10-section page is dramatically better than a truncated 12-section page with no footer.`;

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    prospectId,
    name,
    service,
    phone,
    email,
    address,
    contactName,
    tier = "standard",
    extraInstructions,
    enrichWithMaps,
  } = body as {
    prospectId?: string | null;
    name?: string;
    service?: string;
    phone?: string;
    email?: string;
    address?: string;
    contactName?: string;
    tier?: "standard" | "whitelabel";
    extraInstructions?: string;
    enrichWithMaps?: boolean;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Business name is required" }, { status: 400 });
  }

  const cleanName = name.trim();
  const cleanService = (service ?? "").trim();
  const cleanPhone = (phone ?? "").trim();
  const cleanEmail = (email ?? "").trim();
  const cleanAddress = (address ?? "").trim();
  const cleanContact = (contactName ?? "").trim();
  const userPrompt = (extraInstructions ?? "").trim().slice(0, 4000);

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

  // The public site URL is unguessable on purpose — sharing it = authorizing it.
  const siteId = `site-${crypto.randomBytes(16).toString("hex")}`;
  const fallbackSeed = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32) || "business";

  // Pull (a) Outscraper Maps data when we have something to look it up by, and
  // (b) a stock-photo pool keyed off the service term — both in parallel with
  // logo generation so we don't pay sequential latency.
  const shouldEnrich = enrichWithMaps !== false && Boolean(cleanAddress || cleanName);
  const photoQuery = cleanService || cleanName;

  const [contextResult, photoPool, logoUrl] = await Promise.all([
    shouldEnrich
      ? gatherProspectContext({
          name: cleanName,
          address: cleanAddress || null,
          service: cleanService || null,
          mapsUrl: null,
        })
      : Promise.resolve(null),
    fetchPexelsPool(photoQuery, 12),
    generateBusinessLogo(
      {
        label: cleanService || "General Business",
        accent: "#6366f1",
        primary: "#0f172a",
        logoConcept: cleanService
          ? `a clean pictorial mark for a ${cleanService} business`
          : "a clean modern mark for the business",
      },
      cleanName,
      siteId,
    ).catch(() => null),
  ]);

  const realDataBlock = contextResult?.ok && contextResult.block ? contextResult.block : "";
  const imageryBlock = buildImageryBlock(photoPool, fallbackSeed);
  const logoBlock = buildLogoBlock(logoUrl);

  const footerBranding =
    tier === "whitelabel"
      ? "BRANDING: this site is white-labeled — do NOT include any \"Powered by NextNote\" badge or third-party branding."
      : "BRANDING: include a small, tasteful \"Powered by NextNote\" link in the footer (single line, muted gray, href=\"https://nextnote.to\" target=\"_blank\"). Don't make it loud.";

  const systemPrompt = `You are an expert front-end designer and engineer building a complete, production-ready marketing website for a real local business. The output should be polished, modern, and visually rich — NOT minimalist or stripped-down. Aim for the kind of site a senior agency would deliver to a paying client: layered visual depth, soft tinted shadows, subtle gradients, tasteful imagery, refined micro-interactions, and a comprehensive section structure that makes the page feel real.

Build a single self-contained HTML document — one file, no build step.

================================================================
HARD OUTPUT RULES — read first, never violate
================================================================

This file is served as STATIC HTML. There is no React, no JSX, no Astro, no build step, no template engine, and no server-side render pass. Anything that looks like a templating expression in the markup will appear as literal text on the page.

ABSOLUTELY FORBIDDEN inside markup (text nodes, attributes, anywhere that isn't inside a <script> tag):
  - JSX expressions: \`{foo}\`, \`{cities.map(c => ...)}\`, \`{condition && ...}\`
  - Template-literal interpolation: backtick strings with \`\${...}\` placeholders
  - Array.map / Array.join / Array.filter calls written into HTML
  - Mustache / Handlebars / Liquid / Jinja syntax: \`{{foo}}\`, \`{% for ... %}\`
  - Any \`<%= ... %>\`, \`<?= ... ?>\`, or other server-side template tags

If you need to render a list of items (service-area chips, menu items, FAQ rows, testimonials, etc.), WRITE OUT EVERY ITEM AS LITERAL HTML. Repeat the markup N times by hand. Yes, even if there are 10+ items. Do NOT write a JS expression and hope it gets evaluated — it will not. The reader will see the raw \`{cities.map(...)}\` source code on the rendered page.

The only place JS is allowed: inside <script> tags at the end of <body>, where it can run in the browser to wire up interactivity (FAQ accordion, mobile nav toggle, scroll-reveal, counter animation). Even there, do NOT use \`document.write\` or \`innerHTML = \\\`\${...}\\\`\` to inject content — the static markup must stand on its own.

================================================================
TECH SETUP
================================================================

- Tailwind via CDN: <script src="https://cdn.tailwindcss.com"></script>.
- IMPORTANT — register your brand palette with Tailwind so utility classes resolve. Immediately after the Tailwind CDN script, add:
  <script>
    tailwind.config = { theme: { extend: { colors: {
      primary:   '#HEX',
      secondary: '#HEX',
      accent:    '#HEX',
      accent2:   '#HEX',
      surface:   '#HEX'
      // plus any other named tokens you reference (ink, paper, brass, ember, forest, etc.)
    } } } }
  </script>
  Every custom color class you use anywhere in the markup MUST be registered here, otherwise it silently fails and the page renders without brand color.
- Google Fonts via <link> — pick the actual typefaces you want for this business.
- A focused, hand-written <style> block in <head>. Define a complete design-token system as CSS variables in :root (colors, spacing scale, radii, shadows, motion easings). Aim for roughly 320–480 lines of CSS — enough for tokens, body grain, scroll-reveal classes, the spinning seal animation, the FAQ accordion, the hero entry choreography keyframes, the ken-burns image animation, the headline accent underline draw-in, the icon stroke-draw transitions, the cursor-spotlight ::before, custom hover states, and niche-specific feature styling that Tailwind can't express cleanly. Do NOT re-implement utilities Tailwind already provides (don't write classes for padding, margin, flex, grid, font-size, basic colors — use Tailwind for those directly in markup). Hand-written CSS is for what's genuinely custom. Conserving CSS budget is critical: token caps are real and over-running CSS WILL truncate the page mid-section.
- A <script> at the end of <body> implementing the required interactive behaviors below.

================================================================
DESIGN TOKEN SYSTEM (define in :root)
================================================================

Colors — pick FIVE that authentically match the industry:
  --primary    — main brand color (key CTAs, brand mark, focal accents)
  --secondary  — complementary deeper or contrasting tone (dark sections, footer)
  --accent     — bright/warm highlight color (active states, hover glows, badges)
  --accent2    — tonal supporting accent (subtle decoration, mono labels)
  --surface    — neutral page background (almost NEVER pure white — pick a warm cream, oat, sand, fog, ink-ivory, etc.)
Plus a deep text color (charcoal/espresso/forest/navy — almost never pure black) and a hairline/border color.

Niche-appropriate palette guidance (pick what genuinely fits — adapt to the business):
  - Wellness / spa / yoga: earthy greens, terracotta, sand, oatmeal
  - Finance / law / private wealth: deep blues, ink, charcoal, warm gold accent
  - Creative agency / design studio: bold accent + neutral base + electric secondary
  - Hospitality / restaurants / hotels: warm neutrals, deep crimson or forest, brass, cream
  - HVAC / plumbing / trades / electrical: confident blues or oranges, charcoal, steel-gray, ember accent
  - Coffee / artisan food / bakery: warm browns, paper, ember, crema gold
  - Real estate / construction / contracting: navy or forest, warm sand, brass, off-white
  - Healthcare / dental / medical: trust-blue or sage green, warm white, soft accent
  - Tech / SaaS / B2B: deep ink base + bold accent + tonal supporting
  - Auto / repair / detailing: deep charcoal, racing red or steel blue, brushed metal
  - Salon / beauty: blush, rose, mauve, warm cream, gold
  - Fitness / gym: bold high-energy accent, dark base, electric secondary
Avoid Tailwind's default \`indigo\`, \`sky\`, \`emerald\` as the brand color — define your own hex values.

Typography — pick TWO Google Fonts (occasionally three):
  --font-display — distinctive headline font (often a serif or expressive grotesk)
  --font-body    — highly readable body font (clean grotesk or humanist sans)
  --font-mono    — optional monospaced accent for eyebrow labels and meta
Use weights 300–500 for body and 400–600 for display. Use clamp() for fluid display sizing.

Spacing scale: --space-1 (0.25rem) through --space-32 (8rem).
Radii: --radius-sm (6px), --radius-md (12px), --radius-lg (20px), --radius-xl (32px). Pick the radius that fits the brand (sharp for finance/legal, soft for wellness/hospitality).
Shadows: define --shadow-sm/md/lg/glow. Use COLOR-TINTED shadows derived from your ink color (e.g. \`box-shadow: 0 16px 48px rgba(31, 22, 17, 0.12), 0 2px 8px rgba(31, 22, 17, 0.06)\`) — NOT plain black box-shadows.
Motion easings: --ease-out: cubic-bezier(0.22, 1, 0.36, 1) for entrances; --ease-in-out for hovers.
Body grain overlay: a faint base64-encoded SVG noise/grain on body::before with mix-blend-mode: multiply and ~0.4 opacity gives the page tactile depth.

================================================================
REQUIRED PAGE STRUCTURE — build these sections in order
================================================================

REQUIRED (must include all): header, hero, services/offerings, niche-specific feature, about, testimonials, pricing OR FAQ (pick one), contact (with map embed when address present), footer.

OPTIONAL (include only if your token budget allows — do NOT include all of these or you WILL truncate): stats strip with animated counters, alternating image-and-text features, journal/resources. Pick at most ONE optional section. A complete 9-section page beats an over-ambitious 13-section page that truncates mid-footer.

(1) STICKY HEADER / NAV
    Backdrop-blurred translucent background; a scroll-state class that adds a subtle bottom border + slightly more opaque background once the user scrolls past 24px; logo (inline-SVG mark + wordmark with the ampersand or one word italicized in --primary); 4–6 menu links with an animated underline-from-left on hover; one secondary text/outline button + one primary filled CTA button; a hamburger that toggles a full-width dropdown on mobile.

(2) HERO
    Two-column grid (1.1fr / 1fr), with a soft radial-gradient background (e.g. \`radial-gradient(ellipse at top right, rgba(accent,0.18), transparent 50%), radial-gradient(ellipse at bottom left, rgba(secondary,0.12), transparent 60%)\`).
    Left: small eyebrow ("Eyebrow Text · Est. YYYY" or industry tagline) with a 24px hairline accent before it; a large display headline using clamp(2.8rem, 6.5vw, 5.5rem) with ONE italicized word in --primary; a subheadline paragraph; primary + secondary CTA buttons (pill-shaped, with arrow SVG that translates-X on hover); a meta strip below with 3 stat blocks separated by a top hairline (e.g. rating from data, hours, key trust signal — using ONLY data-block facts).
    Right: a portrait-aspect (4:5) image card with a deep tinted shadow and rounded radius-xl corners — pick a photo from the photo pool. A floating BADGE card overlapping the bottom-left corner: a circular gradient icon tile + a small block of text (rating + review count, hours, trust badge). A decorative spinning seal in the top-right: a 130px circular dark disk with rotating uppercase text around its edge ("CertifiedTechnicians · LocallyOwned · " etc.) — animation: spin 30s linear infinite.
    HERO ENTRY CHOREOGRAPHY (required): the hero is above the fold and never enters via the IO scroll-reveal — instead, give each child a CSS \`@keyframes heroIn\` that animates from \`opacity:0; transform:translateY(18px)\` to \`opacity:1; transform:none\` over 700ms with --ease-out. Stagger via animation-delay: eyebrow 0ms, headline 120ms, subhead 240ms, CTA row 360ms, meta strip 480ms, image card 560ms (start image at scale(0.96), end at scale(1)). The whole sequence completes in under 1.3s. Inside @media (prefers-reduced-motion: reduce), set animation-duration: 0.01ms on all .hero-in elements so users with motion sensitivity see the final state immediately.
    HERO IMAGE KEN-BURNS: the hero image inside its card has a slow infinite \`@keyframes kenBurns\` of \`transform: scale(1) translate(0,0)\` → \`transform: scale(1.06) translate(-1.5%, -1%)\` over 14s alternate ease-in-out. Disable inside prefers-reduced-motion.
    HEADLINE ACCENT UNDERLINE: position the italicized accent word in the headline with \`position: relative\` and append an inline SVG hand-drawn squiggle/underline (path stroke=--primary, stroke-width 3, stroke-linecap round, viewBox covering the word's width) absolutely positioned just below the word's baseline. Animate \`stroke-dasharray\` + \`stroke-dashoffset\` from \`(pathLength, pathLength)\` to \`(pathLength, 0)\` over 900ms with a 700ms delay so it draws AFTER the headline finishes fading in. CSS-only — no JS measurement needed; pick a fixed dasharray that matches your path's approximate length.

(3) SERVICES / OFFERINGS
    3–6 cards in an auto-fit grid (minmax 280px). Each card: a 56×56 colored icon tile with a hand-drawn inline SVG (stroke-width 1.5, NOT Lucide/Heroicons), a display-font title, a 1–2 sentence description, and a "Learn More →" link in mono-font uppercase. Card hover: translateY(-6px) + shadow + border-color shift to accent + a subtle gradient overlay fade-in via ::before. Don't repeat the same generic icons — vary them so each service is visually distinct.
    ICON STROKE-DRAW: each inline SVG icon path uses a class like \`.icon-draw path\` with \`stroke-dasharray: 200; stroke-dashoffset: 200\`. When the parent card gets the \`.visible\` class from the IntersectionObserver, transition stroke-dashoffset to 0 over 1100ms with --ease-out and a 120ms-per-card stagger via \`transition-delay: calc(var(--idx) * 120ms)\` (set --idx inline on each card 0..N). Reduced-motion: skip the transition and start at offset 0. Pick a dasharray length that's longer than your actual path (200 covers most simple icons); slight overshoot is fine.

(4) NICHE-SPECIFIC FEATURE SECTION (this is what makes the page feel real)
    Build the section that genuinely fits THIS business's industry:
      • Restaurant / café / bar → menu section with filterable tabs (all / appetizers / mains / drinks); each item card has a photo, name, description, and price
      • Coffee roaster / artisan food → product menu cards with origin, roast level pill, tasting-notes pills, price + small grams unit, "Add to Cart" button
      • Law firm / lawyer → practice areas grid + attorney profile cards (photo, name, bar admission, specialties)
      • HVAC / plumbing / trades / electrical → emergency-service callout strip + 3-tier service-plan comparison + service-area chips list + "Brands we service" logo strip
      • Fitness / gym / yoga / pilates → weekly class schedule grid (Mon–Sun columns) + trainer profile cards
      • Healthcare / dental / medical / chiropractic → services grid + "Book an appointment" callout + insurance-accepted strip
      • Real estate / agent → featured property listings (photo, beds/baths/sqft, price, agent attribution)
      • Auto repair / detailing / dealership → service categories + vehicle-make support strip + estimate request callout
      • Salon / barber / spa → treatment menu rows (treatment + duration + price + Book button per row)
      • Construction / contracting / remodeling → project portfolio gallery with category filters
      • SaaS / agency / B2B → integrations strip + featured case study + product demo callout
      • Pet services / grooming / vet → service tiers + pet-type chips + booking callout
      • Photography / videography → portfolio gallery with category filters + package tiers
    The section should be content-rich and functional-feeling, not decorative. Filterable tabs / accordions / cards are appropriate here. Use specific, plausible content (real-sounding service names, plausible price points for the niche, etc.) — NOT generic placeholders.

(5) ABOUT / STORY
    Two-column. One side: an asymmetric overlapping image collage — one larger portrait image (3:4) at top-left in z-index 2, plus one smaller square image at bottom-right with a 6px paper-color border partially overlapping. Other side: eyebrow + section headline (with italicized accent word) + an italic display-font lead paragraph in --primary as a pull-quote + 2–3 short body paragraphs in --stone color + a 2×2 grid of values/differentiators below a top hairline (each cell: bold short label + 1-line description).

(6) STATS STRIP
    Full-width darker section using --secondary as background. Container holds a 4-column grid of stat blocks (responsive collapse to 2 on tablet). Each stat: a giant display-font number (clamp(2.5rem, 5vw, 4rem)) in --accent2, plus a uppercase mono-font label below in muted cream. Numbers animate counting up via JS when scrolled into view (data-count attribute).
    HARD RULE: only use numbers that are GROUNDED in the real-data block below (review count, average rating, "open 24/7" → "24/7", hours-per-week, days-per-week). Do NOT fabricate "30 years experience", "500+ clients served", etc. If you don't have 4 grounded stats, use 2 grounded ones plus self-evident facts ("Open 7 Days", "Same-Day Service" etc. — only if obviously true) or shrink the strip.

(7) FEATURES / BENEFITS — alternating image-and-text rows
    Two rows minimum. Row 1: image left + content right. Row 2: image right + content left (use a .reverse class). Each row's content side: a section title (clamp(1.8rem, 3vw, 2.5rem)), a paragraph, and a checked-list of 3 specific benefits. Each list item: a 28px circular accent-colored check tile + a bold display-font short label + 1-line description. Each row's image side: a radius-xl rounded image card with deep shadow.

(8) SOCIAL PROOF / TESTIMONIALS
    Section title + a 3-column grid of testimonial cards. Each card: an oversized decorative quote mark (font-size: 4rem) in --accent at 0.3 opacity, positioned absolute top-left; a 5-star row in --accent below; the testimonial paragraph; a divider hairline; a footer with a 44px circular avatar + display-font bold name + mono-font role/context. Hover: translateY(-4px) + shadow.
    Pull testimonials from the REAL review data in the data-block — paraphrase, don't quote verbatim, attribute as "First-name L." with a plausible role context only if obvious from the review. If no review data is provided, OMIT this section rather than fabricate quotes.

(9) PRICING / PACKAGES
    3-tier comparison cards in a 3-column grid (max-width 1080px, centered). The middle card is .featured: --secondary or --bark dark background with cream text, scaled up 1.04, with a "Most Popular" pill positioned top-center. Each card: tier name, short description, price-amount-row (with currency, big amount in display font, period label in mono), feature checklist with green-circle checks (each feature 0.95rem), and a full-width CTA button. Skip this section ONLY if the business genuinely has no package-able offerings — most do (service tiers, membership levels, subscription cadence).

(10) FAQ
    Centered max-width 800px. 5–7 expandable accordion items. Hairline divider between items, top and bottom borders too. Each: a button with the question in display font + a 32×32 circular toggle (+ icon, rotated 45° to × when expanded). Click toggles aria-expanded and the answer's max-height with cubic-bezier ease. The answer paragraph is 1rem, 1.7 line-height, in --stone, max-width 92%.
    Questions must be SPECIFIC to this business and industry — not generic. Examples: HVAC → "Do you offer same-day emergency service?", "What brands do you service?", "Do you provide free estimates on installations?". Coffee shop → "How fresh is the coffee when it arrives?", "Can I change my subscription cadence?".

(11) JOURNAL / RESOURCES (optional — include if it fits)
    Section header in left-aligned style (eyebrow + headline on left, "All Articles →" button on right). 3-column grid of article preview cards: 16:10 thumbnail + meta row (category · read-time, mono-font) + display-font headline + paragraph excerpt. Hover: image scale + card lift.
    Skip this section if the business clearly doesn't blog (most local trades businesses). Coffee roasters, salons, fitness studios, real estate, B2B — likely have one.

(12) CONTACT / VISIT
    Two-column.
    Left side: eyebrow + section headline + lead paragraph; then 3 stacked contact blocks each with a hairline divider, a 40px icon tile in --bark + --accent2, and label+content (Address that links to Google Maps; Hours; Phone tel: + Email mailto:). Below those: a 16:9 embedded map. Use \`https://www.google.com/maps?q=ENCODED_ADDRESS&output=embed\` for the iframe src. Apply a subtle CSS filter like \`filter: sepia(0.15) saturate(0.85)\` to the iframe so the map matches the brand palette.
    Right side: a contact-form card. Background --paper with a soft radial-gradient blob in the top-right corner via ::before. The FORM (see locked attributes below) styled with floating mono-font labels, --paper input backgrounds, hairline borders, focus state shifts border to --primary with a 3px ring. A success message div that appears on submit.

(13) FOOTER
    Dark section using --secondary. Multi-column grid: brand block (1.5fr — logo + tagline + 4 social icon circles) | Shop/Services links (1fr) | Company links (1fr) | Newsletter signup form (1.5fr). Below: a HUGE faint background wordmark of the business name (clamp(8rem, 18vw, 16rem), opacity 0.04, italicized display font, positioned absolute bottom). Bottom strip with hairline border: copyright on left + legal links on right.
    The newsletter form is decorative only — preventDefault and show "✓ Signed up!" confirmation. The contact form (above) is the real lead pipeline.

================================================================
LOCKED CONTACT FORM (backend-wired — do not deviate)
================================================================

The contact form in section 12 MUST have:
- Exactly one <form data-nn-form> element.
- FOUR VISIBLE INPUTS named exactly: \`name\`, \`email\`, \`phone\`, \`message\`. Each must be a real, visible <input> or <textarea> with a label — not a placeholder div, not an SVG mock, not "coming soon" copy. The form is non-functional without these four fields and the page will look broken (this is the most common bug in generated sites).
- Each input needs proper, visible styling: padded (e.g. py-3 px-4), full-width within its column, with a clearly visible border or background contrast. Inputs must NOT be: transparent on a transparent background, hidden behind \`opacity-0\`, collapsed to height: 0, or absolutely positioned off-screen.
- A visible submit <button type="submit"> with descriptive label ("Send Message", "Request a Quote", etc.).
- Honeypot (recommended): <input type="text" name="company_website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px">
- Status line (recommended): <p data-nn-form-status></p>

Style and layout are yours — but every named input must be present, visible, and labeled. Minimum acceptable skeleton (style classes are placeholders; pick whatever fits the design):
\`\`\`
<form data-nn-form class="...">
  <input type="text" name="company_website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px">
  <label class="..."><span>Name</span><input type="text" name="name" required autocomplete="name" class="..."></label>
  <label class="..."><span>Email</span><input type="email" name="email" required autocomplete="email" class="..."></label>
  <label class="..."><span>Phone</span><input type="tel" name="phone" autocomplete="tel" class="..."></label>
  <label class="..."><span>Message</span><textarea name="message" rows="4" required class="..."></textarea></label>
  <button type="submit" class="...">Send Message</button>
  <p data-nn-form-status></p>
</form>
\`\`\`

The server injects a submit handler that POSTs the form — your client-side JS may validate and show inline errors, but DO NOT also POST or call preventDefault on a successful submission (the injected handler needs to fire).

================================================================
INTERACTIVE BEHAVIOR (required)
================================================================

In a single <script> at the end of <body>:
- Sticky header scroll-state: toggle a \`scrolled\` class on the header when scrollY > 24.
- Mobile hamburger: click toggles a mobile-open class on the menu and an active class on the hamburger (animated to X). Clicking any nav link closes it.
- Scroll reveal: any element with class \`reveal\` fades up + translates from translateY(24px) on entry. Use IntersectionObserver (threshold 0.12, rootMargin: 0 0 -60px 0). CRITICAL: write the CSS so the visible state is \`.reveal.visible { opacity:1; transform:none; }\` and the un-revealed state is the default \`.reveal { opacity:0; transform:translateY(24px) }\`. Add a no-IO fallback that immediately marks all reveal elements visible.
- Animated counters: any element with \`data-count="N"\` counts from 0 to N over ~1.8s with cubic ease-out, triggered when its container enters viewport (threshold 0.5). Format with Intl.NumberFormat('en-US').
- FAQ accordion: clicking a .faq-q toggles aria-expanded and sets the next sibling .faq-a's max-height to scrollHeight px (or null to close). Closing all others on open creates a one-at-a-time accordion.
- Filterable tabs (if the niche feature uses them): clicking a tab updates active class + aria-selected, filters cards by data-attribute via display style.
- Newsletter form: preventDefault, show "✓ Signed up!" on the button for 2.4s, reset.
- Contact form: client-side validation only — show inline error messages on invalid fields. On valid submit, do NOT preventDefault permanently; the server-injected handler will catch the submission. (You may add validators that call preventDefault on INVALID submission only.)
- Cursor-following spotlight on dark sections: any section with class \`.spotlight\` (apply to the stats strip and footer) gets a soft radial-gradient glow at the cursor position. On mousemove, set CSS variables --mx and --my (in px) on the section element. The section's ::before is \`background: radial-gradient(420px circle at var(--mx) var(--my), rgba(accent, 0.18), transparent 60%)\`, position absolute, inset 0, pointer-events none, opacity 0 by default, opacity 1 on section:hover, transitioned. Skip on touch devices via \`@media (hover: hover) and (pointer: fine)\` — the JS handler should also early-return when matchMedia('(hover: hover)') is false. Reduced-motion: leave the gradient static at center.
- Respect \`prefers-reduced-motion\`: in CSS, kill animations and the spinning hero seal when the media query matches.

================================================================
VISUAL RICHNESS — what separates "agency-built" from "AI-built"
================================================================

- LAYERED visual depth: hero image card has shadow + a floating badge overlapping it + a decorative spinning seal poking out the corner. About images are TWO overlapping images, not one. Contact form card has a soft gradient blob in one corner.
- Soft, COLOR-TINTED shadows derived from the ink color, with two layers (large blur + small tight shadow). NOT plain black drop-shadows.
- Subtle radial-gradient backgrounds in hero corners and other accent zones.
- Body has a faint SVG noise/grain via body::before with mix-blend-mode: multiply and ~0.4 opacity.
- Buttons: pill-shape (border-radius 999px), translateY(-2px) lift on hover + shadow grow. Primary uses --bark/--ink background with --surface text. Accent button uses --accent background with --paper text and gets a glow shadow on hover.
- Eyebrow labels: small uppercase mono-font with 0.18em letter-spacing, in --accent, with a 24px hairline pseudo-element before (or before AND after for centered eyebrows) it.
- Italic accent words inside display headlines — one or two italicized words in --primary per major heading.
- Hand-drawn inline SVG icons (NOT Lucide/Heroicons).
- A spinning hero seal with rotating text around its edge. A floating badge card with star rating. A logo mark with a radial gradient glow and inset shadow making it look 3D.

================================================================
SEO / META / ACCESSIBILITY
================================================================

- <title>, meta description, meta keywords (industry-relevant), meta author.
- Open Graph tags (og:title, og:description, og:type=website, og:image using one of the photos from the pool).
- Twitter card tags.
- JSON-LD structured data of type "LocalBusiness" with name, address, telephone, openingHours (when known), priceRange "$$".
- Semantic HTML5: <header>, <nav>, <main>, <section>, <article>, <footer>; proper heading hierarchy; <html lang="en">.
- ARIA: aria-label on icon-only buttons, aria-expanded on FAQ buttons, role="tablist" on filter tabs, aria-selected on tabs.
- All <img> tags have descriptive alt text (NOT "image" or empty alt).

================================================================
CONTENT RULES
================================================================

- Specific, professional, benefit-driven copy for THIS business — never generic placeholder text.
- Avoid clichés: "leading provider", "your trusted partner", "we go above and beyond", "Get Started Today", "Excellence in [X]".
- HARD RULE on numbers: only use numbers grounded in the real-data block below (review count, average rating, hours), or facts that are plainly self-evident from those. Do NOT fabricate "30 years experience", "500+ clients served", "98% satisfaction", certifications, awards, or team-size figures.
- Testimonials: paraphrase from real reviews in the data block. Attribute as "First-name L." (first name + last initial only). Without review data, OMIT the testimonials section.
- All contact surfaces use \`tel:\` / \`mailto:\`. If an address is provided, link to Google Maps and embed the map. If no address, omit the location/map area.

================================================================
HARD ANTI-PATTERNS
================================================================

- Numbered section headers ("01", "02", "I.", "SECTION / 01"). None.
- Generic "Why Choose Us" / 4-step "Our Process" blocks.
- Pure white background, pure black text.
- Default Tailwind \`indigo\` / \`sky\` / \`emerald\` as the brand color.
- Lucide / Heroicons class names — Tailwind CDN doesn't ship them. Use inline SVG.
- Lorem ipsum, "leading provider of", "Get Started Today".
- Fabricated stats, awards, decades-in-business.
- Fewer than 10 sections. The required structure has 12+.

================================================================

${imageryBlock}

${logoBlock}

${footerBranding}

${OUTPUT_FORMAT}`;

  const businessBlock = [
    `Business Name: ${cleanName}`,
    `Service / Industry: ${cleanService || "(not specified — infer from the business name and reviews if available)"}`,
    `Phone: ${cleanPhone || "(not provided)"}`,
    `Email: ${cleanEmail || "(not provided)"}`,
    `Address: ${cleanAddress || "(not provided)"}`,
    `Primary contact: ${cleanContact || "(not provided)"}`,
  ].join("\n");

  const addressDirective = cleanAddress
    ? `Use the address for a Google Maps embed: src="https://www.google.com/maps?q=${encodeURIComponent(cleanAddress)}&output=embed". Provide a "Get Directions" button linking to https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanAddress)}.`
    : "No address was provided — omit the location/map section entirely rather than faking one.";

  const userPromptBlock = userPrompt
    ? `\nUSER'S CUSTOM DESIGN BRIEF (the user wrote this — give it priority over your defaults; it tells you what they actually want):\n"""\n${userPrompt}\n"""\n`
    : "";

  const userMessage = `Build the landing page for the business below. Make every section specific to them — no template-feel filler.

BUSINESS:
${businessBlock}

${realDataBlock || "(no Google Maps data was available — design from the business name + service alone, and don't fabricate review-based testimonials.)"}

${addressDirective}
${userPromptBlock}
Return the full HTML document only.`;

  try {
    const maxTokens = aiResult.config.provider === "anthropic" ? 28000 : 18000;
    const t0 = Date.now();
    const { text: rawHtml, stopReason } = await aiChatDetailed(
      aiResult.config,
      systemPrompt,
      userMessage,
      maxTokens,
      "premium",
    );
    console.log(
      `[websites/generate] aiChat finished in ${Math.round((Date.now() - t0) / 1000)}s; html ${rawHtml.length} chars; stop_reason=${stopReason}`,
    );

    const fenceMatch = rawHtml.match(/```(?:html)?\s*([\s\S]*?)\s*```/i);
    let html = fenceMatch ? fenceMatch[1].trim() : rawHtml.trim();

    const doctypeIdx = html.search(/<!DOCTYPE\s+html/i);
    if (doctypeIdx > 0) html = html.slice(doctypeIdx);
    else {
      const htmlIdx = html.indexOf("<html");
      if (htmlIdx > 0) html = html.slice(htmlIdx);
    }

    if (!/<!DOCTYPE\s+html/i.test(html) && !html.includes("<html")) {
      return NextResponse.json({ error: "AI did not return valid HTML" }, { status: 500 });
    }

    // Soft-recovery for soft-truncation: if Claude hit max_tokens but the page
    // is mostly complete (has <body> open and substantial content), close the
    // tags ourselves rather than failing the whole generation. The page may
    // be missing the last section or two, but a usable site beats a hard
    // failure with no output.
    if (!/<\/html>\s*$/i.test(html)) {
      const hasBody = /<body[\s>]/i.test(html);
      const lengthOk = html.length > 6000;
      if (hasBody && lengthOk) {
        // Trim any partial unclosed tag at the end (e.g. "<div class=\"foo")
        const lastClose = html.lastIndexOf(">");
        if (lastClose > 0 && lastClose < html.length - 1) {
          html = html.slice(0, lastClose + 1);
        }
        if (!/<\/body>/i.test(html)) html += "\n</body>";
        if (!/<\/html>/i.test(html)) html += "\n</html>";
        console.warn(
          `[websites/generate] soft-recovered truncated output (stop_reason=${stopReason}, ${html.length} chars)`,
        );
      } else {
        return NextResponse.json(
          { error: "Website generation was truncated. Please try again." },
          { status: 500 },
        );
      }
    }

    // Safety net: kill any "hide-until-scroll" intersection-observer CSS that
    // can leave content invisible if the JS doesn't fire (broken JS, slow
    // mobile, prefers-reduced-motion, etc). Two layers:
    //   1) CSS that forces visibility on every common reveal-class name
    //      (Claude picks names like `.reveal`, `.fade-in`, `.slide-up` etc.)
    //   2) A 1.5s JS fallback that adds an `.is-visible`/`.in`/`.visible`
    //      class to every reveal node, in case the IntersectionObserver
    //      code Claude wrote never wires up correctly.
    html = html.replace(
      /<\/head>/i,
      `<style id="nn-visibility-guard">
  [data-reveal],[data-animate],[data-aos],.reveal,.reveal-up,.reveal-in,.reveal-on-scroll,.scroll-reveal,.animate-on-scroll,.fade-in,.fade-up,.fade-in-up,.slide-in,.slide-up,.slide-in-up,.appear,.aos-init,.aos-animate,.js-reveal{opacity:1!important;transform:none!important;visibility:visible!important;}
</style></head>`,
    );
    html = html.replace(
      /<\/body>/i,
      `<script id="nn-visibility-fallback">(function(){setTimeout(function(){var sel="[data-reveal],[data-animate],[data-aos],.reveal,.reveal-up,.reveal-in,.reveal-on-scroll,.scroll-reveal,.animate-on-scroll,.fade-in,.fade-up,.fade-in-up,.slide-in,.slide-up,.slide-in-up,.appear,.js-reveal";document.querySelectorAll(sel).forEach(function(el){el.classList.add("is-visible","in","visible","aos-animate","active");el.style.opacity="1";el.style.transform="none";el.style.visibility="visible";});},1500);})();</script></body>`,
    );

    if (logoUrl) {
      html = html.split("__NN_LOGO_URL__").join(logoUrl);
    }

    // Repair the contact form if the model emitted an empty or near-empty
    // <form data-nn-form> shell. Then wire the submit handler.
    html = ensureContactForm(html);
    html = ensureFormHandler(html, siteId);

    // Add an onerror fallback to every <img> so a 404'd photo URL doesn't
    // leave a blank section (the about-collage failure mode).
    html = ensureImageFallbacks(html, fallbackSeed);

    if (tier === "whitelabel") {
      html = stripPoweredByBadge(html);
    }

    const slug = tier === "whitelabel" ? await reserveUniqueSlug(session.userId, cleanName) : null;

    const { error: dbErr } = await supabaseAdmin.from("generated_websites").insert({
      id: siteId,
      user_id: session.userId,
      prospect_id: prospectId || null,
      prospect_name: cleanName,
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
      metadata: { prospectId, prospectName: cleanName, tier, enriched: Boolean(realDataBlock) },
    });

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
      enriched: Boolean(realDataBlock),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
