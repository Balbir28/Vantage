// ============================================================
//  ONBOARDING + AUDIT RUNNER
//  "Type a brand → it fetches." Runs the free live fetchers,
//  fills STATE, drives a progress UI that mirrors the agent pipeline.
// ============================================================
import { STATE, saveState } from "./state.js";
import { fetchEntity, fetchCWV, fetchHomepageMeta, domainFromBrand, cleanDomain, logoUrl } from "./fetchers.js";

export function onboardingHTML() {
  return `<div class="onboard">
    <div class="onboard-card card">
      <div class="logo" style="width:54px;height:54px;border-radius:16px;font-size:24px;margin-bottom:18px">V</div>
      <h1>Run a growth audit</h1>
      <p class="muted" style="margin:8px 0 26px;font-size:14.5px;line-height:1.6">
        Enter a brand. Vantage resolves its <b>knowledge-graph entity</b>, measures <b>live site health</b>,
        and benchmarks competitors — then synthesizes the strategy.</p>

      <label class="fld"><span>Brand name</span>
        <input id="in-brand" type="text" placeholder="e.g. Glossier" autocomplete="off" /></label>
      <label class="fld"><span>Website <em>· auto-filled, editable</em></span>
        <input id="in-site" type="text" placeholder="glossier.com" autocomplete="off" /></label>
      <label class="fld"><span>Competitors <em>· optional, comma-separated domains</em></span>
        <input id="in-comp" type="text" placeholder="meritbeauty.com, rhode.com" autocomplete="off" /></label>

      <button class="btn" id="run-audit" style="width:100%;margin-top:18px;padding:13px">Run audit →</button>

      <p class="faint" style="font-size:11.5px;margin-top:18px;line-height:1.6">
        Live signals fetched free, no key: Wikipedia/Wikidata entity · Google PageSpeed (Core Web Vitals) · brand identity.
        Meta &amp; Google ad intelligence shown as framework — connect ad-platform data to make those live.</p>
    </div>
  </div>`;
}

export function progressHTML() {
  const step = (id, label) => `<div class="pstep" id="ps-${id}"><span class="spin"></span><span class="lbl">${label}</span></div>`;
  return `<div class="onboard">
    <div class="onboard-card card" style="max-width:440px">
      <div class="logo" style="width:48px;height:48px;border-radius:14px;font-size:22px;margin-bottom:6px">V</div>
      <h1 style="font-size:22px">Auditing <span id="p-brand" style="color:var(--teal)"></span></h1>
      <p class="muted" style="margin:6px 0 22px;font-size:13.5px">Agents are pulling live signals…</p>
      <div class="psteps">
        ${step("entity", "Resolving entity & knowledge graph")}
        ${step("site", "Measuring site health (Core Web Vitals)")}
        ${step("comp", "Benchmarking competitors")}
        ${step("synth", "Synthesizing strategy")}
      </div>
    </div>
  </div>`;
}

function mark(id, status, detail) {
  const el = document.getElementById(`ps-${id}`);
  if (!el) return;
  el.classList.remove("active");
  el.classList.add(status); // done | warn
  const icon = status === "done" ? "✓" : status === "warn" ? "!" : "";
  el.querySelector(".spin").outerHTML = `<span class="pdot ${status}">${icon}</span>`;
  if (detail) el.querySelector(".lbl").innerHTML += ` <em class="faint" style="font-style:normal">· ${detail}</em>`;
}
function activate(id) { document.getElementById(`ps-${id}`)?.classList.add("active"); }

export async function runAudit(brand, site, compStr) {
  STATE.brand = brand.trim();
  STATE.domain = cleanDomain(site) || domainFromBrand(brand);
  STATE.logo = logoUrl(STATE.domain);
  const pb = document.getElementById("p-brand");
  if (pb) pb.textContent = STATE.brand;

  // 1) entity + identity
  activate("entity");
  const [entity, meta] = await Promise.all([fetchEntity(STATE.brand), fetchHomepageMeta(STATE.domain)]);
  STATE.entity = entity;
  STATE.description = entity.description || meta.title || "";
  STATE.extract = entity.extract || meta.description || "";
  mark("entity", entity.ok ? "done" : "warn", entity.ok ? `Wikidata ${entity.wikidataId || "—"} · ${entity.sitelinks} languages` : "no strong entity found");

  // 2) site health
  activate("site");
  const cwv = await fetchCWV(STATE.domain);
  STATE.cwv = cwv.ok ? cwv : null;
  mark("site", cwv.ok ? "done" : "warn", cwv.ok ? `Perf ${cwv.perf} · LCP ${cwv.lcp}s` : "PageSpeed unavailable (rate-limited)");

  // 3) competitors
  activate("comp");
  const comps = compStr.split(",").map((s) => cleanDomain(s)).filter(Boolean).slice(0, 4);
  STATE.competitors = [];
  if (comps.length) {
    const results = await Promise.all(comps.map(async (d) => {
      const name = d.split(".")[0].replace(/^\w/, (c) => c.toUpperCase());
      const [e, c] = await Promise.all([fetchEntity(name), fetchCWV(d)]);
      return { name, domain: d, logo: logoUrl(d), entity: e, cwv: c.ok ? c : null };
    }));
    STATE.competitors = results;
    mark("comp", "done", `${results.length} benchmarked`);
  } else {
    mark("comp", "warn", "none supplied — using representative set");
  }

  // 4) synthesize
  activate("synth");
  await new Promise((r) => setTimeout(r, 500));
  mark("synth", "done");
  STATE.ran = true;
  saveState();
  await new Promise((r) => setTimeout(r, 450));
}
