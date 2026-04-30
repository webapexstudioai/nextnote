// Locked design systems that the AI generator MUST follow verbatim. Each
// system embeds the full <style> block from a hand-built reference design,
// plus the structural rules that pin every section into the right shape.
//
// Two systems today:
//   System A — Brutalist / Industrial (trades, construction, automotive, fitness)
//   System B — Editorial / Coastal-Premium (everything else: residential service,
//              healthcare, beauty, hospitality, professional, lifestyle)
//
// The reference HTML for each lives at /public/samples/{construction,powerwash}.html.

export type DesignSystemId = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";

export type DesignSystemPalette = {
  label: string;
  mood: string;
  accent: string;
  primary: string;
};

export type DesignSystemImages = {
  hero: string;
  services: Array<{ name: string; url: string; keyword: string }>;
  portfolio: string[];
  fallback: string;
};

export type DesignSystemBusiness = {
  name: string;
  service: string;
  phone: string;
  email: string;
  address: string;
  contactName: string;
  city?: string;
};

// Each niche label maps to a list of design system IDs it can render in.
// The seed (from hashSeed of the business name) picks one — same name → same
// system. Unlisted labels default to System B (editorial).
const NICHE_LAYOUTS: Record<string, DesignSystemId[]> = {
  "Roofing / Exterior": ["A", "C"],
  "Home Services / Trades": ["A", "E", "F"],
  Automotive: ["A"],
  "Fitness / Coaching": ["A", "D"],
  "Landscaping / Outdoor": ["B", "G"],
  "Real Estate": ["B", "H"],
};

export function pickDesignSystem(label: string, seed = 0): DesignSystemId {
  const layouts = NICHE_LAYOUTS[label];
  if (layouts && layouts.length) return layouts[seed % layouts.length];
  return "B";
}

// FNV-1a 32-bit hash. Same business name → same seed → same variant on every
// regeneration. Different name in the same niche → different variant.
export function hashSeed(name: string): number {
  let h = 2166136261;
  const s = name.trim().toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Multiply each RGB channel by (1 - amount). amount=0 returns input, amount=1
// returns black. Used to derive a "deep" variant of the accent for hover/active.
function darken(hex: string, amount: number): string {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m || m.length !== 3) return hex;
  const [r, g, b] = m.map((c) => Math.max(0, Math.min(255, Math.round(parseInt(c, 16) * (1 - amount)))));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// =====================================================================
// SYSTEM A — Brutalist / Industrial
// Reference: /public/samples/construction.html (Ironforge Construction Co.)
// =====================================================================

function systemACss(palette: DesignSystemPalette): string {
  // Niche-specific overrides for the two highest-impact tokens. Everything
  // else stays brutalist / industrial.
  const accent = palette.accent;
  const dark = palette.primary;
  const accentDeep = darken(accent, 0.15);
  return `:root {
  --concrete: #ebe8e2;
  --concrete-dark: #d2cec5;
  --steel: #2d2d2d;
  --asphalt: ${dark};
  --rebar: #4a4a4a;
  --safety: ${accent};
  --safety-deep: ${accentDeep};
  --rust: #c84a1c;
  --line: rgba(20,20,20,0.10);
  --line-light: rgba(235,232,226,0.14);
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { font-family: 'Barlow Condensed', sans-serif; background: var(--concrete); color: var(--asphalt); overflow-x: hidden; font-weight: 500; -webkit-font-smoothing: antialiased; }
body::before { content: ''; position: fixed; inset: 0; background-image: linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px); background-size: 44px 44px; pointer-events: none; z-index: 0; }
body::after { content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 1; opacity: 0.05; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); mix-blend-mode: multiply; }
main, nav, footer, section { position: relative; z-index: 2; }
h1, h2, h3, h4 { font-family: 'Archivo Black', sans-serif; }
.top-bar { background: var(--asphalt); color: var(--concrete); padding: 0.55rem 2rem; font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.18em; display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 101; }
.top-bar .pulse { display: inline-block; width: 8px; height: 8px; background: var(--rust); border-radius: 50%; margin-right: 0.6rem; animation: blink 2s ease-in-out infinite; box-shadow: 0 0 8px var(--rust); }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
.top-bar-right { display: flex; gap: 2rem; }
.top-bar a { color: var(--concrete); text-decoration: none; transition: color .2s; }
.top-bar a:hover { color: var(--safety); }
nav { background: var(--concrete); border-bottom: 3px solid var(--asphalt); padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; }
.nav-logo { display: flex; align-items: center; gap: 0.85rem; text-decoration: none; color: var(--asphalt); }
.nav-logo svg { width: 50px; height: 50px; }
.nav-logo .lockup { display: flex; flex-direction: column; line-height: 0.95; }
.nav-logo .lockup .name { font-family: 'Archivo Black', sans-serif; font-size: 1.05rem; letter-spacing: 0.02em; }
.nav-logo .lockup .tag { font-family: 'JetBrains Mono', monospace; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--rebar); margin-top: 3px; }
.nav-links { display: flex; gap: 2.5rem; list-style: none; font-weight: 700; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.1em; counter-reset: nav; }
.nav-links li { counter-increment: nav; }
.nav-links a { color: var(--asphalt); text-decoration: none; position: relative; padding: 0.3rem 0; }
.nav-links a::before { content: counter(nav, decimal-leading-zero) ' / '; font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; color: var(--rebar); margin-right: 0.4rem; font-weight: 400; }
.nav-links a:hover { color: var(--rust); }
.nav-cta { background: var(--safety); color: var(--asphalt); padding: 0.9rem 1.6rem; font-family: 'Archivo Black', sans-serif; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; text-decoration: none; border: 3px solid var(--asphalt); box-shadow: 4px 4px 0 var(--asphalt); transition: all 0.15s ease; }
.nav-cta:hover { transform: translate(2px, 2px); box-shadow: 2px 2px 0 var(--asphalt); }
.hero { padding: 5rem 2rem 4rem; border-bottom: 3px solid var(--asphalt); overflow: hidden; }
.hero-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 3rem; max-width: 1500px; margin: 0 auto; align-items: end; }
.hero-meta { font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.2em; color: var(--rebar); display: grid; grid-template-columns: repeat(3, auto); gap: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--asphalt); margin-bottom: 2.5rem; opacity: 0; animation: slideIn 0.8s ease 0.1s forwards; }
.hero-meta strong { color: var(--asphalt); display: block; font-size: 0.95rem; margin-top: 4px; }
.hero h1 { font-size: clamp(3.5rem, 9vw, 8.5rem); line-height: 0.85; letter-spacing: -0.025em; text-transform: uppercase; margin-bottom: 2rem; opacity: 0; animation: slideIn 1s ease 0.3s forwards; }
.hero h1 .stripe { background: var(--safety); padding: 0 0.2em; display: inline-block; position: relative; }
.hero h1 .stripe::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(-45deg, transparent 0, transparent 14px, rgba(20,20,20,0.18) 14px, rgba(20,20,20,0.18) 18px); pointer-events: none; }
.hero h1 .outline { -webkit-text-stroke: 2px var(--asphalt); color: transparent; }
.hero h1 .rust { color: var(--rust); }
.hero-sub { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: end; opacity: 0; animation: slideIn 1s ease 0.5s forwards; }
.hero-sub p { font-size: 1.15rem; color: var(--rebar); max-width: 460px; line-height: 1.4; }
.hero-actions { display: flex; gap: 1rem; flex-wrap: wrap; }
.btn { font-family: 'Archivo Black', sans-serif; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 1.1rem 1.8rem; text-decoration: none; border: 3px solid var(--asphalt); display: inline-flex; align-items: center; gap: 0.7rem; transition: all 0.15s ease; box-shadow: 5px 5px 0 var(--asphalt); cursor: pointer; }
.btn:hover { transform: translate(3px, 3px); box-shadow: 2px 2px 0 var(--asphalt); }
.btn-yellow { background: var(--safety); color: var(--asphalt); }
.btn-dark { background: var(--asphalt); color: var(--concrete); }
.btn-arrow { transition: transform 0.2s ease; }
.btn:hover .btn-arrow { transform: translateX(4px); }
@keyframes slideIn { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
.hero-photo { border: 3px solid var(--asphalt); position: relative; aspect-ratio: 4/5; overflow: hidden; opacity: 0; animation: slideIn 1.2s ease 0.6s forwards; background: linear-gradient(135deg, #3a3530 0%, #1a1814 100%); }
.hero-photo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: contrast(1.05) saturate(0.85) brightness(0.92); }
.hero-photo::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(20,20,20,0) 50%, rgba(20,20,20,0.55) 100%), linear-gradient(rgba(255,194,14,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,194,14,0.06) 1px, transparent 1px); background-size: auto, 30px 30px, 30px 30px; pointer-events: none; }
.photo-stamp { position: absolute; top: 1rem; right: 1rem; background: var(--safety); border: 2px solid var(--asphalt); color: var(--asphalt); padding: 0.4rem 0.8rem; font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700; transform: rotate(3deg); z-index: 2; }
.photo-tag { position: absolute; bottom: 1.2rem; left: 1.2rem; color: var(--concrete); font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; letter-spacing: 0.15em; text-transform: uppercase; z-index: 2; }
.photo-tag .num { color: var(--safety); display: block; font-size: 1.8rem; font-family: 'Archivo Black', sans-serif; line-height: 1; margin-top: 4px; letter-spacing: -0.02em; }
.hazard-stripes { height: 28px; background: repeating-linear-gradient(-45deg, var(--safety) 0, var(--safety) 22px, var(--asphalt) 22px, var(--asphalt) 44px); }
.stats-bar { background: var(--asphalt); color: var(--concrete); padding: 3rem 2rem; }
.stats-grid { max-width: 1500px; margin: 0 auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: 2rem; }
.stat-card { border-left: 3px solid var(--safety); padding-left: 1.5rem; }
.stat-num { font-family: 'Archivo Black', sans-serif; font-size: 4.5rem; line-height: 0.9; letter-spacing: -0.03em; }
.stat-num .small { font-size: 2rem; color: var(--safety); }
.stat-label { font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.18em; color: var(--concrete-dark); margin-top: 0.6rem; }
.services { padding: 6rem 2rem; max-width: 1500px; margin: 0 auto; }
.section-head { display: grid; grid-template-columns: auto 1fr; gap: 2rem; align-items: end; margin-bottom: 4rem; padding-bottom: 2rem; border-bottom: 3px solid var(--asphalt); }
.section-tag { font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.2em; color: var(--rebar); display: flex; align-items: center; gap: 0.6rem; }
.section-tag::before { content: '◆'; color: var(--rust); font-size: 0.9rem; }
.section-head h2 { font-size: clamp(2.5rem, 6vw, 5.5rem); line-height: 0.9; letter-spacing: -0.025em; text-transform: uppercase; }
.section-head h2 .accent { color: var(--rust); }
.services-grid { display: grid; grid-template-columns: repeat(3, 1fr); border: 3px solid var(--asphalt); background: var(--asphalt); }
.service { background: var(--concrete); padding: 2.5rem 2rem; border-right: 3px solid var(--asphalt); border-bottom: 3px solid var(--asphalt); position: relative; transition: all 0.3s ease; cursor: pointer; overflow: hidden; }
.service:nth-child(3n) { border-right: none; }
.service:nth-last-child(-n+3) { border-bottom: none; }
.service::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 4px; background: var(--rust); transform: scaleX(0); transform-origin: left; transition: transform 0.4s ease; }
.service:hover { background: var(--asphalt); color: var(--concrete); }
.service:hover::before { transform: scaleX(1); }
.service:hover .service-num { color: var(--safety); }
.service:hover .service-arrow { background: var(--safety); color: var(--asphalt); transform: rotate(-45deg); }
.service-num { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; letter-spacing: 0.15em; color: var(--rebar); margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; }
.service-arrow { width: 32px; height: 32px; border: 2px solid currentColor; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; }
.service h3 { font-size: 1.8rem; line-height: 1; text-transform: uppercase; margin-bottom: 1rem; }
.service p { font-size: 1rem; color: var(--rebar); line-height: 1.5; margin-bottom: 1.5rem; }
.service:hover p { color: var(--concrete-dark); }
.service-list { list-style: none; font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.12em; }
.service-list li { padding: 0.4rem 0; border-top: 1px dashed currentColor; opacity: 0.7; }
.projects { background: var(--asphalt); color: var(--concrete); padding: 6rem 2rem; }
.projects-inner { max-width: 1500px; margin: 0 auto; }
.projects .section-head { border-bottom-color: var(--safety); }
.projects .section-tag { color: var(--concrete-dark); }
.projects .section-head h2 .accent { color: var(--safety); }
.projects-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 1.5rem; height: 700px; }
.project { border: 2px solid var(--rebar); background: var(--steel); position: relative; overflow: hidden; cursor: pointer; transition: all 0.4s ease; }
.project:hover { border-color: var(--safety); }
.project img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s ease; filter: contrast(1.05) saturate(0.85); }
.project:hover img { transform: scale(1.05); }
.project::before { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(20,20,20,0.1) 30%, rgba(20,20,20,0.85) 100%); z-index: 1; }
.project::after { content: ''; position: absolute; inset: 0; background: linear-gradient(rgba(255,194,14,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,194,14,0.04) 1px, transparent 1px); background-size: 30px 30px; z-index: 1; pointer-events: none; }
.project:nth-child(1) { grid-row: span 2; }
.project-content { position: absolute; inset: 0; padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between; z-index: 2; }
.project-tag { align-self: flex-start; background: var(--safety); color: var(--asphalt); padding: 0.3rem 0.7rem; font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700; }
.project h3 { font-size: 1.6rem; line-height: 1; text-transform: uppercase; color: var(--concrete); }
.project:nth-child(1) h3 { font-size: 2.4rem; }
.project-meta { font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; color: var(--concrete-dark); margin-top: 0.6rem; display: flex; gap: 1rem; }
.process-section { padding: 6rem 2rem; max-width: 1500px; margin: 0 auto; }
.process-grid { display: grid; grid-template-columns: repeat(4, 1fr); border: 3px solid var(--asphalt); }
.process-step { padding: 2.5rem 2rem; border-right: 3px solid var(--asphalt); background: var(--concrete); position: relative; }
.process-step:last-child { border-right: none; }
.process-step:nth-child(2) { background: var(--asphalt); color: var(--concrete); }
.process-num { font-family: 'Archivo Black', sans-serif; font-size: 5rem; line-height: 0.85; color: var(--safety); -webkit-text-stroke: 2px var(--asphalt); margin-bottom: 1.5rem; }
.process-step:nth-child(2) .process-num { -webkit-text-stroke: 2px var(--concrete); }
.process-step h4 { font-size: 1.3rem; text-transform: uppercase; margin-bottom: 0.8rem; }
.process-step p { font-size: 0.95rem; color: var(--rebar); line-height: 1.5; }
.process-step:nth-child(2) p { color: var(--concrete-dark); }
.process-duration { font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; letter-spacing: 0.18em; text-transform: uppercase; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid currentColor; opacity: 0.6; }
.testimonial { background: var(--rust); color: var(--concrete); padding: 5rem 2rem; border-top: 3px solid var(--asphalt); border-bottom: 3px solid var(--asphalt); position: relative; overflow: hidden; }
.testimonial::before { content: '"'; font-family: 'Archivo Black', sans-serif; position: absolute; font-size: 25rem; top: -4rem; left: 2rem; line-height: 1; color: rgba(20,20,20,0.15); }
.testimonial-inner { max-width: 1100px; margin: 0 auto; position: relative; z-index: 1; }
.testimonial blockquote { font-family: 'Archivo Black', sans-serif; font-size: clamp(1.8rem, 3.5vw, 3.2rem); line-height: 1; letter-spacing: -0.025em; text-transform: uppercase; margin-bottom: 2rem; }
.testimonial-author { display: flex; align-items: center; gap: 1.2rem; font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.15em; }
.testimonial-author::before { content: ''; width: 40px; height: 3px; background: var(--asphalt); }
.contact { background: var(--asphalt); color: var(--concrete); padding: 6rem 2rem; }
.contact-inner { max-width: 1500px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; }
.contact-left h2 { font-size: clamp(2.5rem, 5.5vw, 5rem); line-height: 0.88; letter-spacing: -0.025em; text-transform: uppercase; margin: 1.5rem 0 2rem; }
.contact-left h2 .accent { color: var(--safety); }
.contact-left .section-tag { color: var(--concrete-dark); }
.contact-left > p { font-size: 1.15rem; color: var(--concrete-dark); max-width: 500px; line-height: 1.5; margin-bottom: 3rem; }
.contact-cards { display: grid; gap: 1rem; }
.contact-card { border: 2px solid var(--rebar); padding: 1.5rem; text-decoration: none; color: var(--concrete); display: flex; align-items: center; gap: 1.5rem; transition: all 0.2s ease; }
.contact-card:hover { border-color: var(--safety); background: rgba(255,194,14,0.05); transform: translateX(6px); }
.contact-card-num { font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; letter-spacing: 0.18em; color: var(--rebar); border-right: 1px solid var(--rebar); padding-right: 1.5rem; }
.contact-card-label { font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--safety); margin-bottom: 0.4rem; }
.contact-card-value { font-family: 'Archivo Black', sans-serif; font-size: 1.4rem; letter-spacing: -0.01em; }
.quote-form { background: var(--concrete); color: var(--asphalt); padding: 2.5rem; border: 3px solid var(--safety); position: relative; }
.quote-form::before { content: 'FREE QUOTE'; position: absolute; top: -14px; left: 2rem; background: var(--safety); padding: 0.3rem 0.8rem; font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; letter-spacing: 0.18em; font-weight: 700; border: 2px solid var(--asphalt); }
.quote-form h3 { font-size: 2rem; text-transform: uppercase; margin: 0.8rem 0 0.6rem; }
.quote-form > p { font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; letter-spacing: 0.15em; color: var(--rebar); text-transform: uppercase; margin-bottom: 2rem; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--rebar); margin-bottom: 0.4rem; }
.form-group input, .form-group select, .form-group textarea { width: 100%; padding: 0.8rem 1rem; background: transparent; border: 2px solid var(--asphalt); font-family: 'Barlow Condensed', sans-serif; font-size: 1rem; color: var(--asphalt); font-weight: 500; transition: all 0.2s ease; }
.form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; background: var(--safety); box-shadow: 4px 4px 0 var(--asphalt); transform: translate(-2px, -2px); }
.form-submit { width: 100%; padding: 1.2rem; background: var(--asphalt); color: var(--concrete); border: 3px solid var(--asphalt); font-family: 'Archivo Black', sans-serif; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; margin-top: 1rem; box-shadow: 5px 5px 0 var(--rust); transition: all 0.15s ease; }
.form-submit:hover { transform: translate(3px, 3px); box-shadow: 2px 2px 0 var(--rust); }
footer { background: var(--asphalt); color: var(--concrete-dark); border-top: 1px solid var(--rebar); padding: 2.5rem 2rem; }
.footer-inner { max-width: 1500px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem; font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; letter-spacing: 0.15em; text-transform: uppercase; }
.footer-inner .accent { color: var(--safety); }
@media (max-width: 1024px) {
  .hero-grid, .contact-inner { grid-template-columns: 1fr; }
  .hero-photo { aspect-ratio: 16/10; }
  .stats-grid, .services-grid, .process-grid { grid-template-columns: repeat(2, 1fr); }
  .service:nth-child(3n) { border-right: 3px solid var(--asphalt); }
  .service:nth-child(2n) { border-right: none; }
  .service:nth-last-child(-n+3) { border-bottom: 3px solid var(--asphalt); }
  .service:nth-last-child(-n+2) { border-bottom: none; }
  .process-step:nth-child(2n) { border-right: none; }
  .process-step:nth-child(-n+2) { border-bottom: 3px solid var(--asphalt); }
  .projects-grid { grid-template-columns: 1fr 1fr; grid-template-rows: auto; height: auto; }
  .project:nth-child(1) { grid-row: auto; grid-column: span 2; aspect-ratio: 16/9; }
  .project { aspect-ratio: 4/3; }
}
@media (max-width: 640px) {
  .top-bar { flex-direction: column; gap: 0.4rem; padding: 0.6rem 1rem; }
  .top-bar-right { gap: 1rem; }
  nav { padding: 0.8rem 1rem; }
  .nav-links { display: none; }
  .hero, .services, .projects, .process-section, .testimonial, .contact { padding-left: 1rem; padding-right: 1rem; }
  .hero-meta { grid-template-columns: 1fr; gap: 0.8rem; }
  .hero-sub { grid-template-columns: 1fr; }
  .stats-grid, .services-grid, .process-grid { grid-template-columns: 1fr; }
  .service { border-right: none !important; border-bottom: 3px solid var(--asphalt) !important; }
  .service:last-child { border-bottom: none !important; }
  .process-step { border-right: none !important; border-bottom: 3px solid var(--asphalt); }
  .process-step:last-child { border-bottom: none; }
  .projects-grid { grid-template-columns: 1fr; }
  .project, .project:nth-child(1) { grid-column: auto; aspect-ratio: 4/3; }
  .form-row { grid-template-columns: 1fr; }
  .section-head { grid-template-columns: 1fr; gap: 1rem; }
  .stat-num { font-size: 3.2rem; }
}`;
}

function systemAFontsHead(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Barlow+Condensed:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />`;
}

function buildSystemABlock(
  palette: DesignSystemPalette,
  images: DesignSystemImages,
): string {
  const servicesList = images.services
    .map((s, i) => `    ${i + 1}) "${s.name}" (depicts: ${s.keyword}) → ${s.url}`)
    .join("\n");
  const portfolioList = images.portfolio.map((u, i) => `    ${i + 1}) ${u}`).join("\n");

  return `LOCKED DESIGN SYSTEM — SYSTEM A (BRUTALIST / INDUSTRIAL)

This niche (${palette.label}) uses System A. The design is FIXED. Do not invent your own layout, palette, or typography. Do not use Tailwind. The CSS below is complete — you only fill content.

REQUIRED <head> ELEMENTS:
1. <meta charset> + <meta viewport> + <title>
2. Google Fonts (use this block VERBATIM):
${systemAFontsHead()}
3. A single <style> block containing the FULL CSS BELOW VERBATIM. Do not edit, shorten, or "clean up" any of the CSS. Do not add Tailwind. Copy it exactly:

<style>
${systemACss(palette)}
</style>

REQUIRED PAGE STRUCTURE (build the <body> in this exact order, using these exact class names):

