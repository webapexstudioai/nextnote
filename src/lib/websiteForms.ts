/**
 * Generated NextNote websites include one or more <form data-nn-form> elements.
 * This script, injected right before </body> during generation, hijacks their
 * submit event and POSTs the fields as JSON to /api/websites/{siteId}/submit.
 * That endpoint creates a prospect row in the site owner's CRM.
 *
 * We keep the script compact and IIFE-wrapped so it doesn't collide with any
 * other inline scripts in the page. It's regenerated per site so the siteId
 * is baked in — no DOM lookup needed at runtime.
 */
export function buildFormHandlerScript(siteId: string): string {
  const encoded = JSON.stringify(siteId);
  return `<script id="nn-form-handler">(function(){var SITE_ID=${encoded};function bind(form){if(form.dataset.nnBound)return;form.dataset.nnBound="1";form.addEventListener("submit",function(e){e.preventDefault();var status=form.querySelector("[data-nn-form-status]");var btn=form.querySelector('button[type="submit"]')||form.querySelector("button");var orig=btn?btn.innerHTML:"";if(btn){btn.disabled=true;btn.textContent="Sending\\u2026";}if(status){status.textContent="";status.removeAttribute("style");}var data={};new FormData(form).forEach(function(v,k){data[k]=typeof v==="string"?v:"";});fetch("/api/websites/"+SITE_ID+"/submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}).then(function(r){return r.json().then(function(j){return{ok:r.ok,body:j};});}).then(function(res){if(!res.ok)throw new Error((res.body&&res.body.error)||"Submission failed");form.reset();if(status){status.textContent="Thanks \\u2014 we'll be in touch shortly.";status.style.color="#059669";}}).catch(function(err){if(status){status.textContent=(err&&err.message)||"Something went wrong. Please try again.";status.style.color="#dc2626";}}).finally(function(){if(btn){btn.disabled=false;btn.innerHTML=orig;}});});}function init(){document.querySelectorAll("form[data-nn-form]").forEach(bind);}if(document.readyState!=="loading")init();else document.addEventListener("DOMContentLoaded",init);})();</script>`;
}

/**
 * Make sure the form-handler script is present in the HTML. If it's already
 * there we replace it (so the embedded siteId stays correct even if the site
 * was regenerated), otherwise we inject it before </body>.
 */
