// ============================================================
//  ONBOARDING + AUDIT RUNNER
//  "Type a brand → it fetches." Runs the free live fetchers,
//  fills STATE, drives a progress UI that mirrors the agent pipeline.
// ============================================================
import { STATE, saveState } from "./state.js";
import { fetchEntity, fetchCWV, fetchSite, fetchGoogleSuggest, fetchReddit, domainFromBrand, cleanDomain, logoUrl } from "./fetchers.js";
import { indiaBrands, defaultIndiaSet } from "./data.js";

// Auto-suggest realistic Indian competitors from the brand name.
export function competitorsFor(brand) {
  const b = brand.trim().toLowerCase();
  for (const cat of Object.values(indiaBrands)) {
    if (cat.match.some((m) => b.includes(m) || m.includes(b))) {
      return cat.set.filter((x) => x.toLowerCase() !== b);
    }
  }
  return defaultIndiaSet;
}

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
        ${step("entity", "Scraping live site + knowledge graph")}
        ${step("site", "Measuring site health (Core Web Vitals)")}
        ${step("comp", "Mapping Indian competitors")}
        ${step("research", "Mining customer voice & demand (Reddit · Google)")}
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

  // Fire EVERY live fetch in parallel up front — total time ≈ the slowest one (~9s),
  // not the sum. Each progress step resolves independently as its data lands.
  activate("entity"); activate("site"); activate("comp"); activate("research");
  const bn = STATE.brand, dom = STATE.domain;
  const pEntity = fetchEntity(bn);
  const pSite = fetchSite(dom);
  const pCwv = fetchCWV(dom);
  const pReddit = fetchReddit(`${bn} review`);
  const pGoogle = Promise.all([fetchGoogleSuggest(`best ${bn}`), fetchGoogleSuggest(`${bn} `)]);

  // entity + live site
  const [entity, siteData] = await Promise.all([pEntity, pSite]);
  STATE.entity = entity;
  STATE.site = siteData.ok ? siteData : null;
  STATE.description = entity.description || siteData.title || "";
  STATE.extract = entity.extract || siteData.description || "";
  mark("entity", (entity.ok || siteData.ok) ? "done" : "warn",
    entity.ok ? `Wikidata ${entity.wikidataId || "—"} · ${entity.sitelinks} langs` : siteData.ok ? `site read · ${siteData.trust.length} trust signals` : "no entity / site");

  // site health
  const cwv = await pCwv;
  STATE.cwv = cwv.ok ? cwv : null;
  mark("site", cwv.ok ? "done" : "warn", cwv.ok ? `Perf ${cwv.perf} · LCP ${cwv.lcp}s` : "PageSpeed rate-limited");

  // competitors — entered domains, else auto-mapped Indian rivals
  STATE.autoCompetitors = competitorsFor(brand);
  const comps = compStr.split(",").map((s) => cleanDomain(s)).filter(Boolean).slice(0, 4);
  STATE.competitors = [];
  if (comps.length) {
    STATE.competitors = await Promise.all(comps.map(async (d) => {
      const name = d.split(".")[0].replace(/^\w/, (c) => c.toUpperCase());
      const c = await fetchCWV(d);
      return { name, domain: d, logo: logoUrl(d), entity: null, cwv: c.ok ? c : null };
    }));
    mark("comp", "done", `${STATE.competitors.length} benchmarked`);
  } else {
    mark("comp", "done", `auto: ${STATE.autoCompetitors.slice(0, 3).join(", ")}…`);
  }

  // market research — live demand (Google) + customer voice (Reddit)
  const [reddit, gResults] = await Promise.all([pReddit, pGoogle]);
  const google = [...(gResults[0].suggestions || []), ...(gResults[1].suggestions || [])]
    .filter((v, i, a) => a.indexOf(v) === i).slice(0, 10);
  STATE.research = { reddit: reddit.ok ? reddit.posts : [], google };
  const liveBits = (reddit.ok ? 1 : 0) + (google.length ? 1 : 0);
  mark("research", liveBits ? "done" : "warn", liveBits ? `${STATE.research.reddit.length} threads · ${google.length} queries` : "sources rate-limited");

  // synthesize
  mark("synth", "done");
  STATE.ran = true;
  saveState();
  await new Promise((r) => setTimeout(r, 400));
}