1. <svg width="0" height="0" style="position:absolute" aria-hidden="true">
   <defs>
     <symbol id="brand-mark" viewBox="0 0 100 100">
       <!-- A custom inline SVG that depicts the niche subject. Black square (#141414) base. Accent corner triangle in #c84a1c. The mark inside the square uses #ffc20e. The depicted subject MUST match the niche logo concept; do not use a monogram letter as a fallback. -->
     </symbol>
   </defs>
 </svg>

2. <div class="top-bar">
   - Left: <span class="pulse"></span> + uppercase license/credentials line ("LICENSED · BONDED · INSURED · [STATE LIC #]")
   - Right block (.top-bar-right): clickable phone (tel:), clickable email (mailto:), hours line ("MON–SAT · 7AM–6PM")

3. <nav>
   - Left: <a class="nav-logo"> with <svg><use href="#brand-mark"/></svg> + .lockup containing .name (BUSINESS NAME) and .tag ("EST. YYYY · CITY, ST")
   - Center: <ul class="nav-links"> with 4 <li><a> entries — Capabilities, Projects, Process, Contact (all # anchors)
   - Right: <a class="nav-cta" href="#contact">Get a Quote →</a>

4. <section class="hero"> with .hero-grid containing two children:
   - LEFT child:
     • .hero-meta — 3 cells: EST<strong>YYYY</strong>, PROJECTS<strong>NUM+</strong>, CREW<strong>SIZE</strong>
     • <h1> — exactly 3-4 lines using the modifier spans. Use this exact pattern:
        HEAVY<br><span class="stripe">WORD.</span><br><span class="outline">WORD</span> <span class="rust">WORD.</span>
     • .hero-sub — left <p> (1-2 lines describing the business niche-specifically), right .hero-actions with two buttons:
        <a class="btn btn-yellow" href="#contact">Free Estimate <span class="btn-arrow">→</span></a>
        <a class="btn btn-dark" href="#projects">See Projects</a>
   - RIGHT child:
     • <div class="hero-photo">
        <img src="${images.hero}" alt="${palette.label}" onerror="this.onerror=null;this.src='${images.fallback}'" />
        <div class="photo-stamp">PROJECT [NUM] — IN PROGRESS</div>
        <div class="photo-tag">[SHORT LABEL]<span class="num">[BIG NUMBER]</span></div>
       </div>

5. <div class="hazard-stripes"></div>

6. <section class="stats-bar"> with .stats-grid containing 4 .stat-card children, each:
   <div class="stat-num">[NUM]<span class="small">[UNIT]</span></div>
   <div class="stat-label">[CAPS LABEL]</div>
   Use credible specific numbers (years in business, projects done, on-time %, OSHA recordables, repeat client %).

7. <section class="services" id="services">
   - .section-head with .section-tag "SECTION / 01 — CAPABILITIES" and <h2>WHAT WE <span class="accent">[VERB].</span></h2>
   - .services-grid containing EXACTLY 6 .service blocks. For each service use the matched image and name from this list:
${servicesList}
     Each .service block:
     <div class="service">
       <div class="service-num"><span>NO. 0X</span><span class="service-arrow">↗</span></div>
       <img src="[SERVICE_URL]" alt="" style="width: 100%; aspect-ratio: 16/10; object-fit: cover; margin-bottom: 1.2rem; border: 2px solid var(--asphalt);" onerror="this.onerror=null;this.src='${images.fallback}'" />
       <h3>[SERVICE NAME]</h3>
       <p>[2-line specific description]</p>
       <ul class="service-list"><li>+ [bullet]</li><li>+ [bullet]</li><li>+ [bullet]</li></ul>
     </div>

8. <section class="projects" id="projects">
   - .projects-inner > .section-head: tag "SECTION / 02 — PORTFOLIO", <h2>RECENT <span class="accent">JOBS.</span></h2>
   - .projects-grid containing EXACTLY 5 .project children — first one spans 2 rows. Each .project:
     <div class="project">
       <img src="[PORTFOLIO_URL]" alt="" onerror="this.onerror=null;this.src='${images.fallback}'" />
       <div class="project-content">
         <div><span class="project-tag">[CATEGORY]</span></div>
         <div>
           <h3>[PROJECT NAME]</h3>
           <div class="project-meta"><span>[YEAR]</span><span>·</span><span>[SIZE/SCOPE]</span><span>·</span><span>[TYPE]</span></div>
         </div>
       </div>
     </div>
   - Use the 3 portfolio URLs below for first 3 projects, and reuse 2 of the service photos for projects 4 and 5:
${portfolioList}

9. <section class="process-section" id="process">
   - .section-head: "SECTION / 03 — METHOD", <h2>HOW WE <span class="accent">WORK.</span></h2>
   - .process-grid containing 4 .process-step children: 01/02/03/04. Each:
     <div class="process-step">
       <div class="process-num">0X</div>
       <h4>[Step name]</h4>
       <p>[2-line description specific to the niche]</p>
       <div class="process-duration">[Duration label like "Day 1 — Free", "Days 2-7", "Week 1+"]</div>
     </div>

10. <section class="testimonial">
    .testimonial-inner > <blockquote>"...quote..."</blockquote> + .testimonial-author "FIRST L. · CITY · YEAR"
    Make the quote SPECIFIC: cite a number, a timeline, a niche-specific outcome. Plain quote, no fake star widget.

11. <section class="contact" id="contact">
    .contact-inner with two children:
    - LEFT (.contact-left):
      .section-tag "SECTION / 04 — CONTACT"
      <h2>LET'S TALK<br><span class="accent">SCOPE.</span></h2>
      <p> describing response time
      .contact-cards: 3 .contact-card entries — phone (tel:), email (mailto:), service area (no link). Each with .contact-card-num "→ 0X", .contact-card-label, .contact-card-value.
    - RIGHT (.quote-form):
      <h3>Request a Quote</h3>
      <p>RESPONSE WITHIN 24 HRS</p>
      <form data-nn-form>
        Hidden honeypot first: <div class="sr-only" aria-hidden="true" style="position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);border:0;"><label>Website<input type="text" name="company_website" tabindex="-1" autocomplete="off" /></label></div>
        Then .form-row with two .form-group: name (required, type=text), phone (required, type=tel)
        Then .form-group full width: email (type=email, name=email)
        Then .form-row with two .form-group: type (select with 6 niche options), budget (select with 4 ranges)
        Then .form-group full width: message — <textarea name="message" rows="3" placeholder="Address, scope, timeline...">
        Then <button type="submit" class="form-submit">SUBMIT REQUEST →</button>
        Then <p data-nn-form-status class="text-sm text-center min-h-[20px]" style="margin-top:0.6rem;font-family:'JetBrains Mono',monospace;font-size:0.7rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--rebar);"></p>
      </form>

12. <footer> with .footer-inner — 3 columns: business name + license, phone+email, city + license number.

CONTENT RULES (System A):
- All button labels, headings, eyebrows are UPPERCASE.
- Headlines are blunt and physical: "BUILT RIGHT.", "HEAVY WORK.", "DONE RIGHT.", "WE BUILD." — not feature lists.
- Use specific, credible numbers everywhere. No "many" or "lots".
- Tone: blue-collar premium, dependable, tools-not-words. Not corporate, not chirpy.

DO NOT:
- Use Tailwind utility classes
- Add Lucide icons via CDN
- Add JS animations beyond the form handler
- Replace any of the locked CSS
- Use any image not listed above`;
}

// =====================================================================
// SYSTEM B — Editorial / Coastal-Premium
// Reference: /public/samples/powerwash.html (Tidewater Pro Wash)
// =====================================================================

function systemBCss(palette: DesignSystemPalette): string {
  const accent = palette.accent;
  const ink = palette.primary;
  return `:root {
  --paper: #f7f3ec;
  --paper-warm: #ede5d6;
  --ink: ${ink};
  --ink-soft: #2a4055;
  --ink-dim: #5a6e82;
  --mist: #e6eef5;
  --tide: ${accent};
  --tide-deep: #084752;
  --foam: #cfeae3;
  --sun: #efb24a;
  --coral: #e35a4f;
  --line: rgba(10,31,51,0.10);
  --line-strong: rgba(10,31,51,0.85);
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { font-family: 'Inter', sans-serif; background: var(--paper); color: var(--ink); -webkit-font-smoothing: antialiased; overflow-x: hidden; }
h1, h2, h3, h4 { font-family: 'Fraunces', serif; font-variation-settings: 'opsz' 144; font-weight: 700; letter-spacing: -0.02em; }
.mono { font-family: 'IBM Plex Mono', monospace; }
.top-bar { background: var(--ink); color: var(--paper); padding: 0.55rem 2rem; font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.16em; display: flex; justify-content: space-between; align-items: center; }
.top-bar .pill { display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.08); padding: 0.2rem 0.7rem; border-radius: 99px; }
.top-bar .pill .dot { width: 7px; height: 7px; background: #5deba0; border-radius: 50%; box-shadow: 0 0 8px #5deba0; animation: pulse 2s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
.top-bar-right { display: flex; gap: 1.8rem; }
.top-bar a { color: var(--paper); text-decoration: none; transition: color .2s; }
.top-bar a:hover { color: var(--sun); }
nav { background: var(--paper); padding: 1.25rem 2rem; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; border-bottom: 1px solid var(--line); backdrop-filter: blur(12px); }
.nav-logo { display: flex; align-items: center; gap: 0.85rem; text-decoration: none; color: var(--ink); }
.nav-logo svg { width: 44px; height: 44px; }
.nav-logo .lockup { display: flex; flex-direction: column; line-height: 1; }
.nav-logo .lockup .name { font-family: 'Fraunces', serif; font-weight: 900; font-size: 1.2rem; letter-spacing: -0.02em; }
.nav-logo .lockup .tag { font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-dim); margin-top: 4px; }
.nav-links { display: flex; gap: 2.5rem; list-style: none; font-weight: 500; font-size: 0.95rem; }
.nav-links a { color: var(--ink); text-decoration: none; position: relative; padding: 0.3rem 0; transition: color .2s; }
.nav-links a::after { content: ''; position: absolute; bottom: -2px; left: 0; width: 100%; height: 2px; background: var(--tide); transform: scaleX(0); transform-origin: left; transition: transform 0.3s ease; }
.nav-links a:hover { color: var(--tide); }
.nav-links a:hover::after { transform: scaleX(1); }
.nav-cta { background: var(--ink); color: var(--paper); padding: 0.85rem 1.5rem; font-weight: 600; font-size: 0.9rem; text-decoration: none; border-radius: 999px; display: inline-flex; align-items: center; gap: 0.5rem; transition: all 0.2s ease; }
.nav-cta:hover { background: var(--tide); transform: translateY(-2px); box-shadow: 0 8px 20px rgba(13,110,125,0.3); }
.hero { padding: 4rem 2rem 6rem; position: relative; overflow: hidden; }
.hero::before { content: ''; position: absolute; top: -400px; right: -300px; width: 800px; height: 800px; background: radial-gradient(circle, rgba(13,110,125,0.08) 0%, transparent 60%); pointer-events: none; }
.hero-grid { display: grid; grid-template-columns: 1.05fr 1fr; gap: 4rem; max-width: 1500px; margin: 0 auto; align-items: center; }
.hero-tag { display: inline-flex; align-items: center; gap: 0.6rem; background: var(--foam); color: var(--tide-deep); padding: 0.45rem 0.9rem; border-radius: 99px; font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: 1.8rem; opacity: 0; animation: rise 0.7s ease 0.1s forwards; }
.hero-tag .dot { width: 7px; height: 7px; background: var(--tide); border-radius: 50%; }
.hero h1 { font-size: clamp(3rem, 7.5vw, 6.8rem); line-height: 0.95; margin-bottom: 1.8rem; opacity: 0; animation: rise 0.9s ease 0.25s forwards; }
.hero h1 .ital { font-style: italic; color: var(--tide); }
.hero h1 .underline { position: relative; display: inline-block; }
.hero h1 .underline::after { content: ''; position: absolute; bottom: 0.05em; left: 0; width: 100%; height: 0.16em; background: var(--sun); z-index: -1; border-radius: 4px; }
.hero-lead { font-size: 1.2rem; line-height: 1.55; color: var(--ink-soft); max-width: 540px; margin-bottom: 2.5rem; opacity: 0; animation: rise 0.9s ease 0.4s forwards; }
.hero-actions { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 3rem; opacity: 0; animation: rise 0.9s ease 0.55s forwards; }
.btn { font-weight: 600; font-size: 0.95rem; padding: 1.1rem 1.7rem; text-decoration: none; border-radius: 999px; display: inline-flex; align-items: center; gap: 0.6rem; transition: all 0.25s ease; cursor: pointer; border: none; }
.btn-primary { background: var(--tide); color: var(--paper); box-shadow: 0 6px 18px rgba(13,110,125,0.32); }
.btn-primary:hover { background: var(--tide-deep); transform: translateY(-2px); box-shadow: 0 12px 28px rgba(13,110,125,0.42); }
.btn-ghost { background: transparent; color: var(--ink); border: 1.5px solid var(--ink); }
.btn-ghost:hover { background: var(--ink); color: var(--paper); }
.btn-arrow { transition: transform 0.25s ease; }
.btn:hover .btn-arrow { transform: translateX(5px); }
.hero-trust { display: flex; gap: 2.5rem; flex-wrap: wrap; align-items: center; padding-top: 2rem; border-top: 1px solid var(--line); opacity: 0; animation: rise 0.9s ease 0.7s forwards; }
.hero-trust-item { display: flex; flex-direction: column; gap: 0.2rem; }
.hero-trust-item .num { font-family: 'Fraunces', serif; font-weight: 900; font-size: 1.8rem; color: var(--ink); line-height: 1; }
.hero-trust-item .lbl { font-family: 'IBM Plex Mono', monospace; font-size: 0.65rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-dim); }
@keyframes rise { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
.hero-visual { position: relative; aspect-ratio: 4/5; border-radius: 28px; overflow: hidden; box-shadow: 0 30px 70px -25px rgba(10,31,51,0.4); opacity: 0; animation: rise 1.2s ease 0.5s forwards; }
.hero-visual img { width: 100%; height: 100%; object-fit: cover; display: block; }
.hero-visual::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(10,31,51,0.5) 100%); pointer-events: none; }
.hero-caption { position: absolute; bottom: 1.2rem; left: 1.2rem; right: 1.2rem; background: rgba(10,31,51,0.85); color: var(--paper); padding: 1rem 1.2rem; border-radius: 14px; backdrop-filter: blur(10px); display: flex; align-items: center; gap: 1rem; z-index: 3; }
.hero-caption .left { font-family: 'IBM Plex Mono', monospace; font-size: 0.65rem; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.55); border-right: 1px solid rgba(255,255,255,0.2); padding-right: 1rem; }
.hero-caption .mid { font-family: 'Fraunces', serif; font-weight: 700; font-size: 1rem; flex: 1; }
.hero-caption .right { font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; color: var(--sun); font-weight: 600; }
.marquee { background: var(--ink); color: var(--paper); overflow: hidden; padding: 1.4rem 0; }
.marquee-track { display: flex; gap: 3rem; animation: scroll 40s linear infinite; white-space: nowrap; font-family: 'Fraunces', serif; font-style: italic; font-weight: 500; font-size: 1.6rem; }
.marquee-track span { display: inline-flex; align-items: center; gap: 3rem; }
.marquee-track .dot { width: 8px; height: 8px; background: var(--sun); border-radius: 50%; flex-shrink: 0; }
@keyframes scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.services { padding: 7rem 2rem; max-width: 1500px; margin: 0 auto; }
.section-head { display: grid; grid-template-columns: 1fr auto; gap: 3rem; align-items: end; margin-bottom: 4rem; }
.section-eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--tide); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.6rem; }
.section-eyebrow::before { content: '◐'; color: var(--tide); }
.section-head h2 { font-size: clamp(2.5rem, 5.5vw, 4.5rem); line-height: 1; }
.section-head h2 .ital { font-style: italic; color: var(--tide); }
.head-link { font-family: 'IBM Plex Mono', monospace; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.15em; color: var(--ink); text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem; border-bottom: 1.5px solid var(--ink); padding-bottom: 4px; }
.head-link:hover { color: var(--tide); border-color: var(--tide); }
.services-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
.service { background: var(--paper); border-radius: 24px; border: 1px solid var(--line); overflow: hidden; transition: all 0.4s ease; position: relative; display: flex; flex-direction: column; }
.service:hover { transform: translateY(-6px); box-shadow: 0 20px 40px -15px rgba(10,31,51,0.18); border-color: rgba(13,110,125,0.3); }
.service-img { aspect-ratio: 5/3; position: relative; overflow: hidden; }
.service-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.service-img::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(10,31,51,0) 50%, rgba(10,31,51,0.5) 100%); }
.s-pill { position: absolute; top: 1rem; left: 1rem; background: rgba(247,243,236,0.92); color: var(--ink); padding: 0.35rem 0.75rem; border-radius: 99px; font-family: 'IBM Plex Mono', monospace; font-size: 0.65rem; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 600; z-index: 2; backdrop-filter: blur(8px); }
.service-body { padding: 1.8rem 1.6rem 1.6rem; flex: 1; display: flex; flex-direction: column; }
.service h3 { font-size: 1.6rem; line-height: 1.05; margin-bottom: 0.7rem; }
.service p { font-size: 0.95rem; color: var(--ink-soft); line-height: 1.55; margin-bottom: 1.4rem; flex: 1; }
.service-meta { display: flex; justify-content: space-between; align-items: center; padding-top: 1rem; border-top: 1px solid var(--line); }
.service-price { font-family: 'Fraunces', serif; font-weight: 700; font-size: 1rem; color: var(--ink); }
.service-price .lbl { font-family: 'IBM Plex Mono', monospace; font-size: 0.62rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-dim); margin-right: 0.4rem; font-weight: 500; }
.service-arrow { width: 38px; height: 38px; border-radius: 50%; background: var(--paper-warm); color: var(--ink); display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; font-size: 1rem; }
.service:hover .service-arrow { background: var(--tide); color: var(--paper); transform: rotate(-45deg); }
.transformation { background: var(--ink); color: var(--paper); padding: 7rem 2rem; position: relative; overflow: hidden; }
.transformation::before { content: ''; position: absolute; top: -200px; left: -200px; width: 600px; height: 600px; background: radial-gradient(circle, rgba(13,110,125,0.25) 0%, transparent 60%); pointer-events: none; }
.transformation-inner { max-width: 1500px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1.2fr; gap: 5rem; align-items: center; position: relative; z-index: 1; }
.transformation .section-eyebrow { color: var(--sun); }
.transformation .section-eyebrow::before { color: var(--sun); }
.transformation h2 { font-size: clamp(2.5rem, 5vw, 4.2rem); line-height: 1; margin-bottom: 2rem; }
.transformation h2 .ital { font-style: italic; color: var(--sun); }
.transformation .lead { font-size: 1.1rem; color: rgba(247,243,236,0.75); line-height: 1.6; margin-bottom: 2.5rem; max-width: 480px; }
.case-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; padding: 2rem 0; border-top: 1px solid rgba(247,243,236,0.15); border-bottom: 1px solid rgba(247,243,236,0.15); margin-bottom: 2rem; }
.case-stat .num { font-family: 'Fraunces', serif; font-weight: 900; font-size: 2.5rem; line-height: 1; background: linear-gradient(135deg, var(--paper) 0%, var(--sun) 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 0.4rem; }
.case-stat .lbl { font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(247,243,236,0.6); }
.case-quote { font-family: 'Fraunces', serif; font-style: italic; font-size: 1.15rem; line-height: 1.4; color: var(--paper); border-left: 3px solid var(--sun); padding-left: 1.2rem; }
.case-quote .author { font-style: normal; font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(247,243,236,0.55); margin-top: 0.8rem; display: block; }
.transformation-visual { position: relative; aspect-ratio: 6/5; border-radius: 24px; overflow: hidden; box-shadow: 0 30px 80px -20px rgba(0,0,0,0.5); }
.transformation-visual img { width: 100%; height: 100%; object-fit: cover; display: block; filter: contrast(1.05) saturate(1.05); }
.process { padding: 7rem 2rem; max-width: 1500px; margin: 0 auto; }
.process-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; position: relative; }
.process-grid::before { content: ''; position: absolute; top: 47px; left: 8%; right: 8%; height: 1px; background: repeating-linear-gradient(90deg, var(--line-strong) 0, var(--line-strong) 6px, transparent 6px, transparent 14px); z-index: 0; }
.process-step { text-align: center; position: relative; z-index: 1; }
.process-num { width: 92px; height: 92px; margin: 0 auto 1.8rem; border-radius: 50%; background: var(--paper); border: 2px solid var(--ink); display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-weight: 900; font-size: 2.4rem; color: var(--ink); position: relative; transition: all 0.3s ease; }
.process-step:hover .process-num { background: var(--tide); color: var(--paper); border-color: var(--tide); transform: scale(1.05); }
.process-step h4 { font-size: 1.4rem; line-height: 1.05; margin-bottom: 0.7rem; }
.process-step p { font-size: 0.95rem; color: var(--ink-soft); line-height: 1.55; max-width: 240px; margin: 0 auto; }
.process-step .duration { font-family: 'IBM Plex Mono', monospace; font-size: 0.65rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--tide); margin-top: 1rem; display: inline-block; }
.testimonials { background: var(--paper-warm); padding: 7rem 2rem; }
.testimonials-inner { max-width: 1500px; margin: 0 auto; }
.testimonial-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-top: 3rem; }
.t-card { background: var(--paper); border-radius: 24px; padding: 2rem; border: 1px solid var(--line); display: flex; flex-direction: column; }
.t-card .stars { color: var(--sun); font-size: 1rem; letter-spacing: 0.05em; margin-bottom: 1.2rem; }
.t-card .quote { font-family: 'Fraunces', serif; font-weight: 500; font-size: 1.15rem; line-height: 1.4; color: var(--ink); margin-bottom: 2rem; flex: 1; }
.t-card .author { display: flex; align-items: center; gap: 0.9rem; padding-top: 1.4rem; border-top: 1px solid var(--line); }
.t-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--tide); color: var(--paper); display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-weight: 700; font-size: 1.1rem; flex-shrink: 0; }
.t-name { font-weight: 600; font-size: 0.95rem; line-height: 1.1; }
.t-meta { font-family: 'IBM Plex Mono', monospace; font-size: 0.65rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-dim); margin-top: 4px; }
.cta-section { padding: 7rem 2rem; max-width: 1500px; margin: 0 auto; }
.cta-card { background: var(--ink); color: var(--paper); border-radius: 32px; overflow: hidden; display: grid; grid-template-columns: 1.1fr 1fr; position: relative; }
.cta-card::before { content: ''; position: absolute; top: -200px; right: -200px; width: 500px; height: 500px; background: radial-gradient(circle, rgba(239,178,74,0.18) 0%, transparent 60%); pointer-events: none; }
.cta-left { padding: 4rem 3.5rem; position: relative; z-index: 1; }
.cta-left .section-eyebrow { color: var(--sun); }
.cta-left .section-eyebrow::before { color: var(--sun); }
.cta-left h2 { font-size: clamp(2rem, 4.5vw, 3.6rem); line-height: 1; margin-bottom: 1.5rem; }
.cta-left h2 .ital { font-style: italic; color: var(--sun); }
.cta-left .lead { font-size: 1.05rem; color: rgba(247,243,236,0.7); line-height: 1.55; margin-bottom: 2.5rem; max-width: 440px; }
.cta-contacts { display: grid; gap: 0.9rem; }
.cta-row { display: flex; align-items: center; gap: 1.2rem; text-decoration: none; color: var(--paper); padding: 1.1rem 1.3rem; border-radius: 16px; background: rgba(247,243,236,0.05); border: 1px solid rgba(247,243,236,0.1); transition: all 0.25s ease; }
.cta-row:hover { background: rgba(239,178,74,0.1); border-color: var(--sun); transform: translateX(4px); }
.icon-circle { width: 44px; height: 44px; border-radius: 50%; background: rgba(239,178,74,0.15); color: var(--sun); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.cta-row .lbl { font-family: 'IBM Plex Mono', monospace; font-size: 0.65rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(247,243,236,0.55); display: block; margin-bottom: 4px; }
.cta-row .val { font-weight: 600; font-size: 1.05rem; }
.quote-form { background: var(--paper); color: var(--ink); padding: 3.5rem 3rem; position: relative; }
.quote-form h3 { font-size: 1.8rem; line-height: 1; margin-bottom: 0.5rem; }
.form-eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--tide); margin-bottom: 2rem; display: block; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
.form-group { margin-bottom: 0.9rem; }
.form-group label { display: block; font-family: 'IBM Plex Mono', monospace; font-size: 0.65rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-dim); margin-bottom: 0.4rem; }
.form-group input, .form-group select, .form-group textarea { width: 100%; padding: 0.85rem 1rem; background: var(--paper-warm); border: 1.5px solid transparent; border-radius: 12px; font-family: 'Inter', sans-serif; font-size: 0.95rem; color: var(--ink); transition: all 0.2s ease; }
.form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; background: var(--paper); border-color: var(--tide); box-shadow: 0 0 0 4px rgba(13,110,125,0.12); }
.form-submit { width: 100%; padding: 1.1rem; background: var(--tide); color: var(--paper); border: none; border-radius: 999px; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 1rem; cursor: pointer; margin-top: 0.6rem; transition: all 0.25s ease; box-shadow: 0 6px 18px rgba(13,110,125,0.32); }
.form-submit:hover { background: var(--tide-deep); transform: translateY(-2px); box-shadow: 0 12px 28px rgba(13,110,125,0.42); }
footer { background: var(--paper); border-top: 1px solid var(--line); padding: 3rem 2rem 2rem; }
.footer-inner { max-width: 1500px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem; font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-dim); }
.footer-inner .accent { color: var(--tide); }
@media (max-width: 1024px) {
  .hero-grid, .transformation-inner, .cta-card { grid-template-columns: 1fr; gap: 3rem; }
  .hero-visual, .transformation-visual { aspect-ratio: 4/3; }
  .services-grid, .testimonial-grid { grid-template-columns: repeat(2, 1fr); }
  .process-grid { grid-template-columns: repeat(2, 1fr); gap: 3rem; }
  .process-grid::before { display: none; }
  .case-stats { grid-template-columns: 1fr; gap: 1rem; }
  .quote-form { padding: 2.5rem 2rem; }
  .cta-left { padding: 2.5rem 2rem; }
}
@media (max-width: 640px) {
  .top-bar { flex-direction: column; gap: 0.4rem; padding: 0.6rem 1rem; }
  .top-bar-right { gap: 1rem; }
  nav { padding: 0.9rem 1rem; }
  .nav-links { display: none; }
  .hero, .services, .transformation, .process, .testimonials, .cta-section { padding-left: 1rem; padding-right: 1rem; }
  .services-grid, .testimonial-grid, .process-grid { grid-template-columns: 1fr; }
  .form-row { grid-template-columns: 1fr; }
  .section-head { grid-template-columns: 1fr; gap: 1rem; }
  .hero-trust { gap: 1.5rem; }
  .hero-caption { flex-direction: column; gap: 0.4rem; align-items: flex-start; padding: 0.8rem 1rem; }
  .hero-caption .left { border: none; padding: 0; }
}`;
}

function systemBFontsHead(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,900&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />`;
}

