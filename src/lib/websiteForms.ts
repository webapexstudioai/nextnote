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