export function ensureFormHandler(html: string, siteId: string): string {
  const script = buildFormHandlerScript(siteId);

  if (/<script id="nn-form-handler">/i.test(html)) {
    return html.replace(/<script id="nn-form-handler">[\s\S]*?<\/script>/i, script);
  }

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${script}</body>`);
  }

  return html + script;
}

/**
 * Generated sites use animated counters (`<span data-count="1136">0</span>`) that
 * only fire when the element scrolls into view. In the dashboard preview iframe
 * — and on tall pages a visitor never scrolls down — the visible "0" sticks
 * around. This fallback runs ~1.2s after page load and force-sets any counter
 * that's still showing "0" to its final formatted value, so editors and visitors
 * see the actual number. The in-page IO animation still fires first for users
 * who do scroll past it, so the animation effect is preserved when it works.
 */
const COUNTER_FALLBACK_SCRIPT = `<script id="nn-counter-fallback">(function(){function fmt(n){try{return n.toLocaleString("en-US")}catch(e){return String(n)}}function settle(){document.querySelectorAll("[data-count]").forEach(function(el){var raw=(el.textContent||"").trim();if(raw&&raw!=="0"&&raw!=="0.0")return;var n=parseFloat(el.getAttribute("data-count"));if(isNaN(n))return;el.textContent=fmt(n)})}if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",function(){setTimeout(settle,1200)})}else{setTimeout(settle,1200)}})();</script>`;

export function ensureCounterFallback(html: string): string {
  if (/<script id="nn-counter-fallback">/i.test(html)) {
    return html.replace(
      /<script id="nn-counter-fallback">[\s\S]*?<\/script>/i,
      COUNTER_FALLBACK_SCRIPT,
    );
  }
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${COUNTER_FALLBACK_SCRIPT}</body>`);
  }
  return html + COUNTER_FALLBACK_SCRIPT;
}

/**
 * Sometimes the model emits `<form data-nn-form>` with the heading and
 * a submit button but no visible inputs (truncation mid-section, or it
 * thinks CSS will handle them, or it just forgot). The submit handler
 * needs name/email/phone/message to actually create a CRM lead, so an
 * empty form is worse than useless.
 *
 * If the form is missing 2+ of the 4 required inputs, replace its body
 * with a neutral, theme-agnostic input set that works on any background.
 * If it has 3+ already, leave it alone — that's a stylistic choice the
 * model made on purpose.
 */
const FORM_FALLBACK_FIELDS = `
<style id="nn-form-fallback-styles">
.nn-form-fallback{display:grid;gap:0.75rem;width:100%;}
.nn-form-fallback label{display:flex;flex-direction:column;gap:0.35rem;font-size:0.78rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;opacity:0.75;}
.nn-form-fallback input,.nn-form-fallback textarea{width:100%;padding:0.85rem 1rem;font-size:1rem;font-family:inherit;color:inherit;background:rgba(255,255,255,0.06);border:1px solid currentColor;border-color:rgba(127,127,127,0.35);border-radius:10px;outline:none;transition:border-color 0.15s ease,box-shadow 0.15s ease;}
.nn-form-fallback input:focus,.nn-form-fallback textarea:focus{border-color:currentColor;box-shadow:0 0 0 3px rgba(127,127,127,0.18);}
.nn-form-fallback textarea{min-height:128px;resize:vertical;}
.nn-form-fallback .nn-form-row{display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;}
@media (max-width:640px){.nn-form-fallback .nn-form-row{grid-template-columns:1fr;}}
.nn-form-fallback button[type="submit"]{padding:0.95rem 1.5rem;font-size:0.95rem;font-weight:600;border-radius:999px;border:none;cursor:pointer;background:currentColor;color:#fff;mix-blend-mode:normal;transition:transform 0.15s ease,opacity 0.15s ease;}
.nn-form-fallback button[type="submit"]:hover{transform:translateY(-1px);opacity:0.92;}
.nn-form-fallback button[type="submit"]:disabled{opacity:0.6;cursor:wait;}
.nn-form-fallback [data-nn-form-status]{font-size:0.9rem;margin:0;}
</style>
<div class="nn-form-fallback">
  <input type="text" name="company_website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
  <div class="nn-form-row">
    <label>Name<input type="text" name="name" required autocomplete="name"></label>
    <label>Email<input type="email" name="email" required autocomplete="email"></label>
  </div>
  <label>Phone<input type="tel" name="phone" autocomplete="tel"></label>
  <label>Message<textarea name="message" required></textarea></label>
  <button type="submit">Send Message</button>
  <p data-nn-form-status></p>
</div>
`;

export function ensureContactForm(html: string): string {
  const formRegex = /<form\b[^>]*\bdata-nn-form\b[^>]*>([\s\S]*?)<\/form>/i;
  const match = html.match(formRegex);
  if (!match) return html;

  const inner = match[1];
  const required = ["name", "email", "phone", "message"];
  const present = required.filter((n) =>
    new RegExp(`<(?:input|textarea|select)\\b[^>]*\\bname=["']${n}["']`, "i").test(inner),
  );
  if (present.length >= 3) return html;

  const formTagMatch = match[0].match(/<form\b[^>]*>/i);
  if (!formTagMatch) return html;
  return html.replace(formRegex, `${formTagMatch[0]}${FORM_FALLBACK_FIELDS}</form>`);
}

/**
 * Every <img> needs an onerror fallback so a 404'd Pexels/picsum URL
 * doesn't leave a blank box on the page (this is what produced the empty
 * about-section collage). The system prompt asks for the same handler
 * verbatim, but the model frequently omits it. Adding it server-side is
 * cheap insurance — it only fires if the original src actually fails.
 */
export function ensureImageFallbacks(html: string, fallbackSeed: string): string {
  const fallbackUrl = `https://picsum.photos/seed/${encodeURIComponent(fallbackSeed)}-fallback/1200/800`;
  const onerrorAttr = `onerror="this.onerror=null;this.src='${fallbackUrl}'"`;
  return html.replace(/<img\b([^>]*)>/gi, (match, attrs: string) => {
    if (/\bonerror\s*=/i.test(attrs)) return match;
    // Skip the logo placeholder pre-substitution and post-substitution
    // (it's served from our CDN and won't 404).
    if (/__NN_LOGO_URL__/.test(attrs)) return match;
    return `<img${attrs} ${onerrorAttr}>`;
  });
}

/**
 * White-label sites must never contain a "Powered by NextNote" badge.
 * The model is instructed to omit it, but it ignores that instruction often
 * enough to be a problem — so we always post-process white-label HTML and
 * strip any element whose visible text mentions "powered by" + "nextnote".
 *
 * We target common wrappers (p, div, span, small, li, footer) and any
 * leaked anchor pointing at nextnote.to that still carries the credit.
 */
export function stripPoweredByBadge(html: string): string {
  let out = html;

  // Strip wrapping containers whose flattened text contains both phrases.
  out = out.replace(
    /<(p|div|span|small|li|aside|figure)\b([^>]*)>([\s\S]*?)<\/\1>/gi,
    (match, _tag, _attrs, inner) => {
      const text = String(inner).replace(/<[^>]+>/g, " ").toLowerCase();
      if (text.includes("powered by") && text.includes("nextnote")) return "";
      if (text.includes("built with nextnote") || text.includes("made with nextnote")) return "";
      return match;
    },
  );

  // Strip any leftover <a> tag pointing at nextnote.to whose text mentions
  // "powered" / "built" / "made" — defensive backstop for edge layouts.
  out = out.replace(/<a\b[^>]*href=["'][^"']*nextnote\.to[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi, (match, inner) => {
    const text = String(inner).replace(/<[^>]+>/g, " ").toLowerCase();
    if (text.includes("powered") || text.includes("built") || text.includes("made")) return "";
    return match;
  });

  return out;
}