function buildSystemBBlock(
  palette: DesignSystemPalette,
  images: DesignSystemImages,
): string {
  const servicesList = images.services
    .map((s, i) => `    ${i + 1}) "${s.name}" (depicts: ${s.keyword}) → ${s.url}`)
    .join("\n");

  return `LOCKED DESIGN SYSTEM — SYSTEM B (EDITORIAL / COASTAL-PREMIUM)

This niche (${palette.label}) uses System B. The design is FIXED. Do not invent your own layout, palette, or typography. Do not use Tailwind. The CSS below is complete — you only fill content.

REQUIRED <head> ELEMENTS:
1. <meta charset> + <meta viewport> + <title>
2. Google Fonts (use this block VERBATIM):
${systemBFontsHead()}
3. A single <style> block containing the FULL CSS BELOW VERBATIM. Do not edit, shorten, or "clean up" any of the CSS. Do not add Tailwind. Copy it exactly:

<style>
${systemBCss(palette)}
</style>

REQUIRED PAGE STRUCTURE (build the <body> in this exact order, using these exact class names):

1. <svg width="0" height="0" style="position:absolute" aria-hidden="true">
   <defs>
     <symbol id="brand-mark" viewBox="0 0 100 100">
       <!-- A custom inline SVG that depicts the niche subject. Fill colors using --ink, --tide (=${palette.accent}), --sun, --foam from the palette. The depicted subject MUST match the niche logo concept. -->
     </symbol>
     <symbol id="ico-phone" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>
     <symbol id="ico-mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 7l9 6 9-6" fill="none" stroke="currentColor" stroke-width="2"/></symbol>
     <symbol id="ico-pin" viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="9" r="2.5" fill="currentColor"/></symbol>
   </defs>
 </svg>

2. <div class="top-bar">
   - Left: <span class="pill"><span class="dot"></span>[Booking notice or live status — e.g. "Booking [DATE] — [DATE] · Same-Week Slots Open"]</span>
   - Right (.top-bar-right): clickable phone (tel:), clickable email (mailto:), hours line

3. <nav>
   - Left: .nav-logo with <svg><use href="#brand-mark"/></svg> + .lockup (.name = business name in title case, .tag = "EST. YYYY · CITY, ST")
   - Center: <ul class="nav-links"> with 4 <li><a> entries — Services, Our Work, How It Works, Contact (all # anchors)
   - Right: <a class="nav-cta" href="#contact">Get a Free Quote →</a>

4. <section class="hero"> with .hero-grid containing two children:
   - LEFT child:
     • .hero-tag <span class="dot"></span>[Service descriptor in caps]
     • <h1> using these spans across 3 lines — first line plain, second line "<span class='ital'>Word.</span>", third line "<span class='underline'>Words here.</span>"
     • .hero-lead — 2-3 line value-prop paragraph (specific to niche)
     • .hero-actions — two .btn elements:
        <a class="btn btn-primary" href="#contact">[Primary CTA] <span class="btn-arrow">→</span></a>
        <a class="btn btn-ghost" href="#work">[Secondary CTA]</a>
     • .hero-trust — 3 .hero-trust-item blocks (rating, customers, insurance/years). Each has .num and .lbl.
   - RIGHT child (.hero-visual):
     <img src="${images.hero}" alt="${palette.label}" onerror="this.onerror=null;this.src='${images.fallback}'" />
     <div class="hero-caption">
       <span class="left">CASE [NUM]</span>
       <span class="mid">[Headline detail]</span>
       <span class="right">[Stat / detail]</span>
     </div>

5. <div class="marquee">
   <div class="marquee-track">
     <span><span class="dot"></span>SERVICE 1<span class="dot"></span>SERVICE 2<span class="dot"></span>...repeat for ALL 6 services twice for the loop...</span>
     <span>...repeat the same span...</span>
   </div>
 </div>

6. <section class="services" id="services">
   - .section-head with first child = div containing .section-eyebrow "Services / What We Do" + <h2>[Headline] <span class="ital">[word].</span></h2>; second child = <a class="head-link">View pricing →</a>
   - .services-grid containing EXACTLY 6 .service blocks. Use these matched images verbatim:
${servicesList}
     Each .service block:
     <div class="service">
       <div class="service-img">
         <img src="[SERVICE_URL]" alt="[service name]" onerror="this.onerror=null;this.src='${images.fallback}'" />
         <span class="s-pill">[BADGE — e.g. "Most Booked", "Most Popular", "New", "Add-On"]</span>
       </div>
       <div class="service-body">
         <h3>[Service name in title case]</h3>
         <p>[2-3 line plain-language description]</p>
         <div class="service-meta">
           <div class="service-price"><span class="lbl">From</span>$[PRICE]</div>
           <div class="service-arrow">↗</div>
         </div>
       </div>
     </div>

7. <section class="transformation" id="work"> (the case-study showcase)
   .transformation-inner with two children:
   - LEFT child: .section-eyebrow "Case Study / [NUM]", <h2>One [time]. <span class="ital">[Outcome]</span>.</h2>, <p class="lead">[2-3 line story], .case-stats grid with 3 .case-stat (each .num + .lbl), <blockquote class="case-quote">"[testimonial]" <span class="author">— [Name] · [City] · Verified Review</span></blockquote>
   - RIGHT child: <div class="transformation-visual"><img src="${images.portfolio[0]}" alt="" onerror="this.onerror=null;this.src='${images.fallback}'" /></div>

8. <section class="process" id="process">
   - .section-head: .section-eyebrow "Process / How It Works" + <h2>From [start] to <span class="ital">[end]</span>, in [N] steps.</h2>
   - .process-grid — 4 .process-step blocks with .process-num "1"/"2"/"3"/"4", <h4>, <p>, <span class="duration">⏱ [time]</span>

9. <section class="testimonials">
   - .testimonials-inner > .section-head: eyebrow "Reviews / The Verdict" + <h2>[Star count] across <span class="ital">[N] reviews</span>.</h2> + .head-link "All reviews →"
   - .testimonial-grid: 3 .t-card. Each: <div class="stars">★★★★★</div>, <p class="quote">"...", .author with .t-avatar (2 letters), .t-name, .t-meta

10. <section class="cta-section" id="contact">
    .cta-card grid:
    - .cta-left: .section-eyebrow "Contact / Free Quote", <h2>[Headline]. <span class="ital">[Outcome].</span></h2>, <p class="lead">[response promise], .cta-contacts (3 .cta-row entries — phone with #ico-phone, email with #ico-mail, address/area with #ico-pin). Each .cta-row: .icon-circle + div containing .lbl + .val
    - .quote-form (form):
      <h3>[Form headline]</h3>
      <span class="form-eyebrow">Average response time · [TIME]</span>
      <form data-nn-form>
        Hidden honeypot first: <div aria-hidden="true" style="position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);border:0;"><label>Website<input type="text" name="company_website" tabindex="-1" autocomplete="off" /></label></div>
        .form-row with two .form-group: name (required, type=text), phone (required, type=tel)
        .form-group full width: address (type=text)
        .form-row with two .form-group: service (select, 6 niche options matching the services), size/scope (select, 4-5 options)
        .form-group full width: notes — <textarea name="message" rows="3">
        <button type="submit" class="form-submit">[Submit label] →</button>
        <p data-nn-form-status style="margin-top:0.6rem;font-family:'IBM Plex Mono',monospace;font-size:0.7rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--ink-dim);text-align:center;min-height:20px;"></p>
      </form>

11. <footer> with .footer-inner — 3 spans: business name + insurance status (with .accent), phone+email, city + license number.

CONTENT RULES (System B):
- Headlines mix plain words + <span class="ital">italic accent words</span>, like "Restored. <span class="ital">Refreshed.</span> Right at home." Use the patterns from the spec above.
- Tone: warm, premium-residential, conversational, specific. Not corporate, not chirpy.
- Use credible specific numbers in trust + case-study blocks (rating, # customers, % satisfaction).
- Reference real-feeling neighborhoods/cities/dates in testimonials and case studies (use the business address/city if provided).

IMAGE USAGE (System B):
- Hero: ${images.hero} (used in .hero-visual)
- Case study (transformation-visual): use the FIRST portfolio URL — ${images.portfolio[0]}
- The remaining portfolio URLs (${images.portfolio.slice(1).join(", ")}) can decorate testimonial avatars or be skipped.
- Each service uses its matched image listed above.
- Every <img> needs alt + onerror="this.onerror=null;this.src='${images.fallback}'"

DO NOT:
- Use Tailwind utility classes
- Add Lucide icons via CDN
- Replace any of the locked CSS
- Use any image not listed above`;
}

// =====================================================================
// SYSTEM C — Storm Roofing
// Reference: /public/samples/roofers.html (Summit & Crown Roofing)
// =====================================================================

function systemCCss(palette: DesignSystemPalette): string {
  const storm = palette.primary;
  const stormDeep = darken(palette.primary, 0.35);
  const copper = palette.accent;
  const copperDeep = darken(palette.accent, 0.18);
  return `:root {
  --storm: ${storm};
  --storm-deep: ${stormDeep};
  --slate: #1c2a38;
  --sky: #4a6c8c;
  --copper: ${copper};
  --copper-deep: ${copperDeep};
  --warning: #f6b72e;
  --paper: #f3f0eb;
  --paper-warm: #e9e3d8;
  --line: #d2cabb;
  --ink: #14181d;
  --muted: #5e6772;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: 'Inter', system-ui, sans-serif; color: var(--ink); background: var(--paper); line-height: 1.55; -webkit-font-smoothing: antialiased; }
.container { max-width: 1300px; margin: 0 auto; padding: 0 32px; }
.display { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.01em; }
.mono { font-family: 'IBM Plex Mono', monospace; }
.storm-alert { background: var(--storm); color: var(--warning); padding: 11px 0; font-family: 'IBM Plex Mono', monospace; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; border-bottom: 1px solid rgba(246,183,46,0.25); }
.storm-alert .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.storm-alert .alert-tag { background: var(--warning); color: var(--storm); padding: 3px 10px; border-radius: 3px; font-weight: 700; margin-right: 12px; }
.storm-alert a { color: #fff; text-decoration: none; font-weight: 600; }
nav.main { background: #fff; border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 50; }
nav.main .row { display: flex; align-items: center; justify-content: space-between; padding: 18px 0; }
.brand { display: flex; align-items: center; gap: 14px; text-decoration: none; color: var(--ink); }
.brand-mark { width: 48px; height: 48px; background: var(--storm); border-radius: 4px; display: grid; place-items: center; border: 2px solid var(--copper); }
.brand-name { font-family: 'Bebas Neue', sans-serif; font-size: 22px; line-height: 1; letter-spacing: 0.02em; }
.brand-sub { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--muted); letter-spacing: 0.16em; text-transform: uppercase; margin-top: 4px; }
.nav-links { display: flex; gap: 28px; align-items: center; }
.nav-links a { color: var(--ink); text-decoration: none; font-weight: 600; font-size: 14px; }
.nav-cta { display: inline-flex; align-items: center; gap: 10px; background: var(--copper); color: #fff; padding: 12px 22px; border-radius: 4px; font-weight: 700; text-decoration: none; font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; }
.nav-cta:hover { background: var(--copper-deep); }
.hero { background: linear-gradient(180deg, rgba(12,22,32,0.55) 0%, rgba(12,22,32,0.85) 100%), var(--storm-deep); color: #fff; padding: 100px 0 120px; position: relative; overflow: hidden; }
.hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at top, rgba(246,183,46,0.08), transparent 60%); pointer-events: none; }
.hero .container { position: relative; z-index: 2; }
.hero-meta { display: flex; gap: 28px; align-items: center; font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.7); margin-bottom: 32px; flex-wrap: wrap; }
.hero-meta .item { display: inline-flex; align-items: center; gap: 8px; }
.hero-meta .item::before { content: ''; width: 4px; height: 4px; background: var(--copper); border-radius: 50%; }
h1.hero-title { font-family: 'Bebas Neue', sans-serif; font-size: clamp(58px, 9vw, 130px); line-height: 0.92; letter-spacing: 0.005em; margin: 0 0 28px; max-width: 1100px; }
h1.hero-title .copper { color: var(--copper); }
h1.hero-title .strike { display: block; font-size: 0.7em; color: rgba(255,255,255,0.6); font-weight: 400; margin-top: 8px; }
.hero-lead { font-size: 19px; line-height: 1.6; color: rgba(255,255,255,0.85); max-width: 620px; margin: 0 0 40px; }
.hero-actions { display: flex; gap: 16px; flex-wrap: wrap; }
.btn-primary { background: var(--copper); color: #fff; padding: 18px 34px; border-radius: 4px; font-weight: 700; text-decoration: none; font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; display: inline-flex; align-items: center; gap: 10px; border: 2px solid var(--copper); }
.btn-primary:hover { background: var(--copper-deep); border-color: var(--copper-deep); }
.btn-outline { color: #fff; padding: 18px 30px; border-radius: 4px; font-weight: 700; text-decoration: none; font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; border: 2px solid rgba(255,255,255,0.4); }
.btn-outline:hover { border-color: #fff; }
.hero-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; background: var(--storm-deep); border-top: 1px solid rgba(246,183,46,0.2); }
.hero-stats .stat { padding: 36px 32px; border-right: 1px solid rgba(255,255,255,0.06); color: #fff; }
.hero-stats .stat:last-child { border-right: none; }
.hero-stats .num { font-family: 'Bebas Neue', sans-serif; font-size: 56px; line-height: 1; color: var(--warning); }
.hero-stats .lab { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.6); margin-top: 10px; }
.section { padding: 110px 0; }
.eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--copper); display: inline-flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.eyebrow::before { content: ''; width: 32px; height: 2px; background: var(--copper); }
h2.section-title { font-family: 'Bebas Neue', sans-serif; font-size: clamp(42px, 6vw, 84px); line-height: 0.96; letter-spacing: 0.005em; margin: 0 0 22px; max-width: 900px; }
.section-lead { font-size: 17px; color: var(--muted); max-width: 640px; line-height: 1.6; }
.insurance { background: var(--paper-warm); position: relative; }
.insurance-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
.insurance-img { border-radius: 6px; overflow: hidden; aspect-ratio: 5 / 6; background-size: cover; background-position: center; position: relative; }
.insurance-img::after { content: attr(data-claim); position: absolute; bottom: 24px; left: 24px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #fff; background: rgba(12,22,32,0.85); padding: 8px 14px; letter-spacing: 0.12em; border-left: 3px solid var(--warning); }
.insurance-steps { list-style: none; padding: 0; margin: 36px 0 0; counter-reset: step; }
.insurance-steps li { counter-increment: step; padding: 24px 0; border-top: 1px solid var(--line); display: grid; grid-template-columns: auto 1fr; gap: 24px; }
.insurance-steps li:last-child { border-bottom: 1px solid var(--line); }
.insurance-steps li::before { content: counter(step, decimal-leading-zero); font-family: 'Bebas Neue', sans-serif; font-size: 36px; line-height: 1; color: var(--copper); }
.insurance-steps h4 { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 0.01em; margin: 0 0 6px; }
.insurance-steps p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.6; }
.damage { background: var(--storm); color: #fff; position: relative; }
.damage-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 64px; }
.damage-card { background: var(--storm-deep); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; overflow: hidden; }
.damage-pair { display: grid; grid-template-columns: 1fr 1fr; position: relative; }
.damage-pair .img { aspect-ratio: 1 / 1; background-size: cover; background-position: center; position: relative; }
.damage-pair .img::after { content: attr(data-label); position: absolute; top: 12px; left: 12px; font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.16em; background: rgba(12,22,32,0.85); color: #fff; padding: 5px 9px; border-radius: 2px; }
.damage-pair .img.after::after { background: var(--copper); }
.damage-info { padding: 20px 24px; }
.damage-info h4 { font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 0.01em; margin: 0 0 6px; }
.damage-info .meta { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: rgba(255,255,255,0.5); letter-spacing: 0.1em; text-transform: uppercase; }
.damage-info p { font-size: 13px; color: rgba(255,255,255,0.7); margin: 12px 0 0; line-height: 1.6; }
.services-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 64px; }
.service-card { background: #fff; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s; }
.service-card:hover { transform: translateY(-3px); }
.service-card .img { height: 220px; background-size: cover; background-position: center; }
.service-card .body { padding: 28px; flex: 1; }
.service-card h3 { font-family: 'Bebas Neue', sans-serif; font-size: 30px; letter-spacing: 0.01em; line-height: 1; margin: 0 0 8px; }
.service-card .price-tag { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--copper); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 16px; }
.service-card p { font-size: 14px; color: var(--muted); line-height: 1.6; margin: 0 0 18px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 20px; border-top: 1px solid var(--line); }
.chip { background: var(--paper-warm); color: var(--ink); padding: 5px 11px; border-radius: 3px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.04em; }
.certs { background: var(--paper-warm); padding: 60px 0; }
.certs-row { display: flex; align-items: center; justify-content: space-between; gap: 32px; flex-wrap: wrap; }
.certs-label { font-family: 'IBM Plex Mono', monospace; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); }
.cert-logo { font-family: 'Bebas Neue', sans-serif; font-size: 26px; color: var(--storm); opacity: 0.55; letter-spacing: 0.04em; }
.trust { background: var(--storm-deep); color: #fff; padding: 90px 0; }
.trust-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 48px; align-items: center; }
.trust-grid h3 { font-family: 'Bebas Neue', sans-serif; font-size: 44px; line-height: 1; letter-spacing: 0.005em; margin: 0; }
.trust-stat .num { font-family: 'Bebas Neue', sans-serif; font-size: 64px; line-height: 1; color: var(--copper); }
.trust-stat .lab { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.6); margin-top: 10px; }
.testimonials { background: var(--paper); }
.test-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 28px; margin-top: 56px; }
.test-card { background: #fff; padding: 38px; border: 1px solid var(--line); border-radius: 6px; border-left: 4px solid var(--copper); }
.test-stars { color: var(--warning); font-size: 16px; letter-spacing: 3px; margin-bottom: 18px; }
.test-quote { font-size: 17px; line-height: 1.7; color: var(--ink); margin: 0 0 26px; font-weight: 500; }
.test-foot { display: flex; align-items: center; justify-content: space-between; padding-top: 20px; border-top: 1px solid var(--line); }
.test-author { display: flex; align-items: center; gap: 12px; }
.test-name { font-weight: 700; font-size: 14px; }
.test-meta { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--muted); letter-spacing: 0.06em; }
.test-claim { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--copper); letter-spacing: 0.1em; text-transform: uppercase; }
.cta { background: var(--storm); color: #fff; position: relative; overflow: hidden; }
.cta::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(200,118,62,0.2), transparent 50%); opacity: 0.55; }
.cta .container { position: relative; z-index: 2; }
.cta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: start; }
.cta-form { background: #fff; color: var(--ink); border-radius: 6px; padding: 40px; border-top: 6px solid var(--copper); }
.cta-form h3 { font-family: 'Bebas Neue', sans-serif; font-size: 38px; line-height: 1; margin: 0 0 8px; }
.cta-form .sub { font-size: 14px; color: var(--muted); margin: 0 0 28px; }
.form-row { margin-bottom: 16px; }
.form-row label { display: block; font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 6px; color: var(--ink); font-weight: 600; }
.form-row input, .form-row select, .form-row textarea { width: 100%; padding: 14px; border: 1px solid var(--line); border-radius: 4px; font-size: 14px; font-family: inherit; background: var(--paper); }
.form-row textarea { min-height: 90px; resize: vertical; }
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-submit { width: 100%; background: var(--copper); color: #fff; padding: 18px; border: none; border-radius: 4px; font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 0.04em; cursor: pointer; margin-top: 6px; }
.form-submit:hover { background: var(--copper-deep); }
footer { background: var(--storm-deep); color: rgba(255,255,255,0.65); padding: 64px 0 28px; }
.footer-grid { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 40px; padding-bottom: 40px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.footer-grid h4 { font-family: 'Bebas Neue', sans-serif; font-size: 16px; color: #fff; margin: 0 0 16px; letter-spacing: 0.06em; }
.footer-grid a { display: block; color: rgba(255,255,255,0.65); text-decoration: none; font-size: 14px; padding: 4px 0; }
.footer-grid a:hover { color: var(--copper); }
.footer-bottom { padding-top: 24px; display: flex; align-items: center; justify-content: space-between; font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.08em; color: rgba(255,255,255,0.4); }
@media (max-width: 980px) {
  .insurance-grid, .cta-grid, .trust-grid { grid-template-columns: 1fr; gap: 40px; }
  .damage-grid, .services-grid { grid-template-columns: 1fr; }
  .test-grid { grid-template-columns: 1fr; }
  .hero-stats { grid-template-columns: repeat(2, 1fr); }
  .footer-grid { grid-template-columns: 1fr 1fr; }
}`;
}

function systemCFontsHead(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />`;
}

function buildSystemCBlock(
  palette: DesignSystemPalette,
  images: DesignSystemImages,
): string {
  const servicesList = images.services
    .map((s, i) => `    ${i + 1}) "${s.name}" (depicts: ${s.keyword}) → ${s.url}`)
    .join("\n");
  const portfolioList = images.portfolio.map((u, i) => `    ${i + 1}) ${u}`).join("\n");

  return `LOCKED DESIGN SYSTEM — SYSTEM C (STORM ROOFING)

This niche (${palette.label}) uses System C — a storm-restoration / insurance-claim layout. The design is FIXED. Do not invent your own layout, palette, or typography. Do not use Tailwind. The CSS below is complete — you only fill content.

REQUIRED <head> ELEMENTS:
1. <meta charset> + <meta viewport> + <title>
2. Google Fonts (use this block VERBATIM):
${systemCFontsHead()}
3. A single <style> block containing the FULL CSS BELOW VERBATIM. Do not edit, shorten, or "clean up" any of the CSS. Do not add Tailwind. Copy it exactly:

<style>
${systemCCss(palette)}
</style>

REQUIRED PAGE STRUCTURE (build the <body> in this exact order, using these exact class names):

1. <div class="storm-alert">
   - <div class="container row">
     - Left: <span class="alert-tag">ACTIVE</span> + a real-sounding storm alert line ("[MONTH DAY] hailstorm [CITY]: free claims walkthrough · [N] inspections completed this week")
     - Right: CALL <a href="tel:...">phone</a>

2. <nav class="main">
   - <div class="container row">
     - <a class="brand">: .brand-mark with inline house-icon SVG (the niche logo concept), then div with .brand-name (UPPERCASE business) + .brand-sub ("ROOFING · [STATE LIC #] · GAF MASTER ELITE" or similar credentials)
     - .nav-links: 5 anchors (Services, Storm Work, Insurance Help, Reviews, Free Inspection)
     - <a class="nav-cta" href="tel:...">Free roof inspection</a>

3. <section class="hero">
   <div class="container">
     - .hero-meta: 3 .item spans (specialty, service area cities, "Insurance approved")
     - <h1 class="hero-title"> with a 2-3 line headline. Use <span class="copper"> for the second line and a small <span class="strike"> on a third line. Pattern: "Storms break roofs.<br/><span class='copper'>We rebuild them right.</span><span class='strike'>— and your insurance pays for it.</span>"
     - <p class="hero-lead">: 1-2 sentences naming concrete proof (years, drone, Xactimate, manufacturer, warranty length).
     - .hero-actions: <a class="btn-primary"> + <a class="btn-outline" href="tel:...">

4. <div class="hero-stats"> — 4 .stat children, each: <div class="num">[NUM]</div><div class="lab">[CAPS]</div>. Use credible specifics (roofs replaced, claims approved %, material warranty years, BBB rating).

5. <section class="section damage" id="damage">
   <div class="container">
     - .eyebrow with style="color: var(--warning);" "Recent storm work"
     - <h2 class="section-title"> 2-line headline
     - <p class="section-lead" style="color: rgba(255,255,255,0.65);"> proof line
     - .damage-grid with EXACTLY 3 .damage-card children. Each:
       <div class="damage-card">
         <div class="damage-pair">
           <div class="img" data-label="BEFORE" style="background-image: url('[IMG1]')"></div>
           <div class="img after" data-label="AFTER" style="background-image: url('[IMG2]')"></div>
         </div>
         <div class="damage-info">
           <h4>[Neighborhood] · [Damage Type] ([Spec])</h4>
           <div class="meta">Claim approved · [N] days · [Insurance Carrier]</div>
           <p>[2-line scope description naming specific materials/upgrades]</p>
         </div>
       </div>
     Use the first 6 service URLs as before/after pairs:
${servicesList}

6. <section class="section insurance" id="insurance">
   <div class="container">
     - .insurance-grid with two children:
       LEFT: <div class="insurance-img" data-claim="CLAIM #4427-A" style="background-image: url('${images.hero}')"></div>
       RIGHT: <div>
         .eyebrow "We handle the insurance fight"
         <h2 class="section-title"> 2-line headline like "Your only job?<br/>Pay your deductible."
         .section-lead with concrete claims experience number
         <ol class="insurance-steps"> with EXACTLY 4 <li> entries — each <li><div><h4>[step name]</h4><p>[2-line description]</p></div></li>. Steps cover: free drone inspection, meeting the adjuster, Xactimate-matched scope/supplements, "you pay deductible · we do the rest".
       </div>

7. <section class="section" id="services">
   <div class="container">
     - .eyebrow "Roofing services"
     - <h2 class="section-title"> 2-line headline naming materials
     - .section-lead with manufacturer certifications
     - .services-grid with EXACTLY 6 .service-card children. Each:
       <div class="service-card">
         <div class="img" style="background-image: url('[SERVICE_URL]')"></div>
         <div class="body">
           <h3>[Service Name]</h3>
           <div class="price-tag">[PRICE RANGE OR STARTING POINT]</div>
           <p>[2-line description with specific materials]</p>
           <div class="chips">
             <span class="chip">[CHIP1]</span><span class="chip">[CHIP2]</span><span class="chip">[CHIP3]</span>
           </div>
         </div>
       </div>
     Service names + photos must come from this list:
${servicesList}

8. <section class="certs">
   <div class="container certs-row">
     <div class="certs-label">Manufacturer certified &amp; backed</div>
     Then 4 <div class="cert-logo"> entries — real roofing certifications/manufacturers (GAF MASTER ELITE, OWENS CORNING PLATINUM, CERTAINTEED SELECT, EAGLEVIEW).

9. <section class="trust">
   <div class="container">
     <div class="trust-grid">
       <h3>[1-line confidence statement: "[N] decades on [STATE] roofs. We've seen every storm."]</h3>
       Then 3 .trust-stat children: <div class="trust-stat"><div class="num">[NUM]</div><div class="lab">[CAPS]</div></div>
       Use specifics: roofs since [YEAR], $ claims recovered, review stars + count.

10. <section class="section testimonials" id="reviews">
    <div class="container">
      .eyebrow "Verified homeowner reviews"
      <h2 class="section-title"> 2-line headline
      .test-grid with EXACTLY 4 .test-card children. Each:
      <div class="test-card">
        <div class="test-stars">★★★★★</div>
        <p class="test-quote">"[3-4 sentence quote citing real claim outcomes — dollar amounts, days, carrier names, specific upgrades]"</p>
        <div class="test-foot">
          <div class="test-author"><div><div class="test-name">[First L.]</div><div class="test-meta">[City, ST · Carrier]</div></div></div>
          <div class="test-claim">CLAIM #XXXX-X</div>
        </div>
      </div>

11. <section class="section cta" id="contact">
    <div class="container">
      <div class="cta-grid">
        LEFT: <div>
          .eyebrow with style="color: var(--warning);" "Free 47-point inspection"
          <h2 class="section-title"> 2-line headline like "Schedule your<br/>drone roof scan."
          .section-lead with 48-hour booking + PDF report claim
          A 3-stat strip with <div style="margin-top: 40px;"><div style="display: flex; gap: 28px; flex-wrap: wrap;">...3 stats: $0 inspection cost / 48 hr booking / 12 pg PDF report — using the styled inline-divs from the reference.
        </div>
        RIGHT: <form class="cta-form" data-nn-form>
          Hidden honeypot first: <div class="sr-only" aria-hidden="true" style="position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);border:0;"><label>Website<input type="text" name="company_website" tabindex="-1" autocomplete="off" /></label></div>
          <h3>Free Roof Inspection</h3>
          <p class="sub">Most homes booked within 48 hours. We text within 60 min during business hours.</p>
          .form-row-2 with first/last name (required, type=text)
          .form-row with mobile (required, type=tel, name=phone)
          .form-row with property address (required, type=text)
          .form-row with select "Roof age & concern" — 6 options (Recent storm, Active leak, 15+ years, Selling, Pre-purchase, Routine)
          .form-row with textarea "Anything else?" (name=message, placeholder)
          <button type="submit" class="form-submit">Schedule My Inspection</button>
          <p data-nn-form-status style="margin-top:0.6rem;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);"></p>
        </form>

12. <footer>
    <div class="container">
      <div class="footer-grid"> 4 columns: brand+description, Services links, Service Area cities, Contact (phone/email/address).
      <div class="footer-bottom"> left: copyright + license · right: tagline.

USE PORTFOLIO IMAGES (for damage gallery if needed):
${portfolioList}

CONTENT RULES (System C):
- Tone: storm-restoration veteran + insurance fluency. Concrete numbers everywhere — claim dollar amounts, days to approval, carrier names (Allstate, State Farm, USAA, Farmers), Xactimate, GAF, Owens Corning, Class 4 impact, deductibles.
- All testimonials must reference a specific carrier or claim outcome.
- Headlines are punchy, 2 lines max — "Storms break roofs. We rebuild them right." pattern.
- Bebas Neue for all big display text. Inter for body. IBM Plex Mono for credentials, claim numbers, eyebrows.

DO NOT:
- Use Tailwind utility classes
- Add Lucide icons via CDN
- Replace any of the locked CSS
- Use any image not listed above
- Add JS animations beyond the form handler`;
}

// =====================================================================
// SYSTEM D — Performance Gym
// Reference: /public/samples/gyms.html (BLACKIRON Performance)
// =====================================================================

function systemDCss(palette: DesignSystemPalette): string {
  const ink = palette.primary;
  const inkDeep = darken(palette.primary, 0.4);
  const neon = palette.accent;
  const neonDeep = darken(palette.accent, 0.18);
  return `:root {
  --ink: ${ink};
  --ink-2: ${inkDeep};
  --ink-3: #1a1a1a;
  --neon: ${neon};
  --neon-deep: ${neonDeep};
  --paper: #f5f5f3;
  --paper-2: #ebebe7;
  --line: #2a2a2a;
  --line-light: #d8d8d2;
  --muted: #8a8a8a;
  --muted-2: #5a5a5a;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: var(--paper); }
body { font-family: 'Inter', system-ui, sans-serif; color: var(--ink); line-height: 1.5; -webkit-font-smoothing: antialiased; }
.container { max-width: 1320px; margin: 0 auto; padding: 0 32px; }
.display { font-family: 'Oswald', sans-serif; text-transform: uppercase; letter-spacing: 0.005em; }
.mono { font-family: 'JetBrains Mono', monospace; }
.ticker { background: var(--ink); color: var(--neon); border-bottom: 2px solid var(--neon); overflow: hidden; padding: 10px 0; font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; }
.ticker-track { display: inline-flex; gap: 56px; white-space: nowrap; animation: scroll 40s linear infinite; }
.ticker-track span { display: inline-flex; align-items: center; gap: 12px; }
.ticker-track span::before { content: '◆'; color: var(--neon); font-size: 9px; }
@keyframes scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
nav.main { background: var(--ink); color: #fff; position: sticky; top: 0; z-index: 60; border-bottom: 1px solid #1a1a1a; }
nav.main .row { display: flex; align-items: center; justify-content: space-between; padding: 18px 0; }
.brand { display: flex; align-items: center; gap: 14px; text-decoration: none; color: #fff; }
.brand-mark { width: 50px; height: 50px; background: var(--neon); display: grid; place-items: center; transform: skewX(-8deg); border: 2px solid #fff; }
.brand-mark > * { transform: skewX(8deg); }
.brand-name { font-family: 'Oswald', sans-serif; font-size: 22px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.brand-sub { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted); letter-spacing: 0.18em; text-transform: uppercase; margin-top: 4px; }
.nav-links { display: flex; gap: 28px; align-items: center; }
.nav-links a { color: #fff; text-decoration: none; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; }
.nav-links a:hover { color: var(--neon); }
.nav-cta { background: var(--neon); color: var(--ink); padding: 12px 22px; font-family: 'Oswald', sans-serif; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; text-decoration: none; transform: skewX(-8deg); display: inline-block; }
.nav-cta > * { transform: skewX(8deg); display: inline-block; }
.hero { background: var(--ink); color: #fff; padding: 88px 0 0; position: relative; overflow: hidden; }
.hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at top right, rgba(212,255,58,0.08), transparent 60%); pointer-events: none; }
.hero .container { position: relative; z-index: 2; }
.hero-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 56px; align-items: end; padding-bottom: 80px; }
.hero-meta { display: flex; gap: 20px; align-items: center; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); margin-bottom: 28px; flex-wrap: wrap; }
.hero-meta .pin { width: 8px; height: 8px; background: var(--neon); border-radius: 50%; box-shadow: 0 0 12px var(--neon); }
.hero-meta .item { display: inline-flex; align-items: center; gap: 8px; }
.hero-meta .item::before { content: ''; width: 4px; height: 4px; background: var(--neon); }
h1.hero-title { font-family: 'Oswald', sans-serif; font-size: clamp(64px, 10vw, 154px); line-height: 0.86; letter-spacing: 0.005em; text-transform: uppercase; margin: 0 0 32px; }
h1.hero-title .neon { color: var(--neon); }
h1.hero-title .stroke { -webkit-text-stroke: 2px #fff; color: transparent; }
.hero-lead { font-size: 19px; line-height: 1.6; color: rgba(255,255,255,0.78); max-width: 540px; margin: 0 0 36px; }
.hero-actions { display: flex; gap: 16px; flex-wrap: wrap; }
.btn-neon { background: var(--neon); color: var(--ink); padding: 18px 34px; font-family: 'Oswald', sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 14px; text-decoration: none; transform: skewX(-8deg); display: inline-block; }
.btn-neon > * { transform: skewX(8deg); display: inline-block; }
.btn-outline { color: #fff; padding: 18px 30px; font-family: 'Oswald', sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 14px; text-decoration: none; border: 2px solid rgba(255,255,255,0.4); }
.btn-outline:hover { border-color: var(--neon); color: var(--neon); }
.hero-photo { aspect-ratio: 4/5; background-size: cover; background-position: center; border: 3px solid var(--neon); position: relative; }
.hero-photo::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 50%, rgba(10,10,10,0.6) 100%); }
.hero-photo .stamp { position: absolute; top: 16px; right: 16px; background: var(--neon); color: var(--ink); padding: 5px 11px; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.16em; font-weight: 700; transform: rotate(3deg); z-index: 2; }
.hero-stats { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--line); }
.hero-stats .stat { padding: 36px 32px; border-right: 1px solid var(--line); }
.hero-stats .stat:last-child { border-right: none; }
.hero-stats .num { font-family: 'Oswald', sans-serif; font-size: 56px; line-height: 1; color: var(--neon); }
.hero-stats .lab { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin-top: 10px; }
.section { padding: 110px 0; }
.eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--neon-deep); display: inline-flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.eyebrow::before { content: ''; width: 32px; height: 2px; background: var(--neon-deep); }
h2.section-title { font-family: 'Oswald', sans-serif; font-size: clamp(44px, 6.4vw, 92px); line-height: 0.92; letter-spacing: 0.005em; text-transform: uppercase; margin: 0 0 22px; max-width: 900px; }
.section-lead { font-size: 17px; color: var(--muted-2); max-width: 640px; line-height: 1.6; }
.transformations { background: var(--paper); }
.trans-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 64px; }
.trans-card { background: #fff; border: 1px solid var(--line-light); overflow: hidden; }
.trans-pair { display: grid; grid-template-columns: 1fr 1fr; }
.trans-pair .img { aspect-ratio: 1 / 1; background-size: cover; background-position: center; position: relative; }
.trans-pair .img::after { content: attr(data-label); position: absolute; top: 12px; left: 12px; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.16em; font-weight: 700; background: rgba(10,10,10,0.85); color: var(--neon); padding: 5px 9px; }
.trans-pair .img.after::after { background: var(--neon); color: var(--ink); }
.trans-info { padding: 24px; }
.trans-info h4 { font-family: 'Oswald', sans-serif; font-size: 22px; letter-spacing: 0.01em; margin: 0 0 6px; text-transform: uppercase; }
.trans-info .meta { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; }
.trans-stats { display: flex; gap: 24px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line-light); }
.trans-stats .stat { flex: 1; }
.trans-stats .num { font-family: 'Oswald', sans-serif; font-size: 26px; color: var(--ink); line-height: 1; }
.trans-stats .lab { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; margin-top: 4px; }
.schedule { background: var(--ink); color: #fff; }
.sched-grid { display: grid; grid-template-columns: 80px repeat(5, 1fr); gap: 4px; margin-top: 56px; font-family: 'JetBrains Mono', monospace; font-size: 11px; }
.sched-grid > div { padding: 14px 12px; }
.sched-grid .sched-head { background: var(--neon); color: var(--ink); font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; text-align: center; }
.sched-grid .sched-time { background: rgba(255,255,255,0.04); color: var(--muted); letter-spacing: 0.1em; }
.sched-grid .sched-cell { background: rgba(255,255,255,0.04); border-left: 3px solid transparent; }
.sched-grid .sched-cell.lift { border-left-color: var(--neon); }
.sched-grid .sched-cell.metcon { border-left-color: #f97316; }
.sched-grid .sched-cell.hybrid { border-left-color: #38bdf8; }
.sched-grid .sched-cell strong { color: #fff; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; display: block; }
.sched-grid .sched-cell span { color: var(--muted); font-size: 10px; }
.sched-legend { display: flex; gap: 28px; margin-top: 24px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted); letter-spacing: 0.12em; text-transform: uppercase; }
.sched-legend .dot { display: inline-block; width: 12px; height: 12px; margin-right: 8px; vertical-align: middle; }
.coaches-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-top: 56px; }
.coach-card { background: #fff; border: 1px solid var(--line-light); padding: 24px; }
.coach-photo { aspect-ratio: 1/1; background-size: cover; background-position: center; margin-bottom: 16px; border: 2px solid var(--ink); }
.coach-card h4 { font-family: 'Oswald', sans-serif; font-size: 22px; text-transform: uppercase; letter-spacing: 0.01em; margin: 0 0 4px; }
.coach-card .role { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--neon-deep); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 14px; }
.coach-card p { font-size: 13px; color: var(--muted-2); line-height: 1.6; margin-bottom: 14px; }
.coach-creds { display: flex; flex-wrap: wrap; gap: 6px; }
.coach-creds .chip { background: var(--paper-2); color: var(--ink); padding: 4px 10px; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.06em; }
.pricing { background: var(--paper-2); }
.pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 56px; }
.price-card { background: #fff; padding: 36px 32px; border: 2px solid var(--ink); position: relative; }
.price-card.featured { background: var(--ink); color: #fff; border-color: var(--neon); transform: translateY(-12px); }
.price-card .tier { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--neon-deep); margin-bottom: 12px; }
.price-card.featured .tier { color: var(--neon); }
.price-card h3 { font-family: 'Oswald', sans-serif; font-size: 36px; text-transform: uppercase; letter-spacing: 0.01em; margin: 0 0 16px; }
.price-card .price { font-family: 'Oswald', sans-serif; font-size: 64px; line-height: 1; margin-bottom: 4px; }
.price-card .price .currency { font-size: 28px; vertical-align: super; }
.price-card .price-note { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 24px; }
.price-card.featured .price-note { color: rgba(255,255,255,0.6); }
.price-feats { list-style: none; padding: 0; margin: 0 0 28px; }
.price-feats li { font-size: 14px; padding: 10px 0; border-top: 1px solid var(--line-light); display: flex; align-items: center; gap: 10px; }
.price-card.featured .price-feats li { border-top-color: rgba(255,255,255,0.1); }
.price-feats li::before { content: '◆'; color: var(--neon-deep); font-size: 9px; }
.price-card.featured .price-feats li::before { color: var(--neon); }
.price-card .price-cta { display: block; text-align: center; padding: 16px; background: var(--ink); color: #fff; font-family: 'Oswald', sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; text-decoration: none; }
.price-card.featured .price-cta { background: var(--neon); color: var(--ink); }
.testimonials { background: var(--ink); color: #fff; }
.test-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-top: 56px; }
.test-card { background: rgba(255,255,255,0.04); padding: 36px; border-left: 3px solid var(--neon); }
.test-quote { font-size: 17px; line-height: 1.7; margin: 0 0 24px; }
.test-foot { display: flex; align-items: center; justify-content: space-between; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.08); }
.test-author { display: flex; align-items: center; gap: 14px; }
.test-avatar { width: 48px; height: 48px; background: var(--neon); transform: skewX(-8deg); display: grid; place-items: center; font-family: 'Oswald', sans-serif; color: var(--ink); font-weight: 700; font-size: 18px; }
.test-name { font-weight: 700; font-size: 14px; }
.test-meta { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted); letter-spacing: 0.06em; }
.test-result { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--neon); letter-spacing: 0.1em; text-transform: uppercase; }
.cta { background: var(--neon); color: var(--ink); padding: 110px 0; }
.cta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; }
.cta h2 { font-family: 'Oswald', sans-serif; font-size: clamp(48px, 7vw, 96px); line-height: 0.9; letter-spacing: 0.005em; text-transform: uppercase; margin: 0 0 22px; }
.cta p { font-size: 17px; line-height: 1.6; max-width: 520px; }
.cta-form { background: var(--ink); color: #fff; padding: 36px; border: 3px solid var(--ink); }
.cta-form h3 { font-family: 'Oswald', sans-serif; font-size: 32px; text-transform: uppercase; margin: 0 0 8px; }
.cta-form .sub { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin: 0 0 24px; }
.form-row { margin-bottom: 16px; }
.form-row label { display: block; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
.form-row input, .form-row select, .form-row textarea { width: 100%; padding: 14px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.04); color: #fff; font-size: 14px; font-family: inherit; }
.form-row textarea { min-height: 90px; resize: vertical; }
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-submit { width: 100%; background: var(--neon); color: var(--ink); padding: 18px; border: none; font-family: 'Oswald', sans-serif; font-size: 22px; text-transform: uppercase; letter-spacing: 0.04em; cursor: pointer; margin-top: 6px; }
footer { background: var(--ink-2); color: rgba(255,255,255,0.65); padding: 64px 0 28px; }
.footer-grid { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 40px; padding-bottom: 40px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.footer-grid h4 { font-family: 'Oswald', sans-serif; font-size: 16px; color: #fff; margin: 0 0 16px; letter-spacing: 0.06em; text-transform: uppercase; }
.footer-grid a { display: block; color: rgba(255,255,255,0.65); text-decoration: none; font-size: 14px; padding: 4px 0; }
.footer-grid a:hover { color: var(--neon); }
.footer-bottom { padding-top: 24px; display: flex; align-items: center; justify-content: space-between; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.08em; color: rgba(255,255,255,0.4); }
@media (max-width: 980px) {
  .hero-grid, .cta-grid { grid-template-columns: 1fr; }
  .hero-stats { grid-template-columns: repeat(2, 1fr); }
  .hero-stats .stat { border-bottom: 1px solid var(--line); }
  .trans-grid, .pricing-grid, .test-grid, .coaches-grid { grid-template-columns: 1fr; }
  .sched-grid { grid-template-columns: 60px repeat(5, 1fr); font-size: 10px; }
  .footer-grid { grid-template-columns: 1fr 1fr; }
}`;
}

function systemDFontsHead(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />`;
}

function buildSystemDBlock(
  palette: DesignSystemPalette,
  images: DesignSystemImages,
): string {
  const servicesList = images.services
    .map((s, i) => `    ${i + 1}) "${s.name}" (depicts: ${s.keyword}) → ${s.url}`)
    .join("\n");
  const portfolioList = images.portfolio.map((u, i) => `    ${i + 1}) ${u}`).join("\n");

  return `LOCKED DESIGN SYSTEM — SYSTEM D (PERFORMANCE GYM)

This niche (${palette.label}) uses System D — a high-intensity gym/strength layout with skewed accents and a class schedule. The design is FIXED. Do not invent your own layout, palette, or typography. Do not use Tailwind. The CSS below is complete — you only fill content.

REQUIRED <head> ELEMENTS:
1. <meta charset> + <meta viewport> + <title>
2. Google Fonts (use this block VERBATIM):
${systemDFontsHead()}
3. A single <style> block containing the FULL CSS BELOW VERBATIM:

<style>
${systemDCss(palette)}
</style>

REQUIRED PAGE STRUCTURE (build the <body> in this exact order, using these exact class names):

1. <div class="ticker">
   <div class="ticker-track">
     8-12 <span> entries (real performance/training claims): "OPEN 5AM TO 11PM", "SQUAT RACKS · 12", "MEMBERS · [N]", "COACHES · [N]", "OLYMPIC PLATFORMS · 6", etc. Repeat the list TWICE inside the same .ticker-track to make the loop seamless.

2. <nav class="main">
   <div class="container row">
     - <a class="brand">: .brand-mark with skewed inline SVG (a barbell, dumbbell, or kettlebell shape — not a generic monogram), then div with .brand-name (UPPERCASE) + .brand-sub ("STRENGTH · CONDITIONING · [CITY]")
     - .nav-links: 5 anchors (Train, Coaches, Schedule, Pricing, Reviews)
     - <a class="nav-cta"><span>Free Trial Week</span></a>

3. <section class="hero">
   <div class="container">
     <div class="hero-grid">
       LEFT: <div>
         .hero-meta with a .pin span and 3 .item spans (specialty, e.g. "Powerlifting · Strongman · Hybrid", location, "Free trial week")
         <h1 class="hero-title">: 3-line uppercase headline with <span class="neon"> on the second line and <span class="stroke"> on the third. Pattern: "Train hard.<br/><span class='neon'>Get strong.</span><br/><span class='stroke'>No excuses.</span>"
         <p class="hero-lead">: 1-2 sentences with concrete proof — coach credentials, sq ft, equipment count.
         .hero-actions: <a class="btn-neon"><span>Book Free Trial</span></a> + <a class="btn-outline">See Pricing</a>
       RIGHT: <div class="hero-photo" style="background-image: url('${images.hero}')">
         <div class="stamp">EST. YYYY</div>
       </div>

4. <div class="hero-stats"> on the dark background — 4 .stat children (years open, member count, coach-to-member ratio like "22:1", coach count). Each: <div class="num">[NUM]</div><div class="lab">[CAPS]</div>

5. <section class="section transformations">
   <div class="container">
     .eyebrow "Real members. Real results."
     <h2 class="section-title"> 2-line headline
     .section-lead with measurable outcomes
     .trans-grid with EXACTLY 3 .trans-card children. Each:
     <div class="trans-card">
       <div class="trans-pair">
         <div class="img" data-label="START" style="background-image: url('[BEFORE]')"></div>
         <div class="img after" data-label="WEEK [N]" style="background-image: url('[AFTER]')"></div>
       </div>
       <div class="trans-info">
         <h4>[Member Name] · [Goal]</h4>
         <div class="meta">[Program] · [Duration]</div>
         <div class="trans-stats">
           <div class="stat"><div class="num">[NUM]</div><div class="lab">[STAT LABEL]</div></div>
           <div class="stat"><div class="num">[NUM]</div><div class="lab">[STAT LABEL]</div></div>
         </div>
       </div>
     </div>
     Use these images for the before/after pairs:
${servicesList}

6. <section class="section schedule" id="schedule">
   <div class="container">
     .eyebrow style="color: var(--neon);" "Weekly schedule"
     <h2 class="section-title" style="color: #fff;"> 2-line headline
     <p class="section-lead" style="color: rgba(255,255,255,0.6);"> count of weekly classes
     .sched-grid (timetable):
       Row 1 (header row): empty .sched-head, then 5 .sched-head day cells (MON, TUE, WED, THU, FRI)
       Then 6 time rows. Each row: a .sched-time cell ("6:00", "7:30", etc.) + 5 .sched-cell entries.
       Each .sched-cell adds a class — "lift" / "metcon" / "hybrid" — and contains: <strong>[CLASS NAME]</strong><span>[COACH]</span>
     .sched-legend: 3 entries with .dot color swatch (lift/metcon/hybrid).

7. <section class="section">
   <div class="container">
     .eyebrow "Coaches"
     <h2 class="section-title"> 2-line headline
     .coaches-grid with EXACTLY 4 .coach-card children. Each:
     <div class="coach-card">
       <div class="coach-photo" style="background-image: url('[PHOTO]')"></div>
       <h4>[Coach Name]</h4>
       <div class="role">[Specialty · e.g. STRENGTH HEAD COACH]</div>
       <p>[2-line bio referencing competitions, certs, lifts]</p>
       <div class="coach-creds"><span class="chip">[CERT]</span><span class="chip">[CERT]</span><span class="chip">[ACCOMPLISHMENT]</span></div>
     </div>
     Use these images for coach photos:
${portfolioList}

8. <section class="section pricing" id="pricing">
   <div class="container">
     .eyebrow "Membership"
     <h2 class="section-title"> 2-line headline like "No 12-month traps.<br/>Pay what you train for."
     .pricing-grid with EXACTLY 3 .price-card children. Add class "featured" to the middle card. Each:
     <div class="price-card[ featured]">
       <div class="tier">[BRONZE / SILVER / GOLD or DROP-IN / MEMBER / COACHED]</div>
       <h3>[Tier Name]</h3>
       <div class="price"><span class="currency">$</span>[PRICE]</div>
       <div class="price-note">[per month / per session / first 4 weeks free]</div>
       <ul class="price-feats">
         5-7 <li>[feature line]</li>
       </ul>
       <a href="#contact" class="price-cta">Start Trial</a>
     </div>

9. <section class="section testimonials" id="reviews">
   <div class="container">
     .eyebrow style="color: var(--neon);" "Verified members"
     <h2 class="section-title" style="color: #fff;"> 2-line headline
     .test-grid with EXACTLY 4 .test-card children. Each:
     <div class="test-card">
       <p class="test-quote">"[3-4 sentence quote citing specific lifts/measurements/timeline]"</p>
       <div class="test-foot">
         <div class="test-author">
           <div class="test-avatar">[INITIALS]</div>
           <div>
             <div class="test-name">[First L.]</div>
             <div class="test-meta">[Member [N] yrs · [Profession]]</div>
           </div>
         </div>
         <div class="test-result">[+150 LBS / -42 LBS / DEADLIFT 500]</div>
       </div>
     </div>

10. <section class="cta" id="contact">
    <div class="container">
      <div class="cta-grid">
        LEFT: <div>
          .eyebrow style="color: var(--ink);" "Free trial week"
          <h2>[2-line headline like "Walk in.<br/>Lift heavy."]</h2>
          <p>[2-line copy on the trial: full week, all classes, full equipment, no card.]</p>
        </div>
        RIGHT: <form class="cta-form" data-nn-form>
          Hidden honeypot first: <div class="sr-only" aria-hidden="true" style="position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);border:0;"><label>Website<input type="text" name="company_website" tabindex="-1" autocomplete="off" /></label></div>
          <h3>Free Trial Week</h3>
          <p class="sub">No card. No commitment. 7 days, all access.</p>
          .form-row-2 with first name (required, type=text) + last name (required, type=text)
          .form-row with email (required, type=email, name=email)
          .form-row with mobile (required, type=tel, name=phone)
          .form-row with select "Goal" — 6 options (Strength, Fat loss, Hybrid, Athletic performance, Compete, Other)
          .form-row with textarea "Anything else?" (name=message)
          <button type="submit" class="form-submit">Claim My Trial Week</button>
          <p data-nn-form-status style="margin-top:0.6rem;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);"></p>
        </form>

11. <footer>
    <div class="container">
      <div class="footer-grid"> 4 columns: brand description, Train (links), Schedule (days), Contact (phone/email/address).
      <div class="footer-bottom"> left: copyright · right: tagline like "BUILT FOR LIFTERS · OPEN 5AM-11PM"

CONTENT RULES (System D):
- Tone: serious, performance-driven, no fluff. Real numbers — squat PRs, deadlift maxes, weeks to results, coach competition records.
- All class names must be specific (Power Hour, Strongman 101, Conjugate Lower, Open Gym, Glute Hypertrophy) — not generic ("Workout", "HIIT").
- All testimonials cite a measurable result.
- Headlines in Oswald, body in Inter, mono labels in JetBrains Mono.
- The skewed elements (brand-mark, nav-cta, btn-neon, test-avatar) MUST keep the inner <span> wrapper that un-skews the content.

DO NOT:
- Use Tailwind utility classes
- Add Lucide icons via CDN
- Replace any of the locked CSS
- Use any image not listed above
- Add JS animations beyond the form handler and the ticker (which is CSS-only)`;
}

// =====================================================================
// SYSTEM E — Plumbing Dispatch
// Reference: /public/samples/plumbing.html (Ironside Plumbing)
// =====================================================================

function systemECss(palette: DesignSystemPalette): string {
  const navy = palette.primary;
  const navyDeep = darken(palette.primary, 0.4);
  const safety = palette.accent;
  return `:root {
  --navy: ${navy};
  --navy-deep: ${navyDeep};
  --steel: #1d3557;
  --signal: #1d8cf8;
  --signal-bright: #2bb1ff;
  --safety: ${safety};
  --emergency: #e63946;
  --paper: #f6f7fb;
  --paper-warm: #eef1f7;
  --line: #d6dbe6;
  --ink: #0e1a2b;
  --muted: #5a6878;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: 'Inter', system-ui, sans-serif; color: var(--ink); background: var(--paper); line-height: 1.55; -webkit-font-smoothing: antialiased; }
.container { max-width: 1280px; margin: 0 auto; padding: 0 28px; }
.mono { font-family: 'JetBrains Mono', monospace; font-weight: 500; letter-spacing: 0.04em; }
.emergency-bar { background: var(--emergency); color: #fff; font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; padding: 9px 0; }
.emergency-bar .row { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
.emergency-bar .pulse { width: 8px; height: 8px; border-radius: 50%; background: #fff; animation: pulse 1.6s infinite ease-in-out; display: inline-block; margin-right: 8px; }
@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.4); } }
.emergency-bar a { color: #fff; text-decoration: none; font-weight: 700; }
nav.main { background: #fff; border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 50; }
nav.main .row { display: flex; align-items: center; justify-content: space-between; padding: 16px 0; }
.brand { display: flex; align-items: center; gap: 12px; text-decoration: none; color: var(--ink); }
.brand-mark { width: 42px; height: 42px; background: var(--navy); border-radius: 10px; display: grid; place-items: center; }
.brand-name { font-family: 'Archivo', sans-serif; font-weight: 900; font-size: 19px; letter-spacing: -0.01em; line-height: 1; }
.brand-sub { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted); letter-spacing: 0.14em; text-transform: uppercase; margin-top: 4px; }
.nav-links { display: flex; gap: 28px; align-items: center; }
.nav-links a { color: var(--ink); text-decoration: none; font-weight: 600; font-size: 14px; }
.nav-cta { display: flex; gap: 12px; align-items: center; }
.btn-call { background: var(--navy); color: #fff; padding: 12px 22px; border-radius: 6px; font-weight: 700; text-decoration: none; font-size: 14px; display: inline-flex; align-items: center; gap: 8px; }
.btn-call:hover { background: var(--navy-deep); }
.hero { background: linear-gradient(135deg, ${navy}eb 0%, ${navyDeep}f5 100%); color: #fff; padding: 80px 0 100px; position: relative; overflow: hidden; }
.hero::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, var(--signal) 0%, var(--safety) 50%, var(--emergency) 100%); }
.hero-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 64px; align-items: center; }
.hero-eyebrow { display: inline-flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18); padding: 8px 16px; border-radius: 999px; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 24px; }
.live-dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 0 0 rgba(74,222,128,0.6); animation: livePulse 2s infinite; }
@keyframes livePulse { 0% { box-shadow: 0 0 0 0 rgba(74,222,128,0.6); } 70% { box-shadow: 0 0 0 12px rgba(74,222,128,0); } 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0); } }
h1.hero-title { font-family: 'Archivo', sans-serif; font-weight: 900; font-size: clamp(42px, 6vw, 76px); line-height: 1.0; letter-spacing: -0.025em; margin: 0 0 24px; }
h1.hero-title .tag { color: var(--signal-bright); }
.hero-lead { font-size: 18px; line-height: 1.6; color: rgba(255,255,255,0.85); max-width: 540px; margin: 0 0 36px; }
.hero-actions { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; margin-bottom: 40px; }
.btn-primary { background: var(--safety); color: var(--navy-deep); padding: 18px 32px; border-radius: 8px; font-weight: 800; text-decoration: none; font-size: 16px; letter-spacing: 0.01em; display: inline-flex; align-items: center; gap: 10px; }
.btn-primary:hover { filter: brightness(1.08); }
.btn-ghost { color: #fff; padding: 18px 28px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 15px; border: 1px solid rgba(255,255,255,0.25); }
.btn-ghost:hover { background: rgba(255,255,255,0.06); }
.hero-trust { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; padding-top: 32px; border-top: 1px solid rgba(255,255,255,0.1); }
.hero-trust .badge .num { font-family: 'Archivo', sans-serif; font-weight: 800; font-size: 28px; color: var(--safety); line-height: 1; }
.hero-trust .badge .lab { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.7); margin-top: 6px; }
.status-card { background: #fff; color: var(--ink); border-radius: 16px; padding: 32px; box-shadow: 0 24px 60px rgba(0,0,0,0.4); }
.status-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 18px; border-bottom: 1px solid var(--line); margin-bottom: 20px; }
.status-title { font-family: 'Archivo', sans-serif; font-weight: 800; font-size: 18px; text-transform: uppercase; letter-spacing: 0.04em; }
.status-pill { background: #d4f5d4; color: #166534; padding: 6px 12px; border-radius: 999px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; display: inline-flex; align-items: center; gap: 6px; }
.status-pill::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #16a34a; }
.crew-list { display: flex; flex-direction: column; gap: 14px; margin-bottom: 20px; }
.crew-row { display: flex; align-items: center; gap: 14px; padding: 14px; background: var(--paper-warm); border-radius: 10px; }
.crew-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--signal), var(--navy)); color: #fff; font-weight: 700; font-size: 14px; display: grid; place-items: center; font-family: 'Archivo', sans-serif; }
.crew-info { flex: 1; }
.crew-name { font-weight: 700; font-size: 14px; }
.crew-eta { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted); }
.crew-status { font-family: 'JetBrains Mono', monospace; font-size: 10px; padding: 4px 8px; border-radius: 4px; font-weight: 600; }
.crew-status.dispatch { background: #fef3c7; color: #92400e; }
.crew-status.en-route { background: #dbeafe; color: #1e40af; }
.crew-status.available { background: #d4f5d4; color: #166534; }
.status-cta { display: flex; align-items: center; justify-content: space-between; background: var(--navy); color: #fff; padding: 16px 18px; border-radius: 10px; text-decoration: none; }
.status-cta .label { font-size: 13px; }
.status-cta .num { font-family: 'Archivo', sans-serif; font-weight: 800; font-size: 18px; }
.section { padding: 90px 0; }
.section-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--signal); margin-bottom: 14px; display: inline-flex; align-items: center; gap: 10px; }
.section-eyebrow::before { content: ''; width: 28px; height: 2px; background: var(--signal); }
h2.section-title { font-family: 'Archivo', sans-serif; font-weight: 900; font-size: clamp(34px, 4.5vw, 56px); line-height: 1.05; letter-spacing: -0.02em; margin: 0 0 20px; }
.section-lead { font-size: 17px; color: var(--muted); max-width: 620px; }
.services-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 56px; }
.service-card { background: #fff; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s; }
.service-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,0.12); }
.service-card .img { height: 200px; background-size: cover; background-position: center; position: relative; }
.service-card .badge { position: absolute; top: 14px; left: 14px; background: rgba(255,255,255,0.95); color: var(--navy); padding: 5px 10px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.service-card .body { padding: 24px; flex: 1; display: flex; flex-direction: column; }
.service-card h3 { font-family: 'Archivo', sans-serif; font-weight: 800; font-size: 20px; letter-spacing: -0.01em; margin: 0 0 10px; }
.service-card p { font-size: 14px; color: var(--muted); line-height: 1.6; margin: 0 0 18px; flex: 1; }
.service-card .price-row { display: flex; align-items: baseline; justify-content: space-between; padding-top: 18px; border-top: 1px solid var(--line); }
.service-card .price-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.service-card .price-num { font-family: 'Archivo', sans-serif; font-weight: 800; font-size: 22px; color: var(--navy); }
.service-card .price-num small { font-size: 12px; font-weight: 600; color: var(--muted); }
.trust-strip { background: var(--navy); color: #fff; padding: 60px 0; }
.trust-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; }
.trust-stat .num { font-family: 'Archivo', sans-serif; font-weight: 900; font-size: 56px; color: var(--safety); line-height: 1; letter-spacing: -0.02em; }
.trust-stat .lab { font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.7); margin-top: 10px; }
.guarantee { background: var(--paper-warm); }
.guarantee-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-top: 56px; }
.guarantee-card { background: #fff; padding: 32px 28px; border-radius: 14px; position: relative; border-top: 4px solid var(--signal); }
.guarantee-card .num { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--signal); font-weight: 700; letter-spacing: 0.16em; margin-bottom: 16px; }
.guarantee-card .icon { width: 56px; height: 56px; background: var(--paper-warm); border-radius: 14px; display: grid; place-items: center; margin-bottom: 18px; }
.guarantee-card h3 { font-family: 'Archivo', sans-serif; font-weight: 800; font-size: 18px; margin: 0 0 12px; }
.guarantee-card p { font-size: 14px; color: var(--muted); line-height: 1.6; margin: 0; }
.pricing-table { background: #fff; border-radius: 16px; overflow: hidden; margin-top: 48px; border: 1px solid var(--line); }
.pricing-row { display: grid; grid-template-columns: 1fr auto auto; gap: 24px; padding: 22px 28px; align-items: center; border-bottom: 1px solid var(--line); }
.pricing-row:last-child { border-bottom: none; }
.pricing-row.head { background: var(--navy); color: #fff; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; }
.pricing-row .name { font-weight: 700; font-size: 15px; }
.pricing-row .desc { font-size: 13px; color: var(--muted); margin-top: 4px; }
.pricing-row .time { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--muted); background: var(--paper-warm); padding: 6px 10px; border-radius: 4px; text-align: center; min-width: 80px; }
.pricing-row .cost { font-family: 'Archivo', sans-serif; font-weight: 800; font-size: 18px; color: var(--navy); text-align: right; min-width: 100px; }
.testimonials { background: var(--paper); }
.test-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 56px; }
.test-card { background: #fff; padding: 32px; border-radius: 14px; border: 1px solid var(--line); display: flex; flex-direction: column; }
.test-stars { color: var(--safety); font-size: 16px; letter-spacing: 2px; margin-bottom: 16px; }
.test-quote { font-size: 16px; line-height: 1.65; color: var(--ink); margin: 0 0 24px; flex: 1; font-weight: 500; }
.test-author { display: flex; align-items: center; gap: 12px; padding-top: 20px; border-top: 1px solid var(--line); }
.test-avatar { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, var(--signal), var(--navy)); color: #fff; font-weight: 700; font-size: 15px; display: grid; place-items: center; font-family: 'Archivo', sans-serif; }
.test-name { font-weight: 700; font-size: 14px; }
.test-loc { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted); }
.test-source { margin-left: auto; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; }
.cta-section { background: linear-gradient(135deg, ${navy} 0%, ${navyDeep} 100%); color: #fff; }
.cta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: start; }
.cta-section h2 { font-family: 'Archivo', sans-serif; font-weight: 900; font-size: clamp(34px, 4.5vw, 56px); line-height: 1.05; letter-spacing: -0.02em; margin: 0 0 24px; }
.cta-list { list-style: none; padding: 0; margin: 32px 0 0; display: flex; flex-direction: column; gap: 14px; }
.cta-list li { display: flex; align-items: center; gap: 12px; font-size: 15px; color: rgba(255,255,255,0.88); }
.cta-list .check { width: 26px; height: 26px; border-radius: 50%; background: var(--safety); color: var(--navy-deep); font-weight: 800; font-size: 14px; display: grid; place-items: center; flex-shrink: 0; }
.form-card { background: #fff; color: var(--ink); padding: 36px; border-radius: 16px; }
.form-card h3 { font-family: 'Archivo', sans-serif; font-weight: 800; font-size: 22px; margin: 0 0 8px; }
.form-card .sub { font-size: 14px; color: var(--muted); margin: 0 0 24px; }
.form-row { margin-bottom: 16px; }
.form-row label { display: block; font-size: 12px; font-weight: 600; color: var(--ink); margin-bottom: 6px; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.08em; text-transform: uppercase; }
.form-row input, .form-row select, .form-row textarea { width: 100%; padding: 13px 14px; border: 1px solid var(--line); border-radius: 8px; font-size: 14px; font-family: inherit; background: var(--paper-warm); color: var(--ink); }
.form-row textarea { min-height: 90px; resize: vertical; }
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.form-submit { width: 100%; background: var(--safety); color: var(--navy-deep); padding: 16px; border: none; border-radius: 8px; font-weight: 800; font-size: 15px; cursor: pointer; font-family: 'Archivo', sans-serif; letter-spacing: 0.02em; text-transform: uppercase; margin-top: 6px; }
.form-foot { text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted); margin-top: 14px; letter-spacing: 0.08em; }
footer { background: var(--navy-deep); color: rgba(255,255,255,0.7); padding: 60px 0 32px; }
.footer-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 40px; padding-bottom: 40px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.footer-grid h4 { font-family: 'Archivo', sans-serif; font-weight: 800; font-size: 13px; color: #fff; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 0.08em; }
.footer-grid a { display: block; color: rgba(255,255,255,0.7); text-decoration: none; font-size: 14px; padding: 4px 0; }
.footer-grid a:hover { color: var(--safety); }
.footer-bottom { padding-top: 24px; display: flex; align-items: center; justify-content: space-between; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.06em; }
@media (max-width: 980px) {
  .hero-grid, .cta-grid { grid-template-columns: 1fr; gap: 40px; }
  .services-grid, .guarantee-grid, .test-grid { grid-template-columns: 1fr; }
  .hero-trust, .trust-grid { grid-template-columns: repeat(2, 1fr); }
  .footer-grid { grid-template-columns: 1fr 1fr; }
  .pricing-row { grid-template-columns: 1fr auto; }
  .pricing-row .time { display: none; }
}`;
}

function systemEFontsHead(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet" />`;
}

function buildSystemEBlock(
  palette: DesignSystemPalette,
  images: DesignSystemImages,
): string {
  const servicesList = images.services
    .map((s, i) => `    ${i + 1}) "${s.name}" (depicts: ${s.keyword}) → ${s.url}`)
    .join("\n");

  return `LOCKED DESIGN SYSTEM — SYSTEM E (TRADES DISPATCH)

This niche (${palette.label}) uses System E — a 24/7 dispatch dashboard layout with a live-crew widget. The design is FIXED. Do not invent your own layout, palette, or typography. Do not use Tailwind. The CSS below is complete — you only fill content.

REQUIRED <head> ELEMENTS:
1. <meta charset> + <meta viewport> + <title>
2. Google Fonts (use this block VERBATIM):
${systemEFontsHead()}
3. A single <style> block containing the FULL CSS BELOW VERBATIM:

<style>
${systemECss(palette)}
</style>

REQUIRED PAGE STRUCTURE (build the <body> in this exact order, using these exact class names):

1. <div class="emergency-bar">
   <div class="container row">
     - Left: <span class="pulse"></span> 24/7 EMERGENCY · CREW AVAILABLE NOW · AVG ARRIVAL [N] MIN
     - Right: CALL <a href="tel:...">phone</a>

2. <nav class="main">
   <div class="container row">
     - <a class="brand">: .brand-mark with niche-specific inline SVG (a wrench/pipe/tool — match the niche logo concept), then div with .brand-name (UPPERCASE business) + .brand-sub ("EST. YYYY · LIC #...")
     - .nav-links: 5 anchors (Services, Pricing, Guarantee, Reviews, Contact)
     - .nav-cta: <a href="tel:..." class="btn-call"> with phone-icon SVG + phone number text

3. <section class="hero">
   <div class="container">
     <div class="hero-grid">
       LEFT: <div>
         .hero-eyebrow: <span class="live-dot"></span> + service-area cities (e.g., "PHOENIX · TEMPE · MESA")
         <h1 class="hero-title"> 1-line headline with <span class="tag"> on the second part. Pattern: "Burst pipe? <span class='tag'>We're already on the way.</span>"
         <p class="hero-lead"> 1-2 sentences citing concrete: arrival time, license, pricing model.
         .hero-actions: <a class="btn-primary" href="tel:..."> with phone-icon SVG + "Call dispatch now" + <a class="btn-ghost" href="#contact">Schedule online</a>
         .hero-trust: 4 .badge children, each <div class="badge"><div class="num">[NUM]<small>...</small></div><div class="lab">[CAPS]</div></div>
       RIGHT: <div class="status-card">
         .status-header: .status-title "Live Dispatch" + .status-pill "[N] crews available"
         .crew-list with EXACTLY 3 .crew-row entries. Each:
           <div class="crew-row">
             <div class="crew-avatar">[INITIALS]</div>
             <div class="crew-info">
               <div class="crew-name">[First L.] · [Specialty]</div>
               <div class="crew-eta">Truck [NN] · [N] min from you</div>
             </div>
             <div class="crew-status [available|en-route|dispatch]">[CAPS LABEL]</div>
           </div>
         <a href="tel:..." class="status-cta">
           <span class="label">Dispatch the closest crew</span>
           <span class="num">[PHONE]</span>
         </a>

4. <section class="section" id="services">
   <div class="container">
     .section-eyebrow "What we fix"
     <h2 class="section-title"> 2-line headline
     .section-lead with credibility line
     .services-grid with EXACTLY 6 .service-card children. Each:
     <div class="service-card">
       <div class="img" style="background-image: url('[SERVICE_URL]')">
         <div class="badge">[24/7 Emergency / Same Day / Warranty Included / Tankless Certified / etc.]</div>
       </div>
       <div class="body">
         <h3>[Service Name]</h3>
         <p>[2-line specific description]</p>
         <div class="price-row">
           <div class="price-label">[Starting at / Install from / Quote in]</div>
           <div class="price-num">$[NUM]<small> [unit]</small></div>
         </div>
       </div>
     </div>
     Service names + photos must come from this list:
${servicesList}

5. <section class="trust-strip">
   <div class="container">
     <div class="trust-grid">
       4 .trust-stat children. Each: <div class="num">[NUM]</div><div class="lab">[CAPS]</div>
       Use specifics: years in [CITY], calls completed, BBB rating, $ liability insured.

6. <section class="section" id="pricing">
   <div class="container">
     .section-eyebrow "What it costs"
     <h2 class="section-title"> 2-line headline like "Flat-rate pricing.<br/>In writing. Before we start."
     .section-lead with no-hourly-meter promise
     .pricing-table:
       First .pricing-row.head with 3 cells: "Service", "Avg Time", "Price"
       Then EXACTLY 7 .pricing-row entries. Each:
         <div class="pricing-row">
           <div><div class="name">[Service]</div><div class="desc">[Short description with parts/scope]</div></div>
           <div class="time">[Time]</div>
           <div class="cost">[$NUM or "Free" or "Quote"]</div>
         </div>
       First row should be a $0 diagnostic visit. Use specific concrete dollar amounts.

7. <section class="section guarantee" id="guarantee">
   <div class="container">
     .section-eyebrow "The [BUSINESS] Guarantee"
     <h2 class="section-title"> 2-line headline
     .section-lead with workmanship warranty length
     .guarantee-grid with EXACTLY 4 .guarantee-card children. Each:
       <div class="guarantee-card">
         <div class="num">0[N]</div>
         <div class="icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--signal)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><!-- topical icon: shield, clock, dollar, check --></svg></div>
         <h3>[Pillar name like "Licensed & insured" / "On-time guarantee" / "No surprise pricing" / "[N]-year workmanship"]</h3>
         <p>[2-line specific commitment with numbers/license]</p>

8. <section class="section testimonials" id="reviews">
   <div class="container">
     .section-eyebrow "Verified reviews"
     <h2 class="section-title"> 2-line headline citing review count and platforms
     .test-grid with EXACTLY 3 .test-card children. Each:
       <div class="test-card">
         <div class="test-stars">★★★★★</div>
         <p class="test-quote">"[3-4 sentences citing specific dollar amount, timing, crew member name, outcome]"</p>
         <div class="test-author">
           <div class="test-avatar">[INITIALS]</div>
           <div>
             <div class="test-name">[First L.]</div>
             <div class="test-loc">[Neighborhood, ST]</div>
           </div>
           <div class="test-source">[Google / Yelp / Nextdoor]</div>
         </div>
       </div>

9. <section class="section cta-section" id="contact">
   <div class="container">
     <div class="cta-grid">
       LEFT: <div>
         .section-eyebrow style="color: var(--safety);" "Get help now"
         <h2>[2-line "Two ways to reach us."-style headline]</h2>
         <p style="color: rgba(255,255,255,0.75); font-size: 17px; line-height: 1.6;">[no call centers, real techs copy]</p>
         <ul class="cta-list">
           5 <li><span class="check">✓</span> [trust line]</li> entries — free quote, same-day, no surcharges, discounts, financing
       RIGHT: <form class="form-card" data-nn-form>
         Hidden honeypot first: <div class="sr-only" aria-hidden="true" style="position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);border:0;"><label>Website<input type="text" name="company_website" tabindex="-1" autocomplete="off" /></label></div>
         <h3>Schedule a service call</h3>
         <p class="sub">Same-day slots available. We'll call to confirm within 10 minutes during business hours.</p>
         .form-row-2 with first/last name (required, type=text)
         .form-row email (type=email, name=email)
         .form-row phone (required, type=tel, name=phone)
         .form-row select "Service needed" — 7 niche-specific options (Emergency burst, Drain clog, Water heater, Toilet/fixture, Sewer line, Re-pipe, Other)
         .form-row textarea "Quick description" (name=message, placeholder mentions "Where in the house? When did it start?")
         <button type="submit" class="form-submit">Request service call</button>
         <div class="form-foot">YOUR INFO STAYS WITH US — NO SPAM, NO RESALE</div>
         <p data-nn-form-status style="margin-top:0.6rem;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);text-align:center;"></p>

10. <footer>
    <div class="container">
      <div class="footer-grid"> 4 columns: brand description, Services links, Service area, Contact (phone/email/address).
      <div class="footer-bottom"> left: copyright + license · right: tagline like "BUILT IN [CITY]"

CONTENT RULES (System E):
- Tone: blue-collar premium, dispatch operations vibe. Real crew names ("Marcus R. · Master Plumber"), real arrival times, real flat-rate prices.
- Every dollar amount must be specific (not "competitive pricing", but "$189 flat", "$1,840", "0% financing on jobs over $1,500").
- Testimonials must name a crew member or a specific dollar outcome.
- Archivo for headlines, Inter for body, JetBrains Mono for everything mono (eyebrows, prices, labels).

DO NOT:
- Use Tailwind utility classes
- Add Lucide CDN
- Replace any of the locked CSS
- Use any image not listed above
- Add JS animations beyond the form handler`;
}

// =====================================================================
// SYSTEM F — Electrician Schematic
// Reference: /public/samples/electricians.html (Voltline Electric)
// =====================================================================

function systemFCss(palette: DesignSystemPalette): string {
  const bg = palette.primary;
  const bgDeep = darken(palette.primary, 0.35);
  const volt = palette.accent;
  return `:root {
  --bg: ${bg};
  --bg-deep: ${bgDeep};
  --panel: #16181d;
  --panel-2: #1d2027;
  --line: #2a2e37;
  --line-soft: #232730;
  --volt: ${volt};
  --volt-bright: ${volt};
  --hot: #ff5b3b;
  --safe: #4ade80;
  --text: #e7eaf0;
  --muted: #8a93a3;
  --paper: #f4f5f7;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: 'Inter', system-ui, sans-serif; color: var(--text); background: var(--bg); line-height: 1.55; -webkit-font-smoothing: antialiased; }
.container { max-width: 1320px; margin: 0 auto; padding: 0 32px; }
.display { font-family: 'Space Grotesk', sans-serif; }
.mono { font-family: 'JetBrains Mono', monospace; }
.panel-bar { background: var(--bg-deep); border-bottom: 1px solid var(--line); padding: 9px 0; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
.panel-bar .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.panel-bar .breakers { display: flex; gap: 16px; align-items: center; }
.panel-bar .breaker { display: inline-flex; align-items: center; gap: 6px; }
.panel-bar .led { width: 7px; height: 7px; border-radius: 50%; background: var(--safe); box-shadow: 0 0 8px var(--safe); }
.panel-bar .led.on { background: var(--volt); box-shadow: 0 0 8px var(--volt); animation: blinkLed 2s infinite; }
@keyframes blinkLed { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
.panel-bar a { color: var(--volt); text-decoration: none; font-weight: 700; }
nav.main { background: var(--bg); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 50; }
nav.main .row { display: flex; align-items: center; justify-content: space-between; padding: 18px 0; }
.brand { display: flex; align-items: center; gap: 14px; text-decoration: none; color: var(--text); }
.brand-mark { width: 44px; height: 44px; background: var(--volt); border-radius: 4px; display: grid; place-items: center; position: relative; box-shadow: 0 0 20px rgba(240,219,79,0.35); }
.brand-name { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 19px; letter-spacing: -0.01em; line-height: 1; }
.brand-sub { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted); letter-spacing: 0.16em; text-transform: uppercase; margin-top: 4px; }
.nav-links { display: flex; gap: 28px; align-items: center; }
.nav-links a { color: var(--text); text-decoration: none; font-weight: 500; font-size: 14px; }
.nav-links a:hover { color: var(--volt); }
.nav-cta { display: inline-flex; align-items: center; gap: 10px; background: var(--volt); color: var(--bg-deep); padding: 12px 22px; border-radius: 4px; font-weight: 700; text-decoration: none; font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; }
.hero { position: relative; overflow: hidden; padding: 100px 0 80px; background: radial-gradient(ellipse at 20% 30%, rgba(240,219,79,0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(240,219,79,0.04) 0%, transparent 50%), var(--bg); }
.hero::before { content: ''; position: absolute; inset: 0; background-image: linear-gradient(var(--line-soft) 1px, transparent 1px), linear-gradient(90deg, var(--line-soft) 1px, transparent 1px); background-size: 56px 56px; background-position: -1px -1px; opacity: 0.5; mask-image: radial-gradient(ellipse at center, black 50%, transparent 80%); }
.hero .container { position: relative; z-index: 2; }
.hero-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 80px; align-items: center; }
.hero-eyebrow { display: inline-flex; align-items: center; gap: 12px; background: rgba(240,219,79,0.08); border: 1px solid rgba(240,219,79,0.25); padding: 8px 16px; border-radius: 999px; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--volt); margin-bottom: 28px; }
h1.hero-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: clamp(48px, 7vw, 92px); line-height: 1.0; letter-spacing: -0.02em; margin: 0 0 26px; }
h1.hero-title .volt-text { color: var(--volt); position: relative; }
h1.hero-title .volt-text::after { content: ''; position: absolute; bottom: 6px; left: 0; right: 0; height: 6px; background: rgba(240,219,79,0.2); z-index: -1; }
.hero-lead { font-size: 18px; line-height: 1.65; color: var(--muted); max-width: 540px; margin: 0 0 40px; }
.hero-actions { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
.btn-primary { background: var(--volt); color: var(--bg-deep); padding: 16px 30px; border-radius: 4px; font-weight: 700; text-decoration: none; font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; display: inline-flex; align-items: center; gap: 10px; }
.btn-primary:hover { box-shadow: 0 0 24px rgba(240,219,79,0.4); }
.btn-outline { color: var(--text); padding: 16px 28px; border-radius: 4px; font-weight: 600; text-decoration: none; font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; border: 1px solid var(--line); }
.btn-outline:hover { border-color: var(--volt); color: var(--volt); }
.schematic { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; position: relative; }
.schematic-header { background: var(--panel-2); padding: 14px 24px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
.schematic-header .dots { display: flex; gap: 6px; }
.schematic-header .dots span { width: 9px; height: 9px; border-radius: 50%; display: block; }
.schematic-header .dots span:nth-child(1) { background: var(--hot); }
.schematic-header .dots span:nth-child(2) { background: var(--volt); }
.schematic-header .dots span:nth-child(3) { background: var(--safe); }
.schematic-body { padding: 28px; }
.schematic-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px dashed var(--line); }
.schematic-row:last-child { border-bottom: none; }
.schematic-row .key { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--muted); letter-spacing: 0.06em; }
.schematic-row .val { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 17px; color: var(--text); }
.schematic-row .val.volt { color: var(--volt); }
.schematic-row .val.safe { color: var(--safe); }
.schematic-foot { padding: 18px 24px; background: var(--panel-2); border-top: 1px solid var(--line); font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; display: flex; align-items: center; justify-content: space-between; }
.schematic-foot a { color: var(--volt); text-decoration: none; font-weight: 700; }
.section { padding: 110px 0; }
.eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--volt); display: inline-flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.eyebrow::before { content: ''; width: 32px; height: 2px; background: var(--volt); }
h2.section-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: clamp(36px, 5vw, 64px); line-height: 1.05; letter-spacing: -0.02em; margin: 0 0 22px; color: var(--text); }
.section-lead { font-size: 17px; color: var(--muted); max-width: 640px; line-height: 1.65; }
.panel-upgrade { background: var(--bg-deep); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.pu-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 80px; align-items: center; }
.pu-img { aspect-ratio: 4 / 5; background-size: cover; background-position: center; border-radius: 8px; position: relative; border: 1px solid var(--line); }
.pu-tag { position: absolute; bottom: 24px; left: 24px; background: var(--volt); color: var(--bg-deep); padding: 8px 16px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
.pu-options { list-style: none; padding: 0; margin: 36px 0 0; counter-reset: opt; }
.pu-options li { counter-increment: opt; padding: 22px 0; border-bottom: 1px solid var(--line); display: grid; grid-template-columns: auto 1fr auto; gap: 24px; align-items: center; }
.pu-options li::before { content: counter(opt, decimal-leading-zero); font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--volt); letter-spacing: 0.1em; }
.pu-options h4 { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 19px; margin: 0 0 4px; color: var(--text); }
.pu-options .meta { font-size: 13px; color: var(--muted); }
.pu-options .price { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 22px; color: var(--volt); }
.services-bg { background: var(--bg); }
.services-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 56px; }
.service-card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 36px 32px; position: relative; overflow: hidden; transition: border-color 0.2s, transform 0.2s; }
.service-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--volt); opacity: 0.6; transform: scaleX(0); transform-origin: left; transition: transform 0.3s; }
.service-card:hover { border-color: rgba(240,219,79,0.4); transform: translateY(-3px); }
.service-card:hover::before { transform: scaleX(1); }
.service-card .code { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--volt); letter-spacing: 0.16em; margin-bottom: 22px; }
.service-card .icon { width: 56px; height: 56px; background: var(--bg-deep); border-radius: 8px; border: 1px solid var(--line); display: grid; place-items: center; margin-bottom: 22px; }
.service-card h3 { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 22px; margin: 0 0 12px; letter-spacing: -0.01em; }
.service-card p { font-size: 14px; color: var(--muted); line-height: 1.65; margin: 0 0 22px; }
.specs { display: flex; flex-direction: column; gap: 10px; padding-top: 22px; border-top: 1px solid var(--line-soft); }
.specs .spec { display: flex; justify-content: space-between; font-family: 'JetBrains Mono', monospace; font-size: 11px; }
.specs .spec .k { color: var(--muted); letter-spacing: 0.06em; }
.specs .spec .v { color: var(--text); font-weight: 600; }
.compliance { background: var(--panel); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 70px 0; }
.compliance-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 48px; align-items: center; }
.compliance-grid h3 { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 28px; line-height: 1.2; margin: 0; color: var(--text); }
.compliance-grid h3 .accent { color: var(--volt); }
.comp-stat .num { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 48px; line-height: 1; color: var(--volt); }
.comp-stat .lab { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin-top: 10px; }
.process { background: var(--bg-deep); }
.proc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; margin-top: 56px; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.proc-step { padding: 36px 32px; border-right: 1px solid var(--line); background: var(--panel); position: relative; }
.proc-step:last-child { border-right: none; }
.proc-step .step-num { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--volt); letter-spacing: 0.16em; margin-bottom: 18px; }
.proc-step .step-icon { width: 44px; height: 44px; background: var(--bg-deep); border-radius: 6px; display: grid; place-items: center; margin-bottom: 18px; border: 1px solid var(--line); }
.proc-step h4 { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 18px; margin: 0 0 10px; }
.proc-step p { font-size: 13px; color: var(--muted); line-height: 1.6; margin: 0; }
.testimonials { background: var(--bg); }
.test-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 56px; }
.test-card { background: var(--panel); padding: 32px; border: 1px solid var(--line); border-radius: 8px; border-left: 3px solid var(--volt); }
.test-stars { color: var(--volt); font-size: 14px; letter-spacing: 3px; margin-bottom: 18px; }
.test-quote { font-size: 15px; line-height: 1.7; color: var(--text); margin: 0 0 24px; }
.test-foot { padding-top: 18px; border-top: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; }
.test-name { font-weight: 600; font-size: 14px; }
.test-meta { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted); }
.test-job { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--volt); letter-spacing: 0.12em; text-transform: uppercase; }
.cta { background: var(--bg-deep); position: relative; overflow: hidden; }
.cta::before { content: ''; position: absolute; inset: 0; background-image: linear-gradient(var(--line-soft) 1px, transparent 1px), linear-gradient(90deg, var(--line-soft) 1px, transparent 1px); background-size: 56px 56px; opacity: 0.4; }
.cta .container { position: relative; z-index: 2; }
.cta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: start; }
.cta-form { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 40px; }
.cta-form h3 { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 28px; margin: 0 0 8px; letter-spacing: -0.01em; }
.cta-form .sub { font-size: 14px; color: var(--muted); margin: 0 0 28px; }
.form-row { margin-bottom: 16px; }
.form-row label { display: block; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
.form-row input, .form-row select, .form-row textarea { width: 100%; padding: 14px; background: var(--bg-deep); color: var(--text); border: 1px solid var(--line); border-radius: 4px; font-size: 14px; font-family: inherit; }
.form-row input:focus, .form-row select:focus, .form-row textarea:focus { outline: none; border-color: var(--volt); }
.form-row textarea { min-height: 90px; resize: vertical; }
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-submit { width: 100%; background: var(--volt); color: var(--bg-deep); padding: 16px; border: none; border-radius: 4px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; cursor: pointer; margin-top: 6px; }
.form-submit:hover { box-shadow: 0 0 24px rgba(240,219,79,0.3); }
footer { background: var(--bg-deep); border-top: 1px solid var(--line); color: var(--muted); padding: 56px 0 24px; }
.footer-grid { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 40px; padding-bottom: 36px; border-bottom: 1px solid var(--line); }
.footer-grid h4 { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 13px; color: var(--text); text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 16px; }
.footer-grid a { display: block; color: var(--muted); text-decoration: none; font-size: 14px; padding: 4px 0; }
.footer-grid a:hover { color: var(--volt); }
.footer-bottom { padding-top: 22px; display: flex; align-items: center; justify-content: space-between; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.08em; }
@media (max-width: 980px) {
  .hero-grid, .pu-grid, .compliance-grid, .cta-grid { grid-template-columns: 1fr; gap: 40px; }
  .services-grid, .test-grid { grid-template-columns: 1fr; }
  .proc-grid { grid-template-columns: 1fr; }
  .proc-step { border-right: none; border-bottom: 1px solid var(--line); }
  .footer-grid { grid-template-columns: 1fr 1fr; }
}`;
}

function systemFFontsHead(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />`;
}

function buildSystemFBlock(
  palette: DesignSystemPalette,
  images: DesignSystemImages,
): string {
  const servicesList = images.services
    .map((s, i) => `    ${i + 1}) "${s.name}" (depicts: ${s.keyword}) → ${s.url}`)
    .join("\n");
  const portfolioList = images.portfolio.map((u, i) => `    ${i + 1}) ${u}`).join("\n");

  return `LOCKED DESIGN SYSTEM — SYSTEM F (TRADES SCHEMATIC)

This niche (${palette.label}) uses System F — a dark, schematic / circuit-board layout for high-skill trades. The design is FIXED. Do not invent your own layout, palette, or typography. Do not use Tailwind. The CSS below is complete — you only fill content.

REQUIRED <head> ELEMENTS:
1. <meta charset> + <meta viewport> + <title>
2. Google Fonts (use this block VERBATIM):
${systemFFontsHead()}
3. A single <style> block containing the FULL CSS BELOW VERBATIM:

<style>
${systemFCss(palette)}
</style>

REQUIRED PAGE STRUCTURE (build the <body> in this exact order, using these exact class names):

1. <div class="panel-bar">
   <div class="container row">
     - Left: .breakers with 3 .breaker spans, each <span class="breaker"><span class="led [on]"></span>[STATUS LABEL]</span> — like "DISPATCH ONLINE", "[N] CREWS DEPLOYED", "PERMIT ACTIVE". Mark the dispatch one .led.on (pulsing).
     - Right: <span>24/7 EMERGENCY · CALL <a href="tel:...">[PHONE]</a></span>

2. <nav class="main">
   <div class="container row">
     - <a class="brand">: .brand-mark with niche-specific inline SVG (a lightning bolt, plug, or breaker — match the niche), then div with .brand-name (UPPERCASE) + .brand-sub ("[STATE LIC #] · MASTER ELECTRICIAN · [CITY]")
     - .nav-links: 5 anchors (Services, Panel Upgrade, Process, Reviews, Contact)
     - <a class="nav-cta" href="tel:...">Get Free Estimate</a>

3. <section class="hero">
   <div class="container">
     <div class="hero-grid">
       LEFT: <div>
         .hero-eyebrow: <svg class="bolt" .../> + "LICENSED · BONDED · NEC 2023 COMPLIANT"
         <h1 class="hero-title"> 2-line headline with <span class="volt-text"> highlight on key word. Pattern: "Power your home. <span class='volt-text'>Properly.</span>"
         <p class="hero-lead"> 1-2 sentences with concrete proof — years, panel upgrades, code certifications.
         .hero-actions: <a class="btn-primary"> + <a class="btn-outline">
       RIGHT: <div class="schematic">
         .schematic-header: <span>LIVE DISPATCH</span> + .dots (3 status circles)
         .schematic-body: 4 .schematic-row entries. Each:
           <div class="schematic-row"><span class="key">[CAPS KEY]</span><span class="val [volt|safe]">[VALUE]</span></div>
           Use specifics: CREWS DEPLOYED 4/6, EMERGENCY ETA 42 MIN, PERMIT RATE 100%, NEC INSPECTIONS PASSED 312/312.
         .schematic-foot: <span>SYS://VOLTLINE.STATUS.OK</span> + <a href="tel:...">DISPATCH →</a>

4. <section class="section panel-upgrade" id="panel-upgrade">
   <div class="container">
     <div class="pu-grid">
       LEFT: <div class="pu-img" style="background-image: url('${images.hero}')">
         <div class="pu-tag">SIGNATURE SERVICE</div>
       </div>
       RIGHT: <div>
         .eyebrow "Panel Upgrades"
         <h2 class="section-title"> 2-line headline like "200-amp service.<br/>Same day, fully permitted."
         <p class="section-lead">[panel-upgrade copy with NEC compliance + permit pulled]</p>
         <ol class="pu-options">
           5 <li> entries — each with <h4>[Panel Tier name]</h4><div class="meta">[scope]</div> + <span class="price">$[NUM]</span>. Tiers from $1,200 sub-panel up to $3,400 whole-home upgrade.
         </ol>

5. <section class="section services-bg" id="services">
   <div class="container">
     .eyebrow "Services"
     <h2 class="section-title"> 2-line headline
     .section-lead with NEC code reference
     .services-grid with EXACTLY 6 .service-card children. Each:
     <div class="service-card">
       <div class="code">SVC // 0[N]</div>
       <div class="icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--volt)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><!-- topical icon --></svg></div>
       <h3>[Service Name]</h3>
       <p>[2-line specific description with code reference]</p>
       <div class="specs">
         3 <div class="spec"><span class="k">[KEY]</span><span class="v">[VAL]</span></div> entries — like AMPERAGE / WARRANTY / TIME ON SITE.
       </div>
     </div>
     Service names + photos must come from this list:
${servicesList}

6. <section class="compliance">
   <div class="container">
     <div class="compliance-grid">
       <h3>NEC 2023 compliant.<br/><span class="accent">[STATE]-licensed.</span> Always permitted.</h3>
       Then 3 .comp-stat children: <div class="num">[NUM]</div><div class="lab">[CAPS]</div>
       Use specifics: code inspections passed, years master licensed, $ liability insured.

7. <section class="section process">
   <div class="container">
     .eyebrow "Process"
     <h2 class="section-title" style="color: #fff;"> 2-line headline
     .section-lead "From walk-through to permit close-out, the same crew handles every step."
     .proc-grid with EXACTLY 4 .proc-step children. Each:
       <div class="proc-step">
         <div class="step-num">STEP 0[N]</div>
         <div class="step-icon"><svg ... stroke="var(--volt)" /></div>
         <h4>[Step name]</h4>
         <p>[2-line description specific to electrical work — load calc, permit pull, install + inspection, close-out]</p>

8. <section class="section testimonials" id="reviews">
   <div class="container">
     .eyebrow "Reviews"
     <h2 class="section-title" style="color: #fff;"> 2-line headline
     .test-grid with EXACTLY 3 .test-card children. Each:
       <div class="test-card">
         <div class="test-stars">★★★★★</div>
         <p class="test-quote">"[3-4 sentences citing specific job — panel size, dollar amount, NEC inspection passing, timeline]"</p>
         <div class="test-foot">
           <div>
             <div class="test-name">[First L.]</div>
             <div class="test-meta">[Neighborhood, ST]</div>
           </div>
           <div class="test-job">[100A SUB / EV CHARGER / WHOLE-HOME REWIRE]</div>
         </div>
       </div>

9. <section class="section cta" id="contact">
   <div class="container">
     <div class="cta-grid">
       LEFT: <div>
         .eyebrow "Get a free estimate"
         <h2 class="section-title" style="color: #fff;">[2-line headline like "Free load calc.<br/>Permit-ready quote."]</h2>
         <p class="section-lead">[real-tech copy: written quotes, code-compliant, no hidden fees]</p>
         A 3-stat strip showing: $0 estimate / 24 hr quote / 100% permit close-out — using inline divs styled with var(--volt) for the numbers.
       </div>
       RIGHT: <form class="cta-form" data-nn-form>
         Hidden honeypot first: <div class="sr-only" aria-hidden="true" style="position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);border:0;"><label>Website<input type="text" name="company_website" tabindex="-1" autocomplete="off" /></label></div>
         <h3>Free Estimate</h3>
         <p class="sub">Most quotes back within 24 business hours.</p>
         .form-row-2 with first/last name (required, type=text)
         .form-row email (type=email, name=email)
         .form-row phone (required, type=tel, name=phone)
         .form-row select "Job type" — 7 options (Panel upgrade, EV charger, Whole-home rewire, Outlet/lighting, Service repair, Generator/solar, Other)
         .form-row textarea "Property details" (name=message, placeholder mentions panel size, year built)
         <button type="submit" class="form-submit">Request Free Estimate</button>
         <p data-nn-form-status style="margin-top:0.6rem;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);"></p>

10. <footer>
    <div class="container">
      <div class="footer-grid"> 4 columns: brand description, Services links, Service area, Contact (phone/email/address).
      <div class="footer-bottom"> left: copyright + license · right: tagline like "POWERING [CITY] SINCE [YEAR]"

PORTFOLIO IMAGES available if needed:
${portfolioList}

CONTENT RULES (System F):
- Tone: precision-trade, code-compliant, technical confidence. NEC 2023 references, master-license callouts, amperage specs (100A, 200A, 400A), permit-pull language.
- Every job must reference real specifics — panel size, breaker count, EV charger amperage, generator KW.
- Testimonials cite NEC inspection passing or specific dollar/timeline outcomes.
- Space Grotesk for headlines, Inter for body, JetBrains Mono for codes/eyebrows/specs.

DO NOT:
- Use Tailwind utility classes
- Add Lucide CDN
- Replace any of the locked CSS
- Use any image not listed above
- Add JS animations beyond the form handler and the LED blink (CSS-only)`;
}

// =====================================================================
// SYSTEM G — Editorial Botanical (Landscaping)
// Reference: /public/samples/landscaping.html (Fernhouse & Co.)
// =====================================================================

function systemGCss(palette: DesignSystemPalette): string {
  const moss = palette.primary;
  const mossDeep = darken(palette.primary, 0.4);
  const terracotta = palette.accent;
  const terracottaDeep = darken(palette.accent, 0.18);
  return `:root {
  --moss: ${moss};
  --moss-deep: ${mossDeep};
  --fern: #4a6b3f;
  --sage: #b8c9a8;
  --sage-soft: #dde5d2;
  --terracotta: ${terracotta};
  --terracotta-deep: ${terracottaDeep};
  --bone: #f4ede0;
  --paper: #faf6ed;
  --paper-warm: #ede4d2;
  --ink: #1f2419;
  --muted: #6b7264;
  --line: #d8d0bf;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: 'Inter', system-ui, sans-serif; color: var(--ink); background: var(--paper); line-height: 1.6; -webkit-font-smoothing: antialiased; }
.container { max-width: 1280px; margin: 0 auto; padding: 0 32px; }
.serif { font-family: 'DM Serif Display', serif; }
.mono { font-family: 'DM Mono', monospace; }
.season-bar { background: var(--moss); color: var(--sage-soft); padding: 11px 0; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; }
.season-bar .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.season-bar .leaf { display: inline-flex; align-items: center; gap: 8px; }
.season-bar .leaf::before { content: '❋'; color: var(--terracotta); font-size: 13px; }
nav.main { background: var(--paper); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 50; }
nav.main .row { display: flex; align-items: center; justify-content: space-between; padding: 22px 0; }
.brand { display: flex; align-items: center; gap: 14px; text-decoration: none; color: var(--ink); }
.brand-mark { width: 46px; height: 46px; background: var(--moss); border-radius: 50%; display: grid; place-items: center; }
.brand-name { font-family: 'DM Serif Display', serif; font-size: 22px; line-height: 1; }
.brand-sub { font-family: 'DM Mono', monospace; font-size: 10px; color: var(--muted); letter-spacing: 0.16em; text-transform: uppercase; margin-top: 4px; }
.nav-links { display: flex; gap: 32px; align-items: center; }
.nav-links a { color: var(--ink); text-decoration: none; font-weight: 500; font-size: 14px; }
.nav-links a:hover { color: var(--moss); }
.nav-cta { display: inline-flex; align-items: center; gap: 10px; background: var(--moss); color: var(--bone); padding: 12px 24px; border-radius: 999px; font-weight: 600; text-decoration: none; font-size: 13px; letter-spacing: 0.04em; }
.nav-cta:hover { background: var(--moss-deep); }
.hero { padding: 60px 0 0; background: var(--paper); position: relative; }
.hero-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 64px; align-items: end; }
.hero-text { padding-bottom: 80px; }
.hero-eyebrow { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--terracotta); display: inline-flex; align-items: center; gap: 12px; margin-bottom: 26px; }
.hero-eyebrow::before { content: ''; width: 32px; height: 1px; background: var(--terracotta); }
h1.hero-title { font-family: 'DM Serif Display', serif; font-size: clamp(52px, 8vw, 110px); line-height: 0.96; letter-spacing: -0.015em; margin: 0 0 32px; color: var(--moss); }
h1.hero-title em { font-style: italic; color: var(--terracotta); }
.hero-lead { font-size: 19px; line-height: 1.65; color: var(--muted); max-width: 560px; margin: 0 0 40px; }
.hero-actions { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
.btn-primary { background: var(--terracotta); color: var(--bone); padding: 16px 32px; border-radius: 999px; font-weight: 600; text-decoration: none; font-size: 14px; letter-spacing: 0.04em; display: inline-flex; align-items: center; gap: 10px; }
.btn-primary:hover { background: var(--terracotta-deep); }
.btn-text { color: var(--moss); padding: 16px 22px; font-weight: 600; text-decoration: none; font-size: 14px; border-bottom: 1px solid var(--moss); }
.btn-text:hover { color: var(--terracotta); border-color: var(--terracotta); }
.hero-img { aspect-ratio: 4 / 5; background-size: cover; background-position: center; position: relative; }
.hero-img-tag { position: absolute; bottom: 28px; left: -28px; background: var(--bone); color: var(--moss); padding: 16px 24px; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; box-shadow: 0 12px 30px rgba(0,0,0,0.08); max-width: 240px; }
.hero-img-tag .lead { color: var(--terracotta); font-weight: 600; }
.creds-strip { background: var(--moss); color: var(--sage-soft); padding: 36px 0; margin-top: 40px; }
.creds-row { display: grid; grid-template-columns: 1.2fr 1fr 1fr 1fr 1fr; gap: 32px; align-items: center; }
.creds-row .lead { font-family: 'DM Serif Display', serif; font-size: 24px; line-height: 1.2; color: var(--bone); font-style: italic; }
.cred-stat .num { font-family: 'DM Serif Display', serif; font-size: 38px; line-height: 1; color: var(--bone); }
.cred-stat .lab { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--sage); margin-top: 8px; }
.section { padding: 110px 0; }
.eyebrow { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--terracotta); display: inline-flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.eyebrow::before { content: ''; width: 28px; height: 1px; background: var(--terracotta); }
h2.section-title { font-family: 'DM Serif Display', serif; font-size: clamp(40px, 5.5vw, 76px); line-height: 1.0; letter-spacing: -0.01em; margin: 0 0 24px; color: var(--moss); }
h2.section-title em { color: var(--terracotta); font-style: italic; }
.section-lead { font-size: 17px; color: var(--muted); max-width: 600px; line-height: 1.7; }
.portfolio { background: var(--paper); }
.port-head { display: flex; align-items: end; justify-content: space-between; gap: 48px; margin-bottom: 56px; flex-wrap: wrap; }
.port-grid { display: grid; grid-template-columns: repeat(12, 1fr); grid-template-rows: 360px 360px 360px; gap: 16px; }
.port-item { overflow: hidden; background-size: cover; background-position: center; position: relative; cursor: pointer; }
.port-item .meta { position: absolute; bottom: 0; left: 0; right: 0; padding: 24px 28px; background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 100%); color: var(--bone); transform: translateY(60%); transition: transform 0.4s; }
.port-item:hover .meta { transform: translateY(0); }
.port-item .meta .num { font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.16em; color: var(--terracotta); margin-bottom: 8px; }
.port-item .meta h4 { font-family: 'DM Serif Display', serif; font-size: 24px; margin: 0 0 6px; line-height: 1.1; }
.port-item .meta p { font-size: 12px; opacity: 0.85; margin: 0; font-family: 'DM Mono', monospace; letter-spacing: 0.04em; }
.p1 { grid-column: 1 / span 7; grid-row: 1; }
.p2 { grid-column: 8 / span 5; grid-row: 1; }
.p3 { grid-column: 1 / span 4; grid-row: 2; }
.p4 { grid-column: 5 / span 4; grid-row: 2; }
.p5 { grid-column: 9 / span 4; grid-row: 2; }
.p6 { grid-column: 1 / span 5; grid-row: 3; }
.p7 { grid-column: 6 / span 7; grid-row: 3; }
.process { background: var(--moss); color: var(--bone); }
.process h2 { color: var(--bone); }
.process h2 em { color: var(--terracotta); }
.proc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 28px; margin-top: 64px; }
.proc-card { border-top: 1px solid rgba(244,237,224,0.2); padding: 32px 0 0; position: relative; }
.proc-card .step { font-family: 'DM Serif Display', serif; font-size: 80px; line-height: 1; color: var(--terracotta); margin-bottom: 24px; }
.proc-card h4 { font-family: 'DM Serif Display', serif; font-size: 24px; margin: 0 0 12px; color: var(--bone); }
.proc-card p { font-size: 14px; color: var(--sage); margin: 0; line-height: 1.65; }
.seasonal { background: var(--paper-warm); }
.seas-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 64px; }
.seas-card { background: var(--bone); padding: 32px 28px; border-top: 4px solid var(--moss); position: relative; transition: transform 0.2s; }
.seas-card:hover { transform: translateY(-4px); }
.seas-card.spring { border-top-color: #7da868; }
.seas-card.summer { border-top-color: var(--terracotta); }
.seas-card.fall { border-top-color: #c98a2b; }
.seas-card.winter { border-top-color: #6b8a9a; }
.seas-card .season { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
.seas-card .months { font-family: 'DM Serif Display', serif; font-size: 14px; color: var(--terracotta); margin-bottom: 20px; }
.seas-card h4 { font-family: 'DM Serif Display', serif; font-size: 28px; line-height: 1.1; margin: 0 0 18px; color: var(--moss); }
.seas-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.seas-list li { font-size: 13px; color: var(--ink); padding-left: 18px; position: relative; line-height: 1.5; }
.seas-list li::before { content: '·'; position: absolute; left: 0; top: -2px; color: var(--terracotta); font-size: 22px; font-weight: 700; }
.seas-card .price { margin-top: 22px; padding-top: 20px; border-top: 1px solid var(--line); font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: 0.06em; color: var(--muted); }
.seas-card .price strong { font-family: 'DM Serif Display', serif; font-size: 22px; color: var(--moss); font-weight: 400; }
.philosophy { background: var(--paper); }
.phil-grid { display: grid; grid-template-columns: 1fr 1.3fr; gap: 80px; align-items: center; }
.phil-img { aspect-ratio: 3 / 4; background-size: cover; background-position: center; }
.phil-quote { font-family: 'DM Serif Display', serif; font-size: 36px; line-height: 1.3; color: var(--moss); margin: 0 0 36px; letter-spacing: -0.005em; }
.phil-quote em { font-style: italic; color: var(--terracotta); }
.phil-attr { display: flex; align-items: center; gap: 18px; padding-top: 28px; border-top: 1px solid var(--line); }
.phil-attr-name { font-family: 'DM Serif Display', serif; font-size: 20px; color: var(--ink); margin: 0 0 4px; }
.phil-attr-role { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.testimonials { background: var(--sage-soft); }
.test-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 56px; }
.test-card { background: var(--bone); padding: 36px; }
.test-mark { font-family: 'DM Serif Display', serif; font-size: 64px; color: var(--terracotta); line-height: 1; margin: 0 0 16px; height: 36px; overflow: hidden; }
.test-quote { font-size: 16px; line-height: 1.7; color: var(--ink); margin: 0 0 28px; }
.test-author { padding-top: 20px; border-top: 1px solid var(--line); }
.test-name { font-family: 'DM Serif Display', serif; font-size: 18px; color: var(--moss); margin: 0 0 4px; }
.test-meta { font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.1em; color: var(--muted); }
.cta { background: var(--moss-deep); color: var(--bone); position: relative; overflow: hidden; }
.cta .container { position: relative; z-index: 2; }
.cta-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 80px; align-items: center; }
.cta h2 { color: var(--bone); }
.cta h2 em { color: var(--terracotta); }
.cta .section-lead { color: rgba(244,237,224,0.75); }
.cta-form { background: var(--bone); color: var(--ink); padding: 44px; border-top: 4px solid var(--terracotta); }
.cta-form h3 { font-family: 'DM Serif Display', serif; font-size: 30px; margin: 0 0 8px; color: var(--moss); line-height: 1.1; }
.cta-form .sub { font-size: 13px; color: var(--muted); margin: 0 0 28px; font-family: 'DM Mono', monospace; letter-spacing: 0.04em; }
.form-row { margin-bottom: 16px; }
.form-row label { display: block; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--moss); margin-bottom: 6px; font-weight: 600; }
.form-row input, .form-row select, .form-row textarea { width: 100%; padding: 14px; background: var(--paper); color: var(--ink); border: 1px solid var(--line); border-radius: 0; font-size: 14px; font-family: inherit; }
.form-row textarea { min-height: 100px; resize: vertical; }
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-submit { width: 100%; background: var(--terracotta); color: var(--bone); padding: 16px; border: none; border-radius: 999px; font-weight: 600; font-size: 14px; letter-spacing: 0.06em; cursor: pointer; margin-top: 8px; }
.form-submit:hover { background: var(--terracotta-deep); }
footer { background: var(--paper); color: var(--muted); padding: 64px 0 28px; }
.footer-grid { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 40px; padding-bottom: 36px; border-bottom: 1px solid var(--line); }
.footer-grid h4 { font-family: 'DM Serif Display', serif; font-size: 17px; color: var(--moss); margin: 0 0 16px; }
.footer-grid a { display: block; color: var(--muted); text-decoration: none; font-size: 14px; padding: 4px 0; }
.footer-grid a:hover { color: var(--terracotta); }
.footer-bottom { padding-top: 22px; display: flex; align-items: center; justify-content: space-between; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.1em; }
@media (max-width: 980px) {
  .hero-grid, .phil-grid, .cta-grid { grid-template-columns: 1fr; gap: 48px; }
  .hero-img-tag { left: 16px; bottom: 16px; }
  .creds-row, .proc-grid, .seas-grid { grid-template-columns: repeat(2, 1fr); }
  .test-grid { grid-template-columns: 1fr; }
  .port-grid { grid-template-columns: 1fr; grid-template-rows: repeat(7, 280px); }
  .p1, .p2, .p3, .p4, .p5, .p6, .p7 { grid-column: 1; grid-row: auto; }
  .footer-grid { grid-template-columns: 1fr 1fr; }
}`;
}

function systemGFontsHead(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">`;
}

function buildSystemGBlock(
  palette: DesignSystemPalette,
  images: DesignSystemImages,
): string {
  const portfolioImgs = images.portfolio.length >= 7
    ? images.portfolio.slice(0, 7)
    : [...images.portfolio, ...Array(7 - images.portfolio.length).fill(images.fallback)];

  return `LOCKED DESIGN SYSTEM — SYSTEM G (EDITORIAL BOTANICAL)

This niche (${palette.label}) uses System G — a slow, editorial, magazine-of-gardens layout. The design is FIXED. Do not invent your own layout, palette, or typography. Do not use Tailwind. The CSS below is complete — you only fill content.

REQUIRED <head> ELEMENTS:
1. <meta charset> + <meta viewport> + <title>
2. Google Fonts (use this block VERBATIM):
${systemGFontsHead()}
3. A single <style> block containing the FULL CSS BELOW VERBATIM:

<style>
${systemGCss(palette)}
</style>

REQUIRED PAGE STRUCTURE (build the <body> in this exact order, using these exact class names):

1. <div class="season-bar">
   <div class="container row">
     - Left: <span class="leaf">[SEASON YEAR · BOOKING STATUS]</span>
     - Right: <span>[PHONE] · [BOOKED-THROUGH NOTE]</span>

2. <nav class="main">
   <div class="container row">
     - .brand with .brand-mark (circular, contains a small white SVG leaf/sprig icon, 22x22, stroke #f4ede0) + .brand-name + .brand-sub ("Garden design · build · est. [YEAR]")
     - .nav-links: 5 anchors (Portfolio, Process, Seasonal Care, Studio, Consult)
     - .nav-cta: "Book a Consult"

3. <section class="hero"> with two children:
   a. <div class="container"><div class="hero-grid">
      - <div class="hero-text">: .hero-eyebrow ("Garden design studio · [CITY, STATE]"), <h1 class="hero-title"> with ONE word in <em> tags (italic terracotta), .hero-lead (1 sentence about native-forward / hand-laid stone / weekly stewardship), .hero-actions with .btn-primary "Book a design consult" + .btn-text "See the portfolio →"
      - <div class="hero-img" style="background-image: url('${images.hero}');">: contains .hero-img-tag (overlapping bottom-left tag with .lead "EST. [YEAR] · [CITY]" + an italicized DM Serif quote underneath)
   b. <div class="creds-strip"><div class="container creds-row">: .lead (italic serif lead-in line) + EXACTLY 4 .cred-stat children, each with .num + .lab. Use stats like "[N] yrs / In practice", "[N]+ / Gardens designed", "[N]% / Native plantings", "APLD / Certified designers"

4. <section class="section portfolio" id="portfolio">
   <div class="container">
     .port-head with two children: left (.eyebrow "Selected work · [YEAR — YEAR]" + h2.section-title with one <em>) and right (.section-lead 2 sentences)
     .port-grid with EXACTLY 7 .port-item divs (.p1 through .p7), each with inline background-image style. Each .port-item contains a .meta div with: .num "N° 0[NN] · [NEIGHBORHOOD]", h4 (project name like "The Stoneworker's Courtyard"), p (1-line material/feature note).
     Use these portfolio image URLs in order p1-p7: ${portfolioImgs.map((u, i) => `p${i + 1}=${u}`).join(", ")}

5. <section class="section process" id="process">
   <div class="container">
     .eyebrow "How we work" (style="color: var(--terracotta);")
     <h2 class="section-title"> 2-line headline with one <em>
     .section-lead (style="color: var(--sage); max-width: 720px;") about unhurried process
     .proc-grid with EXACTLY 4 .proc-card children. Each:
       <div class="step">i.</div> through iv. (Roman numerals lowercase + period)
       <h4>Step name (e.g., "Site Study", "Concept & Plan", "Build & Plant", "Stewardship")</h4>
       <p>2-line specific description with numbers (months, soil pH points, % native, etc.)</p>

6. <section class="section seasonal" id="seasonal">
   <div class="container">
     .eyebrow "Year-round care"
     <h2 class="section-title"> 2-line headline w/ one <em>
     .section-lead about seasonal stewardship subscription
     .seas-grid with EXACTLY 4 .seas-card children, classes in order: spring, summer, fall, winter. Each:
       .season "Season I/II/III/IV"
       .months "[Month] — [Month]"
       <h4>Season name (e.g., "Spring Awakening", "Summer Tending")</h4>
       <ul class="seas-list"> with EXACTLY 5 <li> items (specific tasks)
       .price "From <strong>$[N]</strong> · per visit"

7. <section class="section philosophy" id="about">
   <div class="container">
     .phil-grid with two children:
       - <div class="phil-img" style="background-image: url('${images.fallback}');"></div>
       - <div>: .eyebrow "Studio philosophy", <p class="phil-quote"> 2-3 sentence quote with one <em>, .phil-attr with .phil-attr-name (founder name) + .phil-attr-role (role + credential like "Founder & Lead Designer · APLD"), then a paragraph (style="margin-top: 32px; font-size: 16px; color: var(--muted); line-height: 1.7;") giving founder backstory in 3 sentences.

8. <section class="section testimonials">
   <div class="container">
     .eyebrow "Client letters"
     <h2 class="section-title"> 1-line headline with one <em>
     .test-grid with EXACTLY 3 .test-card children. Each:
       <div class="test-mark">"</div>
       <p class="test-quote">3-4 sentence specific testimonial citing neighborhood, year, and what they noticed (one <em> for emphasis)</p>
       <div class="test-author"><p class="test-name">[Name]</p><p class="test-meta">[NEIGHBORHOOD · YEAR]</p></div>

9. <section class="section cta" id="contact">
   <div class="container"><div class="cta-grid">
     Left side:
       .eyebrow "Begin a project" (style="color: var(--terracotta);")
       <h2 class="section-title"> 2-line w/ one <em>
       .section-lead about consult availability
       After lead, a div with style="margin-top: 40px; display: flex; flex-direction: column; gap: 18px;" containing 3 stat-rows (each with style for top-border + 36px terracotta DM Serif number on left + bone label/sage subtext stack on right). Use stats like "$[N] · Initial design consult · 90 min on-site · credited toward design fee", "[N] · New projects per year · Studio capacity is intentional", "[N] yr · Establishment care included · Bi-weekly visits after install".
     Right side: <form class="cta-form" onsubmit="event.preventDefault(); alert('Thank you — [NAME] will be in touch within five business days.');">
       <h3>Begin a Conversation</h3>
       <p class="sub">WE REPLY WITHIN 5 BUSINESS DAYS · NO SALES CALLS</p>
       .form-row-2 with First name + Last name
       .form-row Email (type=email)
       .form-row "Property location" (placeholder "Neighborhood, City")
       .form-row "Project scale" select with 5 options (Small courtyard, Medium full property, Large acreage, Restoration, Stewardship subscription)
       .form-row "Tell us about the place" textarea
       <button type="submit" class="form-submit">Begin Conversation</button>

10. <footer><div class="container">
    .footer-grid with 4 columns: brand+blurb (flex layout w/ .brand-mark icon copy), Studio (4 links), Services (4 links), Contact (phone styled as terracotta bold + email + address)
    .footer-bottom with copyright LCB# left and "DESIGNED IN [CITY]" right

CONTENT RULES (System G):
- Tone: slow, considered, "long view" / decades not seasons / native-forward / studio-not-crew. Never "we're the best" — instead specific quiet authority.
- Every detail should reference real numbers: years in practice, % native plantings, square footage, months of site study, seasonal pricing.
- Use one <em> wrap per headline maximum (italic terracotta accent word).
- DM Serif Display for headlines, Inter body, DM Mono for eyebrows/codes/labels.

DO NOT:
- Use Tailwind utility classes
- Add Lucide CDN
- Replace any of the locked CSS
- Use any image not listed above
- Add JS animations beyond the form handler`;
}

// =====================================================================
// SYSTEM H — Architectural Magazine (Premium Construction / Real Estate)
// Reference: /public/samples/premium-construction.html (Halverson Build Co.)
// =====================================================================

function systemHCss(palette: DesignSystemPalette): string {
  const ink = palette.primary;
  const inkDeep = darken(palette.primary, 0.4);
  const brass = palette.accent;
  return `:root {
  --ink: ${ink};
  --ink-deep: ${inkDeep};
  --warm-bg: #f6f3ed;
  --warm-bg-2: #ede7da;
  --bone: #faf7f0;
  --brass: ${brass};
  --brass-light: ${brass};
  --stone: #71706b;
  --line: #d8d2c2;
  --line-dark: #2a2b2f;
  --muted: #6e6c66;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: 'Inter', system-ui, sans-serif; color: var(--ink); background: var(--warm-bg); line-height: 1.6; font-weight: 400; -webkit-font-smoothing: antialiased; }
.container { max-width: 1320px; margin: 0 auto; padding: 0 36px; }
.serif { font-family: 'Playfair Display', serif; }
.mono { font-family: 'IBM Plex Mono', monospace; }
.top-bar { background: var(--ink-deep); color: rgba(250,247,240,0.7); padding: 11px 0; font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; }
.top-bar .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.top-bar a { color: var(--brass-light); text-decoration: none; }
nav.main { background: var(--warm-bg); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 50; }
nav.main .row { display: flex; align-items: center; justify-content: space-between; padding: 26px 0; }
.brand { display: flex; align-items: center; gap: 16px; text-decoration: none; color: var(--ink); }
.brand-mark { width: 52px; height: 52px; border: 1.5px solid var(--brass); display: grid; place-items: center; color: var(--brass); font-family: 'Playfair Display', serif; font-size: 22px; font-style: italic; }
.brand-name { font-family: 'Playfair Display', serif; font-size: 22px; line-height: 1; color: var(--ink); }
.brand-sub { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--stone); letter-spacing: 0.18em; text-transform: uppercase; margin-top: 6px; }
.nav-links { display: flex; gap: 32px; align-items: center; }
.nav-links a { color: var(--ink); text-decoration: none; font-size: 13px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; position: relative; }
.nav-links a:hover { color: var(--brass); }
.nav-cta { color: var(--ink); text-decoration: none; font-family: 'Playfair Display', serif; font-size: 16px; font-style: italic; border-bottom: 1px solid var(--brass); padding-bottom: 4px; }
.hero { background: var(--warm-bg); padding: 72px 0 100px; position: relative; }
.hero-meta { display: flex; align-items: center; justify-content: space-between; padding-bottom: 40px; border-bottom: 1px solid var(--line); margin-bottom: 56px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--stone); letter-spacing: 0.18em; text-transform: uppercase; }
.hero-meta .left { display: flex; gap: 32px; align-items: center; }
.hero-meta .left span::before { content: '— '; color: var(--brass); }
.hero-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 80px; align-items: end; }
h1.hero-title { font-family: 'Playfair Display', serif; font-weight: 400; font-size: clamp(60px, 8.5vw, 132px); line-height: 0.95; letter-spacing: -0.02em; margin: 0 0 36px; color: var(--ink); }
h1.hero-title em { font-style: italic; color: var(--brass); }
.hero-lead { font-size: 19px; line-height: 1.65; color: var(--muted); max-width: 540px; margin: 0 0 44px; font-weight: 300; }
.hero-actions { display: flex; gap: 18px; flex-wrap: wrap; align-items: center; }
.btn-primary { background: var(--ink); color: var(--bone); padding: 18px 36px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; text-decoration: none; border-radius: 0; }
.btn-primary:hover { background: var(--ink-deep); }
.btn-line { color: var(--ink); padding: 18px 0; font-family: 'Playfair Display', serif; font-size: 17px; font-style: italic; text-decoration: none; border-bottom: 1px solid var(--brass); }
.btn-line:hover { color: var(--brass); }
.hero-figure { aspect-ratio: 4 / 5; background-size: cover; background-position: center; position: relative; }
.hero-figure-cap { position: absolute; bottom: -32px; left: 32px; right: 32px; background: var(--bone); padding: 22px 28px; border-left: 2px solid var(--brass); font-family: 'Playfair Display', serif; font-size: 17px; font-style: italic; color: var(--ink); line-height: 1.4; }
.hero-figure-cap .src { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--stone); letter-spacing: 0.16em; text-transform: uppercase; margin-top: 10px; font-style: normal; display: block; }
.section { padding: 130px 0; }
.eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--brass); display: inline-flex; align-items: center; gap: 14px; margin-bottom: 20px; }
.eyebrow::before { content: '—'; color: var(--brass); }
h2.section-title { font-family: 'Playfair Display', serif; font-weight: 400; font-size: clamp(40px, 5.5vw, 78px); line-height: 1.0; letter-spacing: -0.015em; margin: 0 0 24px; color: var(--ink); }
h2.section-title em { font-style: italic; color: var(--brass); }
.section-lead { font-size: 18px; color: var(--muted); max-width: 640px; line-height: 1.7; font-weight: 300; }
.portfolio { background: var(--warm-bg); }
.port-head { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: end; margin-bottom: 80px; }
.port-list { display: flex; flex-direction: column; gap: 120px; }
.port-home { display: grid; grid-template-columns: 1.3fr 1fr; gap: 64px; align-items: center; }
.port-home.reverse { grid-template-columns: 1fr 1.3fr; direction: rtl; }
.port-home.reverse > * { direction: ltr; }
.port-img { aspect-ratio: 5 / 4; background-size: cover; background-position: center; position: relative; }
.port-img .num { position: absolute; top: 24px; left: 24px; background: var(--bone); color: var(--ink); padding: 8px 14px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.16em; }
.port-detail .marker { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--brass); letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 16px; }
.port-detail h3 { font-family: 'Playfair Display', serif; font-weight: 400; font-size: 42px; line-height: 1.05; letter-spacing: -0.01em; margin: 0 0 20px; }
.port-detail h3 em { font-style: italic; color: var(--brass); }
.port-detail p { font-size: 16px; color: var(--muted); line-height: 1.7; margin: 0 0 32px; font-weight: 300; }
.port-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; padding: 28px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.port-stat .key { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: var(--stone); letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 6px; }
.port-stat .val { font-family: 'Playfair Display', serif; font-size: 22px; color: var(--ink); }
.port-stat .val em { font-style: italic; color: var(--brass); }
.craft { background: var(--ink); color: var(--bone); }
.craft .eyebrow { color: var(--brass-light); }
.craft h2.section-title { color: var(--bone); }
.craft h2.section-title em { color: var(--brass-light); }
.craft .section-lead { color: rgba(250,247,240,0.65); }
.craft-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 48px; margin-top: 80px; }
.craft-card { border-top: 1px solid rgba(250,247,240,0.18); padding: 36px 0; display: grid; grid-template-columns: 100px 1fr; gap: 36px; }
.craft-card .num { font-family: 'Playfair Display', serif; font-size: 56px; font-style: italic; color: var(--brass-light); line-height: 1; }
.craft-card h4 { font-family: 'Playfair Display', serif; font-weight: 400; font-size: 26px; margin: 0 0 14px; }
.craft-card h4 em { font-style: italic; color: var(--brass-light); }
.craft-card p { font-size: 15px; color: rgba(250,247,240,0.7); line-height: 1.7; margin: 0; font-weight: 300; }
.philosophy { background: var(--warm-bg-2); padding: 130px 0; }
.phil-grid { display: grid; grid-template-columns: 1fr 1.3fr; gap: 80px; align-items: center; }
.phil-img { aspect-ratio: 3 / 4; background-size: cover; background-position: center; }
.phil-quote { font-family: 'Playfair Display', serif; font-weight: 400; font-size: 38px; line-height: 1.3; letter-spacing: -0.01em; color: var(--ink); margin: 0 0 36px; }
.phil-quote em { font-style: italic; color: var(--brass); }
.phil-quote::before { content: '"'; display: block; font-size: 80px; line-height: 0.5; color: var(--brass); margin-bottom: 24px; }
.phil-attr { padding-top: 32px; border-top: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; }
.phil-attr-name { font-family: 'Playfair Display', serif; font-size: 22px; color: var(--ink); margin: 0 0 4px; }
.phil-attr-role { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--stone); }
.phil-mono { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.16em; color: var(--brass); text-transform: uppercase; }
.materials { background: var(--warm-bg); }
.mat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-top: 64px; }
.mat-card { aspect-ratio: 1 / 1; background-size: cover; background-position: center; position: relative; overflow: hidden; }
.mat-card .ov { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 40%, rgba(13,14,16,0.85) 100%); display: flex; flex-direction: column; justify-content: flex-end; padding: 32px; color: var(--bone); }
.mat-card .num { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--brass-light); letter-spacing: 0.16em; margin-bottom: 8px; }
.mat-card h4 { font-family: 'Playfair Display', serif; font-weight: 400; font-size: 24px; margin: 0 0 6px; }
.mat-card p { font-size: 13px; color: rgba(250,247,240,0.75); margin: 0; line-height: 1.5; }
.press { background: var(--bone); padding: 70px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.press-row { display: flex; align-items: center; justify-content: space-between; gap: 32px; flex-wrap: wrap; }
.press-label { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--stone); }
.press-logo { font-family: 'Playfair Display', serif; font-size: 22px; font-style: italic; color: var(--ink); opacity: 0.6; }
.press-logo.bold { font-style: normal; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; font-size: 14px; font-family: 'Inter', sans-serif; }
.testimonials { background: var(--warm-bg-2); }
.test-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 48px; margin-top: 64px; }
.test-card { padding: 0; background: transparent; }
.test-mark { font-family: 'Playfair Display', serif; font-size: 80px; font-style: italic; color: var(--brass); line-height: 0.5; margin-bottom: 32px; height: 32px; overflow: hidden; }
.test-quote { font-family: 'Playfair Display', serif; font-size: 24px; line-height: 1.45; color: var(--ink); margin: 0 0 32px; font-weight: 400; font-style: italic; }
.test-attr { padding-top: 24px; border-top: 1px solid var(--line); }
.test-name { font-family: 'Playfair Display', serif; font-size: 18px; color: var(--ink); margin: 0 0 4px; }
.test-meta { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--stone); }
.cta { background: var(--ink-deep); color: var(--bone); position: relative; overflow: hidden; }
.cta .container { position: relative; z-index: 2; }
.cta-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 96px; align-items: center; }
.cta .eyebrow { color: var(--brass-light); }
.cta h2.section-title { color: var(--bone); }
.cta h2.section-title em { color: var(--brass-light); }
.cta .section-lead { color: rgba(250,247,240,0.7); }
.cta-form { background: var(--bone); color: var(--ink); padding: 48px; border-top: 2px solid var(--brass); }
.cta-form h3 { font-family: 'Playfair Display', serif; font-weight: 400; font-size: 30px; margin: 0 0 8px; line-height: 1.1; }
.cta-form h3 em { font-style: italic; color: var(--brass); }
.cta-form .sub { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--stone); letter-spacing: 0.14em; margin: 0 0 32px; text-transform: uppercase; }
.form-row { margin-bottom: 18px; }
.form-row label { display: block; font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--stone); margin-bottom: 8px; }
.form-row input, .form-row select, .form-row textarea { width: 100%; padding: 14px 0; background: transparent; color: var(--ink); border: none; border-bottom: 1px solid var(--line); border-radius: 0; font-size: 15px; font-family: inherit; }
.form-row input:focus, .form-row select:focus, .form-row textarea:focus { outline: none; border-bottom-color: var(--brass); }
.form-row textarea { min-height: 60px; resize: vertical; padding-top: 14px; }
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.form-submit { background: var(--ink); color: var(--bone); padding: 18px 36px; border: none; border-radius: 0; font-family: 'IBM Plex Mono', monospace; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; cursor: pointer; margin-top: 12px; }
.form-submit:hover { background: var(--ink-deep); }
footer { background: var(--warm-bg); color: var(--muted); padding: 70px 0 32px; }
.footer-grid { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 40px; padding-bottom: 40px; border-bottom: 1px solid var(--line); }
.footer-grid h4 { font-family: 'Playfair Display', serif; font-weight: 400; font-size: 18px; color: var(--ink); margin: 0 0 18px; font-style: italic; }
.footer-grid a { display: block; color: var(--muted); text-decoration: none; font-size: 14px; padding: 4px 0; }
.footer-grid a:hover { color: var(--brass); }
.footer-bottom { padding-top: 24px; display: flex; align-items: center; justify-content: space-between; font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; }
@media (max-width: 980px) {
  .hero-grid, .port-home, .port-home.reverse, .phil-grid, .cta-grid { grid-template-columns: 1fr; gap: 48px; direction: ltr; }
  .craft-grid { grid-template-columns: 1fr; }
  .port-stats { grid-template-columns: 1fr 1fr; }
  .mat-grid { grid-template-columns: 1fr; }
  .test-grid { grid-template-columns: 1fr; }
  .footer-grid { grid-template-columns: 1fr 1fr; }
  .hero-meta { flex-direction: column; align-items: flex-start; gap: 12px; }
  .hero-figure-cap { left: 16px; right: 16px; bottom: -16px; }
}`;
}

function systemHFontsHead(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Inter:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">`;
}

function buildSystemHBlock(
  palette: DesignSystemPalette,
  images: DesignSystemImages,
): string {
  const portfolioImgs = images.portfolio.length >= 3
    ? images.portfolio.slice(0, 3)
    : [...images.portfolio, ...Array(3 - images.portfolio.length).fill(images.fallback)];
  const matImgs = images.portfolio.length >= 6
    ? images.portfolio.slice(0, 6)
    : [...images.portfolio, ...Array(6 - images.portfolio.length).fill(images.fallback)];

  return `LOCKED DESIGN SYSTEM — SYSTEM H (ARCHITECTURAL MAGAZINE)

This niche (${palette.label}) uses System H — a Playfair-Display editorial layout patterned after Architectural Digest / Robb Report. The design is FIXED. Do not invent your own layout, palette, or typography. Do not use Tailwind. The CSS below is complete — you only fill content.

REQUIRED <head> ELEMENTS:
1. <meta charset> + <meta viewport> + <title>
2. Google Fonts (use this block VERBATIM):
${systemHFontsHead()}
3. A single <style> block containing the FULL CSS BELOW VERBATIM:

<style>
${systemHCss(palette)}
</style>

REQUIRED PAGE STRUCTURE (build the <body> in this exact order, using these exact class names):

1. <div class="top-bar">
   <div class="container row">
     - Left: <div>VOL. [N] · ISSUE [N] · [SEASON YEAR]</div>
     - Right: <div>BY APPOINTMENT · <a href="tel:...">[PHONE]</a></div>

2. <nav class="main">
   <div class="container row">
     - .brand: .brand-mark (a single uppercase italic Playfair letter — first letter of business name) + .brand-name + .brand-sub ("Custom Homes · [REGION] · Est. [YEAR]" or similar)
     - .nav-links: 5 anchors (Homes, Craft, Materials, Studio, "Begin a Project" with class="nav-cta" — italic Playfair w/ brass underline)

3. <section class="hero">
   <div class="container">
     .hero-meta: .left with 3 <span> tags (each gets terracotta '— ' prefix via CSS) describing practice ("Custom residential builders", "Estate & legacy homes", "[REGION]") and right "EST. M[ROMAN]"
     .hero-grid two children:
       a. <div>: <h1 class="hero-title"> 2-line headline w/ ONE word in <em> (italic brass), .hero-lead (1-2 sentences positioning), .hero-actions w/ .btn-primary "Begin a Project →" + .btn-line "See selected homes"
       b. <div class="hero-figure" style="background-image: url('${images.hero}');">: contains .hero-figure-cap (overlapping caption w/ italic Playfair description of hero image + .src "PHOTO · [PHOTOGRAPHER] · [PUBLICATION]")

4. <section class="section portfolio" id="portfolio">
   <div class="container">
     .port-head: left (.eyebrow "Selected works · [YEAR — YEAR]" + h2.section-title with one <em>) and right (.section-lead 2 sentences)
     .port-list with EXACTLY 3 .port-home divs. Second one has class="port-home reverse". Each:
       <div class="port-img" style="background-image: url('[URL]');"><div class="num">N° 0[NN]</div></div>
       <div class="port-detail">
         <div class="marker">N° 0[NN] · [LOCATION] · COMPLETED [YEAR]</div>
         <h3>The <em>[Name]</em> Residence</h3>
         <p>3-4 sentences citing materials, square footage, distinctive features.</p>
         <div class="port-stats"> EXACTLY 4 .port-stat children, each .key + .val (one .val with <em>): keys "Square footage" / "Build duration" / "Architect" / "Investment"
       </div>
     Use these portfolio images in order: ${portfolioImgs.map((u, i) => `home${i + 1}=${u}`).join(", ")}

5. <section class="section craft" id="craft">
   <div class="container">
     .eyebrow "The way we build"
     <h2 class="section-title"> 2-line headline w/ ONE <em>
     .section-lead about no-subcontractors / 20-year crew
     .craft-grid with EXACTLY 4 .craft-card children. Each:
       <div class="num">i.</div> through iv.
       <div><h4>Step name with one <em></h4><p>3-line specific description with numbers (months of site study, sq ft of shop, % work in-house)</p></div>

6. <section class="philosophy" id="about">
   <div class="container">
     .phil-grid with two children:
       - <div class="phil-img" style="background-image: url('${images.fallback}');"></div>
       - <div>: .eyebrow "From the studio", <p class="phil-quote"> 1-2 sentence quote with one <em>, .phil-attr with .phil-attr-name (founder) + .phil-attr-role (title), and .phil-mono "EST. [YEAR] · [CITY, STATE]". Below attr, a paragraph (style="margin-top: 36px; font-size: 16px; color: var(--muted); line-height: 1.7; font-weight: 300;") giving founder backstory in 3 sentences.

7. <section class="section materials" id="materials">
   <div class="container">
     .eyebrow "Materials & sourcing"
     <h2 class="section-title"> 2-line headline w/ one <em>
     .section-lead about provenance / mill / quarry naming
     .mat-grid with EXACTLY 6 .mat-card children. Each:
       inline style="background-image: url('[URL]');"
       <div class="ov"><div class="num">M / 0[N]</div><h4>Material name (e.g., "Reclaimed Timber", "Yule Marble")</h4><p>1-2 line provenance specifics</p></div>
     Use these material images in order: ${matImgs.map((u, i) => `mat${i + 1}=${u}`).join(", ")}

8. <section class="press">
   <div class="container press-row">
     .press-label "As featured in"
     EXACTLY 5 .press-logo children — one with class="press-logo bold" (e.g., "WALL ST. JOURNAL · MANSION") and 4 italic-Playfair (e.g., "Architectural Digest", "Dwell", "Robb Report", "Mountain Living"). Pick names appropriate to the niche.

9. <section class="section testimonials">
   <div class="container">
     .eyebrow "From homeowners"
     <h2 class="section-title"> 2-line w/ one <em>
     .test-grid with EXACTLY 4 .test-card children. Each:
       <div class="test-mark">"</div>
       <p class="test-quote">3 sentences citing specific scope, dollar amount, year, or distinguishing detail</p>
       <div class="test-attr"><div class="test-name">[Name]</div><div class="test-meta">[Project name · Location · Year]</div></div>

10. <section class="section cta" id="contact">
    <div class="container"><div class="cta-grid">
      Left:
        .eyebrow "Begin a conversation"
        <h2 class="section-title"> 2-line w/ one <em>
        .section-lead about appointment scheduling (12-24 months out)
        After lead, a div with style="margin-top: 48px; display: flex; flex-direction: column; gap: 22px;" containing 3 stat-rows (each style w/ top-border + 42px italic Playfair brass-light number + bone label/muted subtext stack). Stats like "[N] · Slots remaining · [YEAR] cohort", "$[N]m · Typical project minimum", "[N] yr · Written structural warranty".
      Right: <form class="cta-form" onsubmit="event.preventDefault(); alert('Thank you. [NAME] will write to you personally within ten business days.');">
        <h3>Begin a <em>conversation</em></h3>
        <p class="sub">RESPONSE WITHIN 10 BUSINESS DAYS · NO SALES CALLS</p>
        .form-row-2 First name + Last name
        .form-row Email (type=email)
        .form-row "Project location" (placeholder "Town & state · or land already secured")
        .form-row "Anticipated timeline" select with 4 options (Ground-break in [YEAR], Ground-break in [YEAR+1] (cohort open), Ground-break [YEAR+2]+, Land not yet secured)
        .form-row "Tell us about the project" textarea
        <button type="submit" class="form-submit">Send Inquiry</button>

11. <footer><div class="container">
    .footer-grid 4 columns: brand (.brand-mark letter + .brand-name + brand-sub + 360px-max blurb), Studio (4 links), Practice (4 links), Visit (phone styled brass + email + address)
    .footer-bottom: "© MM[ROMAN] · [BUSINESS NAME]" left, "BUILT IN [CITY] · BY APPOINTMENT" right

CONTENT RULES (System H):
- Tone: editorial, slow, prestige. Every sentence implies generations / decades / inheritance / legacy. Never "we're affordable" or volume-driven language.
- Cite real proper nouns: architect names ("Studio B", "Olson Kundig", "CCY Architects", "Bohlin Cywinski Jackson"), publications, mills, quarries.
- Numbers should be small and exclusive: "six homes a year", "two slots remaining", "twelve new projects", "40-year warranty".
- One <em> per headline (italic brass accent word).
- Playfair Display for headlines and quotes, Inter (300/400 weight) body, IBM Plex Mono for eyebrows/codes/labels.
- Roman numerals where natural (i. ii. iii. iv. for steps, MMXXVI for dates).

DO NOT:
- Use Tailwind utility classes
- Add Lucide CDN
- Replace any of the locked CSS
- Use any image not listed above
- Add JS animations beyond the form handler`;
}

// =====================================================================
// Public entrypoint
// =====================================================================

export function buildLockedDesignSystemBlock(
  system: DesignSystemId,
  palette: DesignSystemPalette,
  images: DesignSystemImages,
): string {
  switch (system) {
    case "A":
      return buildSystemABlock(palette, images);
    case "C":
      return buildSystemCBlock(palette, images);
    case "D":
      return buildSystemDBlock(palette, images);
    case "E":
      return buildSystemEBlock(palette, images);
    case "F":
      return buildSystemFBlock(palette, images);
    case "G":
      return buildSystemGBlock(palette, images);
    case "H":
      return buildSystemHBlock(palette, images);
    case "B":
    default:
      return buildSystemBBlock(palette, images);
  }
}
